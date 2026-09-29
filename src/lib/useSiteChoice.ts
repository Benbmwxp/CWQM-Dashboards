import { useSites } from '../api/queries';

/**
 * The site to show: the one in the URL (the server rejects it if it isn't
 * permitted), otherwise `fallback` if permitted, otherwise the first permitted site.
 */
export function useSiteChoice(site: string | undefined, fallback = 'buxton') {
  const sites = useSites();
  const list = sites.data ?? [];
  const resolved = site ?? (list.find((s) => s.id === fallback) ?? list[0])?.id;
  return { sites: list, site: resolved, name: list.find((s) => s.id === resolved)?.name ?? resolved ?? '', ready: sites.isSuccess };
}
