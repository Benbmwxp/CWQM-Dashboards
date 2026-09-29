/**
 * Groups and people. In production this lives in the backend database and the
 * groups come from Microsoft Entra ID; here it drives the mock server.
 */
import type { Access, PageId } from '../../api/contract';

export const ALL_WIDGETS: Record<PageId, string[]> = {
  'data-streams': ['kpis', 'chart', 'key-metrics', 'comparison', 'insights'],
  operability: ['heatmap', 'summary', 'parameter-averages'],
  'operability-trend': ['trends', 'latest-values', 'breakdown', 'readings'],
  'missing-data': ['kpis', 'daily-charts', 'site-averages', 'parameter-availability', 'missing-readings'],
  'concern-codes': ['kpis', 'instances', 'refine', 'insight'],
  'concern-codes-analysis': ['kpis', 'charts', 'ec-codes', 'latest', 'insight'],
  overview: [], cwqm: [], compliance: [], equipment: [], reports: [], alerts: [], settings: [],
};

type GroupPages = Partial<Record<PageId, string[] | 'all'>>;

export interface Group {
  id: string;
  name: string;
  description: string;
  pages: GroupPages;
  sites: string[] | 'all';
}

export const GROUPS: Group[] = [
  {
    id: 'cwqm-admins', name: 'CWQM Admins', description: 'Everything, all sites.',
    pages: Object.fromEntries(Object.keys(ALL_WIDGETS).map((p) => [p, 'all'])) as GroupPages, sites: 'all',
  },
  {
    id: 'operations-analysts', name: 'Operations Analysts', description: 'All dashboards in full, all sites.',
    pages: {
      overview: 'all', cwqm: 'all', 'data-streams': 'all', operability: 'all', 'operability-trend': 'all', 'missing-data': 'all',
      'concern-codes': 'all', 'concern-codes-analysis': 'all', alerts: 'all',
    }, sites: 'all',
  },
  {
    id: 'site-team-littleaston', name: 'Site Team - LittleAston', description: 'Day-to-day views for LittleAston only: streams, trends, missing data and concern code instances.',
    pages: {
      'data-streams': ['kpis', 'chart', 'key-metrics'],
      'operability-trend': ['trends', 'latest-values', 'readings'],
      'missing-data': ['kpis', 'daily-charts', 'parameter-availability', 'missing-readings'],
      'concern-codes': ['kpis', 'instances'],
    }, sites: ['littleaston'],
  },
  {
    id: 'management', name: 'Management', description: 'Summaries only: KPI tiles, overall operability and insights, all sites.',
    pages: {
      overview: 'all', 'data-streams': ['kpis', 'insights'], operability: ['summary', 'parameter-averages'],
      'missing-data': ['kpis', 'site-averages'], 'concern-codes-analysis': ['kpis', 'insight'], reports: 'all',
    }, sites: 'all',
  },
];

export interface Persona { id: string; name: string; email: string; groups: string[] }

export const PERSONAS: Persona[] = [
  { id: 'priya', name: 'Priya Shah', email: 'priya.shah@example.com', groups: ['cwqm-admins'] },
  { id: 'tom', name: 'Tom Evans', email: 'tom.evans@example.com', groups: ['operations-analysts'] },
  { id: 'aisha', name: 'Aisha Khan', email: 'aisha.khan@example.com', groups: ['site-team-littleaston'] },
  { id: 'david', name: 'David Clarke', email: 'david.clarke@example.com', groups: ['management'] },
  { id: 'sam', name: 'Sam Patel', email: 'sam.patel@example.com', groups: ['site-team-littleaston', 'management'] },
];

/**
 * A user's access is the union of their groups: any page or widget allowed by
 * at least one group, and every site any group allows.
 */
export function resolveAccess(groupIds: string[]): Access {
  const groups = GROUPS.filter((g) => groupIds.includes(g.id));
  const pages: Access['pages'] = {};
  for (const g of groups) {
    for (const [page, widgets] of Object.entries(g.pages) as [PageId, string[] | 'all'][]) {
      const allowed = widgets === 'all' ? ALL_WIDGETS[page] : widgets;
      pages[page] = [...new Set([...(pages[page] ?? []), ...allowed])];
    }
  }
  const sites: Access['sites'] = groups.some((g) => g.sites === 'all')
    ? 'all'
    : [...new Set(groups.flatMap((g) => (g.sites === 'all' ? [] : g.sites)))];
  return { pages, sites };
}

export const canSeeSite = (access: Access, site: string) => access.sites === 'all' || access.sites.includes(site);
export const canSeeWidget = (access: Access, page: PageId, widget: string) => access.pages[page]?.includes(widget) ?? false;
