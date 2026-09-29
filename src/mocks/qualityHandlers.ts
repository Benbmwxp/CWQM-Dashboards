/**
 * Mock implementation of the quality endpoints in src/api/contract.ts.
 * Same rules as the real backend must follow: every request checks the page
 * and widget access, and only returns monitoring points on permitted sites.
 */
import { http, HttpResponse } from 'msw';
import type {
  ConcernCode, ConcernInstance, ConcernInstancesResponse, ConcernSummary, Flow, IssueReading, IssueReadingsResponse,
  MissingSummary, MonitoringPoint, OperabilityBreakdown, OperabilityMatrix, OperabilityTrend, PageId, Priority, ReadingIssue, SiteAverage, TrendPoint,
} from '../api/contract';
import { currentUser, fail, latency } from './handlers';
import { canSeeSite } from './db/access';
import { SITES } from './db/catalogue';
import { PARAMETER_NAMES, POINTS } from './db/points';
import {
  addCounts, currentSlot, dayDetail, dayIndex, dayToYmd, emptyCounts, operability, pct, slotToIso, SLOTS_PER_DAY, status, sumDays, valueOf, type Counts,
} from './quality';

type User = NonNullable<ReturnType<typeof currentUser>>;
const MAX_DAYS = 180;

/** Checks sign-in and that the user has at least one of `widgets` on `page`. */
function guard(request: Request, page: PageId, widgets: string[]) {
  const me = currentUser(request);
  if (!me) return { error: fail(401, 'UNAUTHENTICATED', 'Not signed in.') };
  const allowed = me.access.pages[page] ?? [];
  if (!widgets.some((w) => allowed.includes(w))) return { error: fail(403, 'FORBIDDEN', 'You do not have access to this information.') };
  return { me };
}

interface Parsed {
  me: User;
  points: MonitoringPoint[];
  params: number[];
  fromDay: number;
  toDay: number;
  url: URL;
}

/**
 * Parses the common filters. `siteMode: 'ignore'` returns every permitted point
 * (used by the all-sites views); 'optional' narrows to the site when given.
 */
function parse(request: Request, me: User, siteMode: 'optional' | 'ignore' = 'optional'): Parsed | { error: Response } {
  const url = new URL(request.url);
  const site = url.searchParams.get('site') || undefined;
  const parameter = url.searchParams.get('parameter') || undefined;
  const fromDay = dayIndex(url.searchParams.get('from') ?? '');
  const toDay = dayIndex(url.searchParams.get('to') ?? '');
  if (Number.isNaN(fromDay) || Number.isNaN(toDay) || toDay < fromDay) return { error: fail(400, 'BAD_REQUEST', 'Invalid date range.') };
  if (toDay - fromDay + 1 > MAX_DAYS) return { error: fail(400, 'BAD_REQUEST', `Date range can be at most ${MAX_DAYS} days.`) };
  if (siteMode === 'optional' && site) {
    if (!SITES.some((s) => s.id === site)) return { error: fail(404, 'NOT_FOUND', `Unknown site "${site}".`) };
    if (!canSeeSite(me.access, site)) return { error: fail(403, 'FORBIDDEN', 'You do not have access to this site.') };
  }
  if (parameter && !PARAMETER_NAMES.includes(parameter as (typeof PARAMETER_NAMES)[number])) return { error: fail(404, 'NOT_FOUND', `Unknown parameter "${parameter}".`) };
  const points = POINTS.filter((p) => canSeeSite(me.access, p.site) && (siteMode === 'ignore' || !site || p.site === site));
  const params = parameter ? [PARAMETER_NAMES.indexOf(parameter as (typeof PARAMETER_NAMES)[number])] : PARAMETER_NAMES.map((_, i) => i);
  return { me, points, params, fromDay, toDay, url };
}

const pIndex = (p: MonitoringPoint) => POINTS.findIndex((x) => x.id === p.id);
const round = (n: number) => +n.toFixed(2);
const change = (now: number, before: number) => round(now - before);
const pctChange = (now: number, before: number) => (before ? +(((now - before) / before) * 100).toFixed(1) : null);

/** Bucket size for trend charts: 12 h up to a week, a day up to a month, then 3 days. */
const bucketHoursFor = (days: number) => (days <= 7 ? 12 : days <= 31 ? 24 : 72);

/* ------------------------------------------------------------------ issue readings & concern instances */

const ISSUE_NAME: Record<'missing' | 'flatline' | 'impossible', ReadingIssue> = { missing: 'Missing', flatline: 'Flatline', impossible: 'Impossible value' };

function priorityOf(code: ConcernCode, parameter: string): Priority {
  if (code === 'Impossible value') return 'High';
  return ['Temperature', 'ODO_Sat'].includes(parameter) ? 'Low' : 'Medium';
}

/** Every non-ok reading in range for the given points/parameters, oldest first. */
function collectIssues(points: MonitoringPoint[], params: number[], fromDay: number, toDay: number, kinds: Set<string>) {
  const out: { pi: number; ki: number; s: number; st: 'missing' | 'flatline' | 'impossible' }[] = [];
  for (const p of points) {
    const pi = pIndex(p);
    for (const ki of params) {
      for (let day = fromDay; day <= toDay; day++) {
        for (const is of dayDetail(pi, ki, day).issues) if (kinds.has(is.st)) out.push({ pi, ki, s: is.s, st: is.st });
      }
    }
  }
  return out;
}

function toInstance(x: { pi: number; ki: number; s: number; st: 'flatline' | 'impossible' }): ConcernInstance {
  const pt = POINTS[x.pi];
  const parameter = PARAMETER_NAMES[x.ki];
  const code = ISSUE_NAME[x.st] as ConcernCode;
  return {
    id: `${pt.id}-${x.ki}-${x.s}`, point: pt.name, site: pt.site, flow: pt.flow, parameter, code,
    priority: priorityOf(code, parameter), value: valueOf(x.pi, x.ki, x.s, x.st)!, t: slotToIso(x.s),
  };
}

function concernInstances(p: Parsed, fromDay = p.fromDay, toDay = p.toDay): ConcernInstance[] {
  const code = p.url.searchParams.get('code') || undefined;
  const kinds = new Set(code === 'Flatline' ? ['flatline'] : code === 'Impossible value' ? ['impossible'] : ['flatline', 'impossible']);
  return collectIssues(p.points, p.params, fromDay, toDay, kinds).map((x) => toInstance(x as Parameters<typeof toInstance>[0]));
}

/* ------------------------------------------------------------------ handlers */

export const qualityHandlers = [
  http.get('/api/points', async ({ request }) => {
    await latency();
    const me = currentUser(request);
    if (!me) return fail(401, 'UNAUTHENTICATED', 'Not signed in.');
    return HttpResponse.json(POINTS.filter((p) => canSeeSite(me.access, p.site)));
  }),

  http.get('/api/parameters', async () => {
    await latency();
    return HttpResponse.json(PARAMETER_NAMES);
  }),

  http.get('/api/operability/matrix', async ({ request }) => {
    await latency();
    const g = guard(request, 'operability', ['heatmap', 'summary', 'parameter-averages']);
    if ('error' in g) return g.error;
    const p = parse(request, g.me, 'ignore');
    if ('error' in p) return p.error;
    const parameters = p.params.map((k) => PARAMETER_NAMES[k]);
    const rows = p.points.map((pt) => ({
      point: pt,
      values: Object.fromEntries(p.params.map((k) => [PARAMETER_NAMES[k], operability(sumDays(pIndex(pt), k, p.fromDay, p.toDay))])),
    }));
    const parameterAverages = Object.fromEntries(parameters.map((name) => [name, rows.length ? round(rows.reduce((a, r) => a + r.values[name], 0) / rows.length) : 0]));
    return HttpResponse.json<OperabilityMatrix>({ parameters, rows, parameterAverages });
  }),

  http.get('/api/operability/trend', async ({ request }) => {
    await latency();
    const g = guard(request, 'operability-trend', ['trends', 'latest-values']);
    if ('error' in g) return g.error;
    const p = parse(request, g.me);
    if ('error' in p) return p.error;
    if (!p.url.searchParams.get('site')) return fail(400, 'BAD_REQUEST', 'Choose a site.');

    const days = p.toDay - p.fromDay + 1;
    const bucketHours = bucketHoursFor(days);
    const len = bucketHours * 4;
    const start = p.fromDay * SLOTS_PER_DAY;
    const end = Math.min((p.toDay + 1) * SLOTS_PER_DAY, currentSlot() + 1);
    const flows: OperabilityTrend['flows'] = {};

    for (const pt of p.points) {
      const pi = pIndex(pt);
      const nb = Math.max(0, Math.ceil((end - start) / len));
      const miss = new Array(nb).fill(0), bad = new Array(nb).fill(0);
      for (const ki of p.params) {
        for (let day = p.fromDay; day <= p.toDay; day++) {
          for (const is of dayDetail(pi, ki, day).issues) {
            if (is.s >= end) continue;
            const b = Math.floor((is.s - start) / len);
            if (is.st === 'missing') miss[b]++; else bad[b]++;
          }
        }
      }
      const series: TrendPoint[] = miss.map((_, b) => {
        const expected = (Math.min(start + (b + 1) * len, end) - (start + b * len)) * p.params.length;
        return { t: slotToIso(start + b * len), operability: pct(expected - miss[b] - bad[b], expected), missing: pct(miss[b], expected), bad: pct(bad[b], expected) };
      });

      // Latest values: last 24 h of the range against the 24 h before.
      const window = (from: number, to: number) => {
        const c = emptyCounts();
        for (let s = from; s < to; s++) for (const ki of p.params) {
          c.expected++;
          const st = status(pi, ki, s);
          if (st !== 'ok') c[st]++;
        }
        return c;
      };
      const last = window(end - SLOTS_PER_DAY, end), prev = window(end - 2 * SLOTS_PER_DAY, end - SLOTS_PER_DAY);
      const badOf = (c: Counts) => pct(c.flatline + c.impossible, c.expected);
      flows[pt.flow] = {
        point: pt,
        series,
        latest: {
          operability: operability(last), missing: pct(last.missing, last.expected), bad: badOf(last),
          change: { operability: change(operability(last), operability(prev)), missing: change(pct(last.missing, last.expected), pct(prev.missing, prev.expected)), bad: change(badOf(last), badOf(prev)) },
        },
      };
    }
    return HttpResponse.json<OperabilityTrend>({ bucketHours, flows });
  }),

  http.get('/api/operability/breakdown', async ({ request }) => {
    await latency();
    const g = guard(request, 'operability-trend', ['breakdown']);
    if ('error' in g) return g.error;
    const p = parse(request, g.me);
    if ('error' in p) return p.error;
    const parameters = p.params.map((k) => PARAMETER_NAMES[k]);
    const rows = p.points.map((pt) => ({
      point: pt,
      metrics: Object.fromEntries(p.params.map((k) => {
        const c = sumDays(pIndex(pt), k, p.fromDay, p.toDay);
        return [PARAMETER_NAMES[k], {
          operability: operability(c), missing: pct(c.missing, c.expected), bad: pct(c.flatline + c.impossible, c.expected),
          flatline: pct(c.flatline, c.expected), impossible: pct(c.impossible, c.expected),
        }];
      })),
    }));
    return HttpResponse.json<OperabilityBreakdown>({ parameters, rows });
  }),

  http.get('/api/quality/readings', async ({ request }) => {
    await latency();
    const me = currentUser(request);
    if (!me) return fail(401, 'UNAUTHENTICATED', 'Not signed in.');
    const allowed = [...(me.access.pages['operability-trend'] ?? []), ...(me.access.pages['missing-data'] ?? [])];
    if (!allowed.includes('readings') && !allowed.includes('missing-readings')) return fail(403, 'FORBIDDEN', 'You do not have access to readings.');
    const p = parse(request, me);
    if ('error' in p) return p.error;
    const flow = p.url.searchParams.get('flow') as Flow | null;
    const codes = (p.url.searchParams.get('codes') ?? 'missing,flatline,impossible').split(',');
    const limit = Math.min(Number(p.url.searchParams.get('limit')) || 50, 500);
    const all = collectIssues(p.points.filter((pt) => !flow || pt.flow === flow), p.params, p.fromDay, p.toDay, new Set(codes));
    all.sort((a, b) => b.s - a.s);
    const rows: IssueReading[] = all.slice(0, limit).map((x) => {
      const pt = POINTS[x.pi];
      return { id: `${pt.id}-${x.ki}-${x.s}`, point: pt.name, flow: pt.flow, parameter: PARAMETER_NAMES[x.ki], code: ISSUE_NAME[x.st], value: valueOf(x.pi, x.ki, x.s, x.st), t: slotToIso(x.s) };
    });
    return HttpResponse.json<IssueReadingsResponse>({ total: all.length, rows });
  }),

  http.get('/api/missing/summary', async ({ request }) => {
    await latency();
    const g = guard(request, 'missing-data', ['kpis', 'daily-charts', 'parameter-availability']);
    if ('error' in g) return g.error;
    const p = parse(request, g.me);
    if ('error' in p) return p.error;
    let totals = emptyCounts();
    const perParam = new Map<number, Counts>();
    const daily: MissingSummary['daily'] = p.points.map((pt) => ({ point: pt, days: [] }));
    p.points.forEach((pt, i) => {
      const pi = pIndex(pt);
      for (let day = p.fromDay; day <= p.toDay; day++) {
        const available: Record<string, number> = {};
        let expectedPerParameter = 0;
        for (const ki of p.params) {
          const c = sumDays(pi, ki, day, day);
          available[PARAMETER_NAMES[ki]] = c.available;
          expectedPerParameter = c.expected;
          totals = addCounts(totals, c);
          perParam.set(ki, addCounts(perParam.get(ki) ?? emptyCounts(), c));
        }
        if (expectedPerParameter) daily[i].days.push({ day: dayToYmd(day), expectedPerParameter, available });
      }
    });
    const byParameter = p.params.map((ki) => {
      const c = perParam.get(ki) ?? emptyCounts();
      return { parameter: PARAMETER_NAMES[ki], available: pct(c.available, c.expected), missing: pct(c.missing, c.expected) };
    });
    return HttpResponse.json<MissingSummary>({ totals, parameters: p.params.map((k) => PARAMETER_NAMES[k]), daily, byParameter });
  }),

  http.get('/api/missing/site-averages', async ({ request }) => {
    await latency();
    const g = guard(request, 'missing-data', ['site-averages']);
    if ('error' in g) return g.error;
    const p = parse(request, g.me, 'ignore');
    if ('error' in p) return p.error;
    const rows: SiteAverage[] = p.points.map((pt) => {
      const c = p.params.reduce((acc, ki) => addCounts(acc, sumDays(pIndex(pt), ki, p.fromDay, p.toDay)), emptyCounts());
      return { point: pt, available: pct(c.available, c.expected), missing: pct(c.missing, c.expected) };
    }).sort((a, b) => a.available - b.available);
    return HttpResponse.json(rows);
  }),

  http.get('/api/concern-codes/instances', async ({ request }) => {
    await latency();
    const me = currentUser(request);
    if (!me) return fail(401, 'UNAUTHENTICATED', 'Not signed in.');
    const ok = (me.access.pages['concern-codes'] ?? []).includes('instances') || (me.access.pages['concern-codes-analysis'] ?? []).includes('latest');
    if (!ok) return fail(403, 'FORBIDDEN', 'You do not have access to concern code instances.');
    const p = parse(request, me);
    if ('error' in p) return p.error;
    const sp = p.url.searchParams;
    const q = (sp.get('q') ?? '').trim().toLowerCase();
    const priority = sp.get('priority') || undefined;
    const flow = sp.get('flow') || undefined;
    const min = sp.get('min') ? Number(sp.get('min')) : undefined;
    const max = sp.get('max') ? Number(sp.get('max')) : undefined;
    const tFrom = sp.get('tFrom') ? Date.parse(`${sp.get('tFrom')}T00:00:00Z`) : undefined;
    const tTo = sp.get('tTo') ? Date.parse(`${sp.get('tTo')}T00:00:00Z`) + 86_400_000 : undefined;

    let rows = concernInstances(p).filter((r) =>
      (!q || `${r.point} ${r.parameter} ${r.code}`.toLowerCase().includes(q)) &&
      (!priority || r.priority === priority) && (!flow || r.flow === flow) &&
      (min === undefined || r.value >= min) && (max === undefined || r.value <= max) &&
      (tFrom === undefined || Date.parse(r.t) >= tFrom) && (tTo === undefined || Date.parse(r.t) < tTo));

    const sort = (sp.get('sort') ?? 't') as keyof ConcernInstance;
    const dir = sp.get('dir') === 'asc' ? 1 : -1;
    const rank: Record<Priority, number> = { High: 0, Medium: 1, Low: 2 };
    rows = rows.sort((a, b) => {
      const [x, y] = sort === 'priority' ? [rank[a.priority], rank[b.priority]] : [a[sort], b[sort]];
      return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * dir;
    });
    const pageSize = Math.min(Math.max(Number(sp.get('pageSize')) || 25, 1), 5000);
    const pages = Math.max(1, Math.ceil(rows.length / pageSize));
    const page = Math.min(Math.max(Number(sp.get('page')) || 1, 1), pages);
    return HttpResponse.json<ConcernInstancesResponse>({ total: rows.length, page, pageSize, rows: rows.slice((page - 1) * pageSize, page * pageSize) });
  }),

  http.get('/api/concern-codes/summary', async ({ request }) => {
    await latency();
    const me = currentUser(request);
    if (!me) return fail(401, 'UNAUTHENTICATED', 'Not signed in.');
    const a = me.access.pages['concern-codes'] ?? [], b = me.access.pages['concern-codes-analysis'] ?? [];
    if (!a.some((w) => ['kpis', 'insight'].includes(w)) && !b.length) return fail(403, 'FORBIDDEN', 'You do not have access to concern codes.');
    const p = parse(request, me);
    if ('error' in p) return p.error;

    const now = concernInstances(p);
    const span = p.toDay - p.fromDay + 1;
    const before = concernInstances(p, p.fromDay - span, p.fromDay - 1);
    const count = <T,>(xs: T[], key: (x: T) => string) => xs.reduce((m, x) => m.set(key(x), (m.get(key(x)) ?? 0) + 1), new Map<string, number>());

    const codes = [...count(now, (r) => r.code)].map(([code, n]) => ({ code: code as ConcernCode, count: n })).sort((x, y) => y.count - x.count);
    const flowCount = (xs: ConcernInstance[], f: Flow) => xs.filter((r) => r.flow === f).length;
    const byFlow = Object.fromEntries((['upstream', 'downstream'] as Flow[]).map((f) => [f, { count: flowCount(now, f), change: pctChange(flowCount(now, f), flowCount(before, f)) }])) as ConcernSummary['byFlow'];

    const bucketHours = bucketHoursFor(span);
    const len = bucketHours * 3_600_000;
    const startMs = p.fromDay * 86_400_000;
    const endMs = Math.min((p.toDay + 1) * 86_400_000, (currentSlot() + 1) * 900_000);
    const names = p.params.map((k) => PARAMETER_NAMES[k]);
    const fmt = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
    const buckets: ConcernSummary['buckets'] = [];
    for (let t = startMs; t < endMs; t += len) {
      const empty = () => Object.fromEntries(names.map((n) => [n, 0]));
      buckets.push({ t: new Date(t).toISOString(), label: bucketHours >= 24 ? fmt.format(t).split(',')[0] : fmt.format(t).replace(', ', '\n'), counts: { upstream: empty(), downstream: empty() } });
    }
    for (const r of now) {
      const bi = Math.floor((Date.parse(r.t) - startMs) / len);
      if (buckets[bi]) buckets[bi].counts[r.flow][r.parameter]++;
    }

    const byPointCode = [...count(now, (r) => `${r.point}|${r.flow}|${r.parameter}|${r.code}`)]
      .map(([k, n]) => { const [point, flow, parameter, code] = k.split('|'); return { point, flow: flow as Flow, parameter, code: code as ConcernCode, count: n }; })
      .sort((x, y) => y.count - x.count);
    const busiestDays = [...count(now, (r) => r.t.slice(0, 10))].map(([day, n]) => ({ day, count: n })).sort((x, y) => y.count - x.count).slice(0, 2);

    return HttpResponse.json<ConcernSummary>({
      total: now.length, change: pctChange(now.length, before.length), codes,
      points: [...new Set(now.map((r) => r.point))].sort(), byFlow, buckets, byPointCode, busiestDays,
    });
  }),
];
