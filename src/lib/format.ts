const TZ = 'Europe/London';

export const fmtDateTime = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: TZ }).format(new Date(iso));
export const fmtDayHour = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: TZ }).format(new Date(iso));
export const fmtDay = (ymd: string) =>
  new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${ymd}T00:00:00Z`));
export const fmtNum = (v: number | null | undefined, decimals = 1) => (v === null || v === undefined ? '–' : v.toLocaleString('en-GB', { maximumFractionDigits: decimals, minimumFractionDigits: decimals }));

/** Decimals that suit a value's magnitude (0.0028 needs 4, 21.3 needs 1). */
export const decimalsFor = (v: number | null | undefined) => {
  const a = Math.abs(v ?? 0);
  return a === 0 ? 1 : a < 0.01 ? 4 : a < 1 ? 2 : a < 100 ? 1 : 0;
};
