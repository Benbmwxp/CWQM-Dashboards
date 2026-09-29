/**
 * Mock implementation of the API contract (src/api/contract.ts).
 * Every data endpoint enforces access exactly as the real backend must:
 * the UI hiding something is never the only protection.
 */
import { delay, http, HttpResponse } from 'msw';
import type { ApiErrorBody, MeResponse, SeriesResponse, SummaryResponse } from '../api/contract';
import { canSeeSite, canSeeWidget, GROUPS, PERSONAS, resolveAccess } from './db/access';
import { findPair, PAIR_LIST, SITES, streamModel } from './db/catalogue';
import { readings, STEP_MINUTES } from './generator';
import { bestLag, detectEvents, downsample, mean, pctChange, pearson, quality, strength, valid } from './analytics';

const DAY = 86_400_000;
export const fail = (status: number, code: ApiErrorBody['code'], error: string) => HttpResponse.json<ApiErrorBody>({ code, error }, { status });
export const latency = () => delay(180 + Math.random() * 260);

export function currentUser(request: Request) {
  const id = request.headers.get('x-mock-user');
  const persona = PERSONAS.find((p) => p.id === id);
  if (!persona) return null;
  return { persona, access: resolveAccess(persona.groups) };
}

/** Parses and checks site, pair and dates; returns an error response or the parsed query. */
function parseQuery(url: URL, access: ReturnType<typeof resolveAccess>) {
  const site = url.searchParams.get('site') ?? '';
  const pairId = url.searchParams.get('pair') ?? '';
  const from = Date.parse(`${url.searchParams.get('from')}T00:00:00Z`);
  const to = Date.parse(`${url.searchParams.get('to')}T00:00:00Z`) + DAY;
  if (!SITES.some((s) => s.id === site)) return { error: fail(404, 'NOT_FOUND', `Unknown site "${site}".`) };
  if (!canSeeSite(access, site)) return { error: fail(403, 'FORBIDDEN', 'You do not have access to this site.') };
  const pair = findPair(pairId);
  if (!pair) return { error: fail(404, 'NOT_FOUND', `Unknown stream pair "${pairId}".`) };
  if (Number.isNaN(from) || Number.isNaN(to) || to <= from) return { error: fail(400, 'BAD_REQUEST', 'Invalid date range.') };
  if (to - from > 366 * DAY) return { error: fail(400, 'BAD_REQUEST', 'Date range can be at most one year.') };
  return { site, pair, from, to };
}

export const handlers = [
  http.get('/api/me', async ({ request }) => {
    await latency();
    const me = currentUser(request);
    if (!me) return fail(401, 'UNAUTHENTICATED', 'Not signed in.');
    const body: MeResponse = {
      user: { id: me.persona.id, name: me.persona.name, email: me.persona.email },
      groups: GROUPS.filter((g) => me.persona.groups.includes(g.id)).map(({ id, name }) => ({ id, name })),
      access: me.access,
    };
    return HttpResponse.json(body);
  }),

  http.get('/api/sites', async ({ request }) => {
    await latency();
    const me = currentUser(request);
    if (!me) return fail(401, 'UNAUTHENTICATED', 'Not signed in.');
    return HttpResponse.json(SITES.filter((s) => canSeeSite(me.access, s.id)));
  }),

  http.get('/api/data-streams/pairs', async ({ request }) => {
    await latency();
    if (!currentUser(request)) return fail(401, 'UNAUTHENTICATED', 'Not signed in.');
    return HttpResponse.json(PAIR_LIST);
  }),

  http.get('/api/data-streams/series', async ({ request }) => {
    await latency();
    const me = currentUser(request);
    if (!me) return fail(401, 'UNAUTHENTICATED', 'Not signed in.');
    if (!canSeeWidget(me.access, 'data-streams', 'chart')) return fail(403, 'FORBIDDEN', 'You do not have access to the stream chart.');
    const url = new URL(request.url);
    const q = parseQuery(url, me.access);
    if ('error' in q) return q.error;
    const maxPoints = Math.min(Number(url.searchParams.get('maxPoints')) || 180, 1000);
    const raw = readings(q.site, q.pair.primary.id, q.pair.secondary.id, q.from, q.to);
    const { points, bucket } = downsample(raw, maxPoints);
    const pd = streamModel(q.pair.primary.id)!.decimals, sdp = streamModel(q.pair.secondary.id)!.decimals;
    const round = (v: number | null, d: number) => (v === null ? null : +v.toFixed(d));
    const body: SeriesResponse = {
      pair: q.pair,
      resolutionMinutes: bucket * STEP_MINUTES,
      rawPointCount: raw.length * 2,
      points: points.map((p) => ({ t: new Date(p.t).toISOString(), primary: round(p.primary, pd), secondary: round(p.secondary, sdp) })),
    };
    return HttpResponse.json(body);
  }),

  http.get('/api/data-streams/summary', async ({ request }) => {
    await latency();
    const me = currentUser(request);
    if (!me) return fail(401, 'UNAUTHENTICATED', 'Not signed in.');
    const widgets = me.access.pages['data-streams'] ?? [];
    if (!['kpis', 'key-metrics', 'comparison', 'insights'].some((w) => widgets.includes(w))) return fail(403, 'FORBIDDEN', 'You do not have access to Data Streams.');
    const q = parseQuery(new URL(request.url), me.access);
    if ('error' in q) return q.error;

    const a = streamModel(q.pair.primary.id)!, b = streamModel(q.pair.secondary.id)!;
    const span = q.to - q.from;
    const now = readings(q.site, a.id, b.id, q.from, q.to);
    const before = readings(q.site, a.id, b.id, q.from - span, q.from);
    const names = { primary: a.name, secondary: b.name }, decimals = { primary: a.decimals, secondary: b.decimals };
    const events = detectEvents(now, names, decimals);
    const eventsBefore = detectEvents(before, names, decimals);
    const qNow = quality(now, events), qBefore = quality(before, eventsBefore);
    const r = pearson(now.map((x) => x.primary), now.map((x) => x.secondary));
    const rBefore = pearson(before.map((x) => x.primary), before.map((x) => x.secondary));
    const avg = (rs: typeof now, k: 'primary' | 'secondary', d: number) => { const m = mean(valid(rs, k)); return m === null ? null : +m.toFixed(d); };

    // Daily figures for the sparklines
    const days: typeof now[] = [];
    for (let t = q.from; t < q.to; t += DAY) { const d = now.filter((x) => x.t >= t && x.t < t + DAY); if (d.length) days.push(d); }
    const daily = {
      primary: days.map((d) => avg(d, 'primary', a.decimals) ?? 0),
      secondary: days.map((d) => avg(d, 'secondary', b.decimals) ?? 0),
      correlation: days.map((d) => +(pearson(d.map((x) => x.primary), d.map((x) => x.secondary)) ?? 0).toFixed(2)),
      quality: days.map((d) => quality(d, events.filter((e) => { const t = Date.parse(e.t); return t >= d[0].t && t <= d[d.length - 1].t; })).good),
    };

    const body: SummaryResponse = {
      pair: q.pair,
      averages: { primary: avg(now, 'primary', a.decimals), secondary: avg(now, 'secondary', b.decimals) },
      change: {
        primary: pctChange(avg(now, 'primary', 6), avg(before, 'primary', 6)),
        secondary: pctChange(avg(now, 'secondary', 6), avg(before, 'secondary', 6)),
      },
      correlation: { r: r === null ? null : +r.toFixed(2), change: pctChange(r, rBefore), ...strength(r), lagMinutes: bestLag(now) * STEP_MINUTES },
      quality: { ...qNow, goodChange: before.length ? +(qNow.good - qBefore.good).toFixed(1) : null },
      daily,
      events: events.slice(0, 50),
      refreshedAt: new Date(Math.floor(Date.now() / 900_000) * 900_000).toISOString(),
    };
    return HttpResponse.json(body);
  }),
];
