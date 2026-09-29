import { isYmd, RANGES, type RangeKey } from '../../lib/dates';

/** Everything on the page lives in the URL, so Share gives an exact copy of the view. */
export interface DataStreamsSearch {
  site?: string;
  pair?: string;
  param?: string;
  range?: RangeKey;
  from?: string;
  to?: string;
  mode?: 'line' | 'area';
  cmp?: 'abs' | 'rel';
}

export function validateDataStreamsSearch(s: Record<string, unknown>): DataStreamsSearch {
  const str = (v: unknown) => (typeof v === 'string' && v.length < 80 ? v : undefined);
  const range = [...RANGES, 'custom'].includes(s.range as string) ? (s.range as RangeKey) : undefined;
  return {
    site: str(s.site),
    pair: str(s.pair),
    param: str(s.param),
    range,
    from: isYmd(s.from) ? s.from : undefined,
    to: isYmd(s.to) ? s.to : undefined,
    mode: s.mode === 'line' ? 'line' : s.mode === 'area' ? 'area' : undefined,
    cmp: s.cmp === 'rel' ? 'rel' : s.cmp === 'abs' ? 'abs' : undefined,
  };
}
