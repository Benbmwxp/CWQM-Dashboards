import { Link } from '@tanstack/react-router';
import type { PageId } from '../api/contract';
import { sectionOf } from '../config/pages';
import { useAccess } from '../auth/useAccess';

/** Tabs between the pages of one menu section. Only permitted pages appear; hidden when there's just one. */
export function SectionTabs({ current }: { current: PageId }) {
  const { canPage } = useAccess();
  const pages = sectionOf(current).pages.filter((p) => canPage(p.id));
  if (pages.length < 2) return null;
  return (
    <nav aria-label={`${sectionOf(current).label} pages`} className="flex flex-wrap gap-xs">
      {pages.map((p) => {
        const active = p.id === current;
        return (
          <Link
            key={p.id}
            to={p.path}
            aria-current={active ? 'page' : undefined}
            className={`rounded-pill border px-md py-xs text-sm font-semibold transition-colors ${active ? 'border-transparent bg-action-primary text-content-on-action' : 'border-line-default bg-surface-default text-content-accent hover:bg-action-secondary-hover'}`}
          >
            {p.label}
          </Link>
        );
      })}
    </nav>
  );
}
