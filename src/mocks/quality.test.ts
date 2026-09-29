import { describe, expect, it, beforeAll } from 'vitest';
import { dayDetail, dayIndex, operability, setNow, status, sumDays, SLOTS_PER_DAY } from './quality';
import { POINTS, PARAMETER_NAMES } from './db/points';

const pi = (id: string) => POINTS.findIndex((p) => p.id === id);
const ki = (n: string) => PARAMETER_NAMES.indexOf(n as (typeof PARAMETER_NAMES)[number]);
const from = dayIndex('2026-08-30'), to = dayIndex('2026-09-03');

beforeAll(() => setNow(Date.parse('2026-09-10T00:00:00Z')));

describe('quality model', () => {
  it('is deterministic', () => {
    expect(status(3, 2, 1_970_000)).toBe(status(3, 2, 1_970_000));
  });

  it('expects 96 readings a day per parameter', () => {
    expect(dayDetail(pi('buxton-us'), 0, from).expected).toBe(SLOTS_PER_DAY);
  });

  it('reports 0% for the offline Tideswell points', () => {
    expect(operability(sumDays(pi('tideswell-ds'), ki('pH'), from, to))).toBe(0);
  });

  it('keeps healthy streams near 100%', () => {
    expect(operability(sumDays(pi('alfreton-us'), ki('pH'), from, to))).toBeGreaterThan(95);
  });

  it('reproduces the poor Goscote upstream ammonia sensor', () => {
    expect(operability(sumDays(pi('goscote-us'), ki('Ammonia_NH3'), from, to))).toBeLessThan(30);
  });

  it('shows flatlines on Buxton ammonia but not missing data', () => {
    const c = sumDays(pi('buxton-us'), ki('Ammonia_NH3'), from, to);
    expect(c.flatline / c.expected).toBeGreaterThan(0.1);
  });

  it('never counts readings after "now"', () => {
    setNow(Date.parse('2026-09-01T06:00:00Z'));
    expect(dayDetail(pi('buxton-us'), 0, dayIndex('2026-09-01')).expected).toBe(25);
    expect(dayDetail(pi('buxton-us'), 0, dayIndex('2026-09-02')).expected).toBe(0);
    setNow(Date.parse('2026-09-10T00:00:00Z'));
  });
});
