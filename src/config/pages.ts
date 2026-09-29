import type { ReactNode } from 'react';
import { createElement } from 'react';
import { icons } from '@severn-trent/cwqm-design-system';
import type { PageId } from '../api/contract';

export interface PageDef { id: PageId; label: string; path: string; built: boolean }
export interface SectionDef { id: string; label: string; icon: ReactNode; pages: PageDef[] }

const i = (C: (typeof icons.navigation)[keyof typeof icons.navigation]) => createElement(C, { 'aria-hidden': true });
const one = (id: PageId, label: string, path: string, icon: ReactNode, built = false): SectionDef => ({ id, label, icon, pages: [{ id, label, path, built }] });

/**
 * Menu sections, in order. A section with several pages shows tabs at the top
 * of each page. People only see the sections and pages their groups allow.
 */
export const SECTIONS: SectionDef[] = [
  one('overview', 'Overview', '/overview', i(icons.navigation.overview)),
  one('cwqm', 'CWQM', '/cwqm', i(icons.navigation.cwqm)),
  one('data-streams', 'Data Streams', '/data-streams', i(icons.navigation.dataStreams), true),
  {
    id: 'concern-codes', label: 'Concern Codes', icon: i(icons.navigation.concernCodes), pages: [
      { id: 'concern-codes', label: 'Instances', path: '/concern-codes', built: true },
      { id: 'concern-codes-analysis', label: 'Site analysis', path: '/concern-codes/site-analysis', built: true },
    ],
  },
  {
    id: 'operability', label: 'Operability', icon: i(icons.navigation.operability), pages: [
      { id: 'operability', label: 'All sites', path: '/operability', built: true },
      { id: 'operability-trend', label: 'Trend analysis', path: '/operability/trend', built: true },
      { id: 'missing-data', label: 'Missing data', path: '/operability/missing-data', built: true },
    ],
  },
  one('compliance', 'Compliance', '/compliance', i(icons.navigation.compliance)),
  one('equipment', 'Equipment', '/equipment', i(icons.navigation.equipment)),
  one('reports', 'Reports', '/reports', i(icons.navigation.reports)),
  one('alerts', 'Alerts', '/alerts', i(icons.navigation.alerts)),
  one('settings', 'Settings', '/settings', i(icons.navigation.settings)),
];

export const PAGES: PageDef[] = SECTIONS.flatMap((s) => s.pages);
export const sectionOf = (pageId: PageId) => SECTIONS.find((s) => s.pages.some((p) => p.id === pageId))!;
export const isActivePath = (path: string, pagePath: string) => path === pagePath || path === `${pagePath}/`;
