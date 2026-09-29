/**
 * Server-side analytics: aggregation, statistics, correlation, anomalies and
 * quality. Pure functions - port these to the real backend (or its SQL views).
 */
import type { Reading } from './generator';
import type { Severity, StreamEvent } from '../api/contract';

type Key = 'primary' | 'secondary';

export function mean(xs: number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

export function sd(xs: number[]): number {
  const m = mean(xs);
  if (m === null || xs.length < 2) return 0;
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
}

export const valid = (rs: Reading[], k: Key) => rs.map((r) => r[k]).filter((v): v is number => v !== null);

/** Pearson correlation over readings where both streams have a value. */
export function pearson(xs: (number | null)[], ys: (number | null)[]): number | null {
  const pairs: [number, number][] = [];
  for (let i = 0; i < Math.min(xs.length, ys.length); i++) {
    const x = xs[i], y = ys[i];
    if (x !== null && y !== null) pairs.push([x, y]);
  }
  if (pairs.length < 3) return null;
  const mx = mean(pairs.map((p) => p[0]))!, my = mean(pairs.map((p) => p[1]))!;
  let num = 0, dx = 0, dy = 0;
  for (const [x, y] of pairs) { num += (x - mx) * (y - my); dx += (x - mx) ** 2; dy += (y - my) ** 2; }
  return dx === 0 || dy === 0 ? null : num / Math.sqrt(dx * dy);
}

/** Lag (in steps) where the secondary best follows the primary, searched 0..maxSteps. */
export function bestLag(rs: Reading[], maxSteps = 16): number {
  let best = 0, bestR = -Infinity;
  for (let lag = 0; lag <= maxSteps; lag++) {
    const r = pearson(rs.slice(0, rs.length - lag).map((x) => x.primary), rs.slice(lag).map((x) => x.secondary));
    if (r !== null && r > bestR) { bestR = r; best = lag; }
  }
  return best;
}

/** Bucket-average down to at most `maxPoints` so the browser never receives raw volumes. */
export function downsample(rs: Reading[], maxPoints: number): { points: Reading[]; bucket: number } {
  const bucket = Math.max(1, Math.ceil(rs.length / maxPoints));
  const points: Reading[] = [];
  for (let i = 0; i < rs.length; i += bucket) {
    const chunk = rs.slice(i, i + bucket);
    const avg = (k: Key) => mean(valid(chunk, k));
    points.push({ t: chunk[0].t, primary: avg('primary'), secondary: avg('secondary') });
  }
  return { points, bucket };
}

/** Readings far from the typical level of their stream, graded by distance in standard deviations. */
export function detectEvents(rs: Reading[], names: Record<Key, string>, decimals: Record<Key, number>): StreamEvent[] {
  const events: StreamEvent[] = [];
  for (const k of ['primary', 'secondary'] as const) {
    // Compare each reading with a centred rolling window (± 6 h) to ignore the normal daily swing.
    const vals = rs.map((r) => r[k]);
    const residuals: number[] = [];
    const res = vals.map((v, i) => {
      if (v === null) return null;
      const win = vals.slice(Math.max(0, i - 24), i + 25).filter((x): x is number => x !== null);
      const r = v - (mean(win) ?? v);
      residuals.push(r);
      return r;
    });
    const s = sd(residuals);
    if (!s) continue;
    res.forEach((r, i) => {
      if (r === null) return;
      const z = Math.abs(r) / s;
      if (z < 3.5) return;
      const severity: Severity = z >= 6 ? 'high' : z >= 4.5 ? 'medium' : 'low';
      events.push({
        id: `${k}-${rs[i].t}`,
        t: new Date(rs[i].t).toISOString(),
        stream: k,
        value: +vals[i]!.toFixed(decimals[k]),
        deviation: +z.toFixed(1),
        severity,
        reason: `${names[k]} ${r > 0 ? 'spiked above' : 'dropped below'} its usual level by ${z.toFixed(1)} standard deviations.`,
      });
    });
  }
  const rank: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
  return events.sort((a, b) => rank[a.severity] - rank[b.severity] || b.deviation - a.deviation);
}

/** Share of expected readings that are good, suspicious (fair) or missing (poor), in %. */
export function quality(rs: Reading[], events: StreamEvent[]) {
  const expected = rs.length * 2;
  if (!expected) return { good: 0, fair: 0, poor: 0 };
  const missing = rs.reduce((n, r) => n + (r.primary === null ? 1 : 0) + (r.secondary === null ? 1 : 0), 0);
  const fair = events.length;
  const pct = (n: number) => +((n / expected) * 100).toFixed(1);
  const poor = pct(missing), fairPct = pct(fair);
  return { good: +(100 - poor - fairPct).toFixed(1), fair: fairPct, poor };
}

export const pctChange = (now: number | null, before: number | null) =>
  now === null || before === null || before === 0 ? null : +(((now - before) / Math.abs(before)) * 100).toFixed(1);

export function strength(r: number | null): { strength: 'strong' | 'moderate' | 'weak'; direction: 'positive' | 'negative' } {
  const a = Math.abs(r ?? 0);
  return { strength: a >= 0.7 ? 'strong' : a >= 0.4 ? 'moderate' : 'weak', direction: (r ?? 0) < 0 ? 'negative' : 'positive' };
}
