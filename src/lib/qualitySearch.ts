import { addDays, daysBetween, isYmd, today } from './dates';

/** Filters shared by the quality dashboards; they live in the URL so Share gives the exact view. */
export interface QualitySearch { site?: string; parameter?: string; from?: string; to?: string }

export const str = (v: unknown) => (typeof v === 'string' && v.length > 0 && v.length < 80 ? v : undefined);

export function validateQualitySearch(s: Record<string, unknown>): QualitySearch {
  return { site: str(s.site), parameter: str(s.parameter), from: isYmd(s.from) ? s.from : undefined, to: isYmd(s.to) ? s.to : undefined };
}

/** The date window: from the URL if valid, otherwise the last `days` days. */
export function resolveDates(s: QualitySearch, days = 5) {
  if (s.from && s.to && s.from <= s.to && daysBetween(s.from, s.to) <= 180) return { from: s.from, to: s.to };
  const to = today();
  return { from: addDays(to, -(days - 1)), to };
}
