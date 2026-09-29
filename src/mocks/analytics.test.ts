import { describe, expect, it } from 'vitest';
import { bestLag, detectEvents, downsample, pearson, pctChange, quality } from './analytics';
import { readings } from './generator';
import type { Reading } from './generator';

const DAY = 86_400_000;
const NOW = Date.parse('2026-06-26T00:00:00Z');
const FROM = Date.parse('2026-06-18T00:00:00Z');
const week = readings('littleaston', 'spconductivity', 'index-value', FROM, FROM + 7 * DAY, NOW);

describe('generator', () => {
  it('is deterministic and uses 15-minute steps', () => {
    const again = readings('littleaston', 'spconductivity', 'index-value', FROM, FROM + 7 * DAY, NOW);
    expect(again).toEqual(week);
    expect(week).toHaveLength(7 * 96);
    expect(week[1].t - week[0].t).toBe(15 * 60_000);
  });

  it('never returns future readings', () => {
    const rs = readings('littleaston', 'spconductivity', 'index-value', NOW - DAY, NOW + DAY, NOW);
    expect(Math.max(...rs.map((r) => r.t))).toBeLessThanOrEqual(NOW);
  });
});

describe('pearson', () => {
  it('is 1 for perfectly related series and -1 for opposite ones', () => {
    expect(pearson([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1);
    expect(pearson([1, 2, 3, 4], [8, 6, 4, 2])).toBeCloseTo(-1);
  });
  it('skips missing values and needs at least 3 pairs', () => {
    expect(pearson([1, null, 3, 4], [2, 5, 6, 8])).toBeCloseTo(1);
    expect(pearson([1, 2], [1, 2])).toBeNull();
  });
  it('finds the strong positive link between conductivity and index value', () => {
    const r = pearson(week.map((x) => x.primary), week.map((x) => x.secondary))!;
    expect(r).toBeGreaterThan(0.6);
  });
  it('finds the negative link between temperature and dissolved oxygen', () => {
    const rs = readings('buxton', 'temperature', 'odo-mgl', FROM, FROM + 7 * DAY, NOW);
    expect(pearson(rs.map((x) => x.primary), rs.map((x) => x.secondary))!).toBeLessThan(-0.5);
  });
});

describe('downsample', () => {
  it('never returns more than maxPoints and keeps the first timestamp', () => {
    const { points, bucket } = downsample(week, 180);
    expect(points.length).toBeLessThanOrEqual(180);
    expect(bucket).toBe(4);
    expect(points[0].t).toBe(week[0].t);
  });
  it('averages each bucket, ignoring missing values', () => {
    const rs: Reading[] = [{ t: 0, primary: 1, secondary: null }, { t: 1, primary: 3, secondary: 4 }];
    expect(downsample(rs, 1).points[0]).toEqual({ t: 0, primary: 2, secondary: 4 });
  });
});

describe('detectEvents', () => {
  const flat: Reading[] = Array.from({ length: 200 }, (_, i) => ({ t: i, primary: 10 + (i % 2) * 0.1, secondary: 1 }));
  it('flags a large spike as high severity and ignores normal noise', () => {
    const rs = flat.map((r, i) => (i === 100 ? { ...r, primary: 20 } : r));
    const ev = detectEvents(rs, { primary: 'A', secondary: 'B' }, { primary: 1, secondary: 1 });
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({ stream: 'primary', severity: 'high' });
    expect(ev[0].reason).toContain('spiked above');
  });
});

describe('quality and helpers', () => {
  it('counts missing readings as poor', () => {
    const rs: Reading[] = [{ t: 0, primary: null, secondary: 1 }, { t: 1, primary: 1, secondary: 1 }];
    expect(quality(rs, [])).toEqual({ good: 75, fair: 0, poor: 25 });
  });
  it('calculates percentage change, or null without a baseline', () => {
    expect(pctChange(110, 100)).toBe(10);
    expect(pctChange(1, null)).toBeNull();
  });
  it('finds the lag built into the generated index value', () => {
    expect(bestLag(week)).toBeGreaterThanOrEqual(0);
  });
});
