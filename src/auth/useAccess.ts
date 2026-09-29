import { useMe } from '../api/queries';
import type { PageId } from '../api/contract';

/** Convenience checks over the access returned by /api/me. For display only - the server enforces it. */
export function useAccess() {
  const me = useMe();
  const access = me.data?.access;
  return {
    ...me,
    canPage: (page: PageId) => Boolean(access?.pages[page]),
    can: (page: PageId, widget: string) => access?.pages[page]?.includes(widget) ?? false,
    widgets: (page: PageId) => access?.pages[page] ?? [],
  };
}
