import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiGet } from './client';
import type {
  ConcernInstancesResponse, ConcernQuery, ConcernSummary, DataStreamsQuery, IssueReadingsResponse, MeResponse, MissingSummary, MonitoringPoint,
  OperabilityBreakdown, OperabilityMatrix, OperabilityTrend, QualityQuery, SeriesResponse, Site, SiteAverage, StreamPair, SummaryResponse,
} from './contract';

export const useMe = () => useQuery({ queryKey: ['me'], queryFn: ({ signal }) => apiGet<MeResponse>('/me', undefined, signal), staleTime: 5 * 60_000 });
export const useSites = () => useQuery({ queryKey: ['sites'], queryFn: ({ signal }) => apiGet<Site[]>('/sites', undefined, signal), staleTime: 10 * 60_000 });
export const usePairs = () => useQuery({ queryKey: ['pairs'], queryFn: ({ signal }) => apiGet<StreamPair[]>('/data-streams/pairs', undefined, signal), staleTime: 10 * 60_000 });

const params = (q: DataStreamsQuery) => ({ site: q.site, pair: q.pair, from: q.from, to: q.to });

/** Aggregated series for the chart. The server returns at most `maxPoints`, whatever the date range. */
export const useSeries = (q: DataStreamsQuery, enabled: boolean) =>
  useQuery({
    queryKey: ['series', q],
    queryFn: ({ signal }) => apiGet<SeriesResponse>('/data-streams/series', { ...params(q), maxPoints: 180 }, signal),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

export const useSummary = (q: DataStreamsQuery, enabled: boolean) =>
  useQuery({
    queryKey: ['summary', q],
    queryFn: ({ signal }) => apiGet<SummaryResponse>('/data-streams/summary', params(q), signal),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

/* ------------------------------------------------------------------ quality dashboards */

type Params = Record<string, string | number | undefined>;
const clean = (p: Params) => Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined && v !== '')) as Record<string, string | number>;

/** A cached GET that keeps showing the previous result while new filters load. */
function useGet<T>(path: string, params: Params, enabled = true) {
  const p = clean(params);
  return useQuery({
    queryKey: [path, p],
    queryFn: ({ signal }) => apiGet<T>(path, p, signal),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

const q = (x: QualityQuery) => ({ site: x.site, parameter: x.parameter, from: x.from, to: x.to });

export const usePoints = () => useQuery({ queryKey: ['points'], queryFn: ({ signal }) => apiGet<MonitoringPoint[]>('/points', undefined, signal), staleTime: 10 * 60_000 });
export const useParameters = () => useQuery({ queryKey: ['parameters'], queryFn: ({ signal }) => apiGet<string[]>('/parameters', undefined, signal), staleTime: Infinity });

export const useOperabilityMatrix = (x: QualityQuery, enabled = true) => useGet<OperabilityMatrix>('/operability/matrix', { parameter: x.parameter, from: x.from, to: x.to }, enabled);
export const useOperabilityTrend = (x: QualityQuery, enabled = true) => useGet<OperabilityTrend>('/operability/trend', q(x), enabled && Boolean(x.site));
export const useBreakdown = (x: QualityQuery, enabled = true) => useGet<OperabilityBreakdown>('/operability/breakdown', q(x), enabled);
export const useIssueReadings = (x: QualityQuery & { flow?: string; codes?: string; limit?: number }, enabled = true) =>
  useGet<IssueReadingsResponse>('/quality/readings', { ...q(x), flow: x.flow, codes: x.codes, limit: x.limit }, enabled);
export const useMissingSummary = (x: QualityQuery, enabled = true) => useGet<MissingSummary>('/missing/summary', q(x), enabled);
export const useSiteAverages = (x: QualityQuery, enabled = true) => useGet<SiteAverage[]>('/missing/site-averages', { parameter: x.parameter, from: x.from, to: x.to }, enabled);
export const useConcernInstances = (x: ConcernQuery, enabled = true) => useGet<ConcernInstancesResponse>('/concern-codes/instances', { ...x }, enabled);
export const useConcernSummary = (x: QualityQuery & { code?: string }, enabled = true) => useGet<ConcernSummary>('/concern-codes/summary', { ...q(x), code: x.code }, enabled);
