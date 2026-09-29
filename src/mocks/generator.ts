/**
 * Deterministic telemetry: the same site, stream and time always give the same
 * reading, so the mock behaves like a real store without holding millions of rows.
 */
import { streamModel, type StreamModel } from './db/catalogue';

export const STEP_MINUTES = 15;
const STEP_MS = STEP_MINUTES * 60_000;
const DAY_MS = 86_400_000;
const CYCLE_MS = 3.2 * DAY_MS;

/** Stable pseudo-random number in [0, 1) from a string key. */
export function rand(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const gauss = (key: string) => {
  const u = Math.max(rand(key + 'a'), 1e-9);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand(key + 'b'));
};

function valueAt(site: string, m: StreamModel, t: number): number | null {
  const k = `${site}|${m.id}|${t}`;
  // ~1.2% of readings never arrive
  if (rand(k + 'miss') < 0.012) return null;
  const sitePhase = rand(site) * 2 * Math.PI;
  const siteScale = 0.9 + rand(site + 's') * 0.2;
  const shared = Math.sin((2 * Math.PI * t) / CYCLE_MS + sitePhase + m.phase) + 0.25 * Math.sin((2 * Math.PI * t) / DAY_MS + m.phase);
  let v = m.base * siteScale + m.swing * shared + m.noise * gauss(k);
  // Rare injected anomalies (spikes) that the analytics should catch
  const spike = rand(k + 'spike');
  if (spike < 0.0015) v += m.swing * (spike < 0.0004 ? 3.2 : spike < 0.0009 ? 2.3 : 1.7) * (rand(k + 'sgn') < 0.5 ? -1 : 1);
  return v;
}

export interface Reading { t: number; primary: number | null; secondary: number | null }

/** Raw 15-minute readings for a pair of streams, from `fromMs` (inclusive) to `toMs` (exclusive), never past now. */
export function readings(site: string, primaryId: string, secondaryId: string, fromMs: number, toMs: number, nowMs = Date.now()): Reading[] {
  const a = streamModel(primaryId)!;
  const b = streamModel(secondaryId)!;
  const end = Math.min(toMs, Math.floor(nowMs / STEP_MS) * STEP_MS + 1);
  const out: Reading[] = [];
  for (let t = Math.ceil(fromMs / STEP_MS) * STEP_MS; t < end; t += STEP_MS) {
    out.push({ t, primary: valueAt(site, a, t), secondary: valueAt(site, b, t) });
  }
  return out;
}
