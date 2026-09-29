/**
 * Simulated telemetry health for every monitoring point and parameter, at
 * 15-minute resolution. Each reading is good, missing, a flatline or an
 * impossible value. Operability, missing-data and concern-code figures are all
 * derived from these statuses, so every dashboard agrees with the others.
 */
import { POINTS, QUALITY_PARAMETERS } from './db/points';
import { streamModel } from './db/catalogue';

export const SLOT_MS = 15 * 60_000;
export const SLOTS_PER_DAY = 96;
const DAY_MS = 86_400_000;

export type Status = 'ok' | 'missing' | 'flatline' | 'impossible';

/** Fast integer hash -> [0, 1). */
function u(a: number, b: number, c: number, d: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 13), 0x27d4eb2f) ^ Math.imul(c + 0x165667b1, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) ^ Math.imul(d + 0x27d4eb2f, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

interface Profile {
  /** Everything missing (sensor offline). */
  dead?: boolean;
  /** Chance each reading is missing. */
  missing: number;
  /** Chance per day of a multi-hour outage. */
  outage: number;
  /** Chance each hour is flatlined (stuck sensor). */
  flat: number;
  /** Chance each reading is physically impossible. */
  impossible: number;
  /** Extra missing readings in the most recent 18 hours (a live incident). */
  recentMissing?: number;
}

const base: Profile = { missing: 0.003, outage: 0.015, flat: 0.001, impossible: 0.0004 };

/** Health profiles that reproduce the patterns in the dashboard designs. */
const OVERRIDES: Record<string, Partial<Profile>> = {
  'tideswell-us|*': { dead: true },
  'tideswell-ds|*': { dead: true },
  'goscote-us|Ammonia_NH3': { missing: 0.84 },
  'trescott-ds|Turbidity': { missing: 0.66 },
  'littleaston-us|Ammonia_NH3': { missing: 0.53 },
  'shenstone-us|Ammonia_NH3': { missing: 0.45 },
  'buxton-us|Ammonia_NH3': { flat: 0.2 },
  'buxton-ds|Ammonia_NH3': { flat: 0.1, missing: 0.017 },
  'buxton-ds|*': { missing: 0.017, recentMissing: 0.5 },
  'sperna-us|Ammonia_NH3': { missing: 0.09 },
  'littleaston-ds|Ammonia_NH3': { missing: 0.07 },
  'goscote-ds|Ammonia_NH3': { missing: 0.06 },
  'alfreton-us|Ammonia_NH3': { missing: 0.035 },
  'alfreton-ds|Ammonia_NH3': { missing: 0.03 },
  'trescott-us|Ammonia_NH3': { missing: 0.012 },
  'shenstone-us|Turbidity': { missing: 0.003, flat: 0.002 },
};

const profiles: Profile[][] = POINTS.map((pt) =>
  QUALITY_PARAMETERS.map((p) => ({ ...base, ...OVERRIDES[`${pt.id}|*`], ...OVERRIDES[`${pt.id}|${p.name}`] }))
);

let nowSlot = Math.floor(Date.now() / SLOT_MS);
/** Tests can pin "now" so results are reproducible. */
export const setNow = (ms: number) => { nowSlot = Math.floor(ms / SLOT_MS); cache.clear(); };
export const currentSlot = () => nowSlot;

export function status(pi: number, ki: number, s: number): Status {
  const pr = profiles[pi][ki];
  if (pr.dead) return 'missing';
  const day = Math.floor(s / SLOTS_PER_DAY);
  if (u(pi, ki, day, 1) < pr.outage) {
    const start = Math.floor(u(pi, ki, day, 2) * SLOTS_PER_DAY);
    const len = 4 + Math.floor(u(pi, ki, day, 3) * 20);
    const i = s - day * SLOTS_PER_DAY;
    if (i >= start && i < start + len) return 'missing';
  }
  const recent = pr.recentMissing && nowSlot - s < 72 ? pr.recentMissing * (1 - (nowSlot - s) / 72) : 0;
  if (u(pi, ki, s, 4) < pr.missing + recent) return 'missing';
  if (u(pi, ki, Math.floor(s / 4), 5) < pr.flat) return 'flatline';
  if (u(pi, ki, s, 6) < pr.impossible) return 'impossible';
  return 'ok';
}

/** Reading value: flatlines repeat the value from the start of the hour; impossible values are negative. */
export function valueOf(pi: number, ki: number, s: number, st: Status): number | null {
  if (st === 'missing') return null;
  const m = streamModel(QUALITY_PARAMETERS[ki].stream)!;
  const at = st === 'flatline' ? Math.floor(s / 4) * 4 : s;
  const shared = Math.sin((2 * Math.PI * at) / (SLOTS_PER_DAY * 3.2) + pi) + 0.25 * Math.sin((2 * Math.PI * at) / SLOTS_PER_DAY);
  const noise = (u(pi, ki, at, 7) - 0.5) * 2 * m.noise;
  const v = m.base * (0.9 + (pi % 5) * 0.05) + m.swing * shared + (st === 'flatline' ? 0 : noise);
  return +(st === 'impossible' ? -Math.abs(v) * 3 : v).toFixed(m.decimals);
}

export interface DayDetail {
  expected: number;
  missing: number;
  flatline: number;
  impossible: number;
  /** Slots that aren't "ok", in time order. */
  issues: { s: number; st: Exclude<Status, 'ok'> }[];
}

const cache = new Map<string, DayDetail>();

/** Statuses for one point/parameter/day, cached - the backend equivalent is a daily rollup table. */
export function dayDetail(pi: number, ki: number, day: number): DayDetail {
  const key = `${pi}|${ki}|${day}`;
  const hit = cache.get(key);
  if (hit && day < Math.floor(nowSlot / SLOTS_PER_DAY)) return hit;
  const d: DayDetail = { expected: 0, missing: 0, flatline: 0, impossible: 0, issues: [] };
  const first = day * SLOTS_PER_DAY;
  const last = Math.min(first + SLOTS_PER_DAY, nowSlot + 1);
  for (let s = first; s < last; s++) {
    d.expected++;
    const st = status(pi, ki, s);
    if (st !== 'ok') { d[st]++; d.issues.push({ s, st }); }
  }
  if (cache.size > 40_000) cache.clear();
  cache.set(key, d);
  return d;
}

export const dayIndex = (ymd: string) => Math.floor(Date.parse(`${ymd}T00:00:00Z`) / DAY_MS);
export const dayToYmd = (day: number) => new Date(day * DAY_MS).toISOString().slice(0, 10);
export const slotToIso = (s: number) => new Date(s * SLOT_MS).toISOString();

export interface Counts { expected: number; available: number; missing: number; flatline: number; impossible: number }

export function sumDays(pi: number, ki: number, fromDay: number, toDay: number): Counts {
  const c: Counts = { expected: 0, available: 0, missing: 0, flatline: 0, impossible: 0 };
  for (let day = fromDay; day <= toDay; day++) {
    const d = dayDetail(pi, ki, day);
    c.expected += d.expected; c.missing += d.missing; c.flatline += d.flatline; c.impossible += d.impossible;
  }
  c.available = c.expected - c.missing;
  return c;
}

export const addCounts = (a: Counts, b: Counts): Counts => ({
  expected: a.expected + b.expected, available: a.available + b.available, missing: a.missing + b.missing,
  flatline: a.flatline + b.flatline, impossible: a.impossible + b.impossible,
});
export const emptyCounts = (): Counts => ({ expected: 0, available: 0, missing: 0, flatline: 0, impossible: 0 });

/** Operability = readings that arrived and passed checks, as % of expected. */
export const pct = (n: number, of: number) => (of ? +((n / of) * 100).toFixed(2) : 0);
export const operability = (c: Counts) => pct(c.expected - c.missing - c.flatline - c.impossible, c.expected);
