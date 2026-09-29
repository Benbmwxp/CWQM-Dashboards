/** Dates are yyyy-mm-dd strings in UTC throughout the URL and API. */
export const RANGES = ['1D', '7D', '30D', '90D', '180D'] as const;
export type RangeKey = (typeof RANGES)[number] | 'custom';

export const toYmd = (d: Date) => d.toISOString().slice(0, 10);
export const today = () => toYmd(new Date());
export const addDays = (ymd: string, n: number) => toYmd(new Date(Date.parse(`${ymd}T00:00:00Z`) + n * 86_400_000));
export const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
export const isYmd = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

/** from/to for a preset, ending today. */
export const rangeDates = (range: Exclude<RangeKey, 'custom'>) => {
  const days = Number(range.replace('D', ''));
  const to = today();
  return { from: addDays(to, -(days - 1)), to };
};
