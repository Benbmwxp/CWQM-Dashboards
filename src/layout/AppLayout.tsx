import type { MouseEvent } from 'react';
import { Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { AppShell, Sidebar } from '@severn-trent/cwqm-design-system';
import logo from '../assets/severn-trent-logo.png';
import { SECTIONS } from '../config/pages';
import { useAccess } from '../auth/useAccess';
import { API_MODE } from '../api/client';
import { getMockUser, setMockUser } from '../auth/session';
import { PERSONAS } from '../mocks/db/access';
import { FullPageMessage } from './FullPageMessage';

export function AppLayout() {
  const { data: me, isPending, error, canPage } = useAccess();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  // The design-system nav renders plain links; route them through the router (no full page reload).
  const onNavClick = (e: MouseEvent) => {
    const a = (e.target as HTMLElement).closest('a');
    const href = a?.getAttribute('href');
    if (!a || !href?.startsWith('/') || e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    navigate({ to: href });
  };

  if (isPending) return <FullPageMessage title="Loading…" />;
  if (error || !me) return <FullPageMessage title="Can't sign you in" text={error?.message ?? 'Unknown error.'} />;

  // One menu item per section, linking to the first page in it the person can use.
  const items = SECTIONS.flatMap((s) => {
    const pages = s.pages.filter((p) => canPage(p.id));
    if (!pages.length) return [];
    const active = s.pages.some((p) => path === p.path || path.startsWith(`${p.path}/`));
    return [{ label: s.label, href: pages[0].path, icon: s.icon, active, alert: s.id === 'alerts' }];
  });

  return (
    <AppShell
      sidebar={
        <div onClickCapture={onNavClick} className="h-full">
          <Sidebar
            logo={<img src={logo} alt="Severn Trent" width={176} height={79} className="h-auto w-44 rounded-sm" />}
            items={items}
            tagline={'Cleaner Rivers.\nHealthier Communities.\nA Brighter Tomorrow.'}
            footer={<UserPanel name={me.user.name} groups={me.groups.map((g) => g.name)} />}
          />
        </div>
      }
      header={null}
    >
      <Outlet />
    </AppShell>
  );
}

function UserPanel({ name, groups }: { name: string; groups: string[] }) {
  const qc = useQueryClient();
  return (
    <div className="space-y-xs rounded-md border border-white/20 p-sm text-sm">
      {API_MODE === 'mock' ? (
        <label className="block space-y-2xs">
          <span className="text-xs uppercase tracking-wide text-nav-muted">Viewing as (mock)</span>
          <select
            className="w-full rounded-sm border border-white/30 bg-nav-bg px-xs py-2xs text-nav-text"
            value={getMockUser()}
            onChange={(e) => { setMockUser(e.target.value); qc.clear(); window.location.assign('/'); }}
          >
            {PERSONAS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
      ) : (
        <p className="font-semibold">{name}</p>
      )}
      <p className="text-xs leading-snug text-nav-muted">{groups.join(', ')}</p>
    </div>
  );
}
