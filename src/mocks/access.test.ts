import { describe, expect, it } from 'vitest';
import { canSeeSite, canSeeWidget, resolveAccess } from './db/access';

describe('resolveAccess', () => {
  it('gives admins every widget and all sites', () => {
    const a = resolveAccess(['cwqm-admins']);
    expect(a.sites).toBe('all');
    expect(a.pages['data-streams']).toEqual(['kpis', 'chart', 'key-metrics', 'comparison', 'insights']);
  });

  it('limits the site team to three widgets and one site', () => {
    const a = resolveAccess(['site-team-littleaston']);
    expect(a.pages['data-streams']).toEqual(['kpis', 'chart', 'key-metrics']);
    expect(canSeeSite(a, 'littleaston')).toBe(true);
    expect(canSeeSite(a, 'buxton')).toBe(false);
    expect(canSeeWidget(a, 'data-streams', 'insights')).toBe(false);
    expect(a.pages.operability).toBeUndefined();
  });

  it('merges several groups as a union', () => {
    const a = resolveAccess(['site-team-littleaston', 'management']);
    expect(new Set(a.pages['data-streams'])).toEqual(new Set(['kpis', 'chart', 'key-metrics', 'insights']));
    expect(a.sites).toBe('all');
    expect(a.pages.reports).toBeDefined();
  });

  it('gives nothing to unknown groups', () => {
    expect(resolveAccess(['nope'])).toEqual({ pages: {}, sites: [] });
  });
});
