/**
 * The API contract between this app and the backend.
 * The mock server (src/mocks) implements it today; the real backend must return exactly these shapes.
 * All timestamps are ISO 8601 strings in UTC.
 */

export type PageId =
  | 'overview' | 'cwqm' | 'data-streams'
  | 'concern-codes' | 'concern-codes-analysis'
  | 'operability' | 'operability-trend' | 'missing-data'
  | 'compliance' | 'equipment' | 'reports' | 'alerts' | 'settings';

/** What the signed-in user may see. Resolved on the server from their groups. */
export interface Access {
  /** Page id -> widget ids allowed on that page. A page missing here is not accessible. */
  pages: Partial<Record<PageId, string[]>>;
  /** Site ids the user may query, or 'all'. */
  sites: string[] | 'all';
}

/** GET /api/me */
export interface MeResponse {
  user: { id: string; name: string; email: string };
  groups: { id: string; name: string }[];
  access: Access;
}

/** GET /api/sites */
export interface Site { id: string; name: string }

export interface Stream {
  id: string;
  name: string;
  /** e.g. "µS/cm". Empty for index values. */
  unit: string;
  /** Top of the usual display scale, used for the relative comparison. */
  scaleMax: number;
}

/** GET /api/data-streams/pairs?site= */
export interface StreamPair { id: string; primary: Stream; secondary: Stream }

export interface DataStreamsQuery {
  site: string;
  pair: string;
  /** yyyy-mm-dd, inclusive */
  from: string;
  /** yyyy-mm-dd, inclusive */
  to: string;
}

/** GET /api/data-streams/series?site&pair&from&to&maxPoints */
export interface SeriesResponse {
  pair: StreamPair;
  /** Minutes per point after server-side aggregation. */
  resolutionMinutes: number;
  /** Raw readings in the window, before aggregation. */
  rawPointCount: number;
  points: { t: string; primary: number | null; secondary: number | null }[];
}

export type Severity = 'high' | 'medium' | 'low';

export interface StreamEvent {
  id: string;
  t: string;
  stream: 'primary' | 'secondary';
  value: number;
  /** How far from normal, in standard deviations. */
  deviation: number;
  severity: Severity;
  reason: string;
}

/** GET /api/data-streams/summary?site&pair&from&to */
export interface SummaryResponse {
  pair: StreamPair;
  averages: { primary: number | null; secondary: number | null };
  /** % change against the previous period of the same length. Null when there is no earlier data. */
  change: { primary: number | null; secondary: number | null };
  correlation: { r: number | null; change: number | null; strength: 'strong' | 'moderate' | 'weak'; direction: 'positive' | 'negative'; lagMinutes: number };
  quality: { good: number; fair: number; poor: number; goodChange: number | null };
  /** Daily averages for sparklines, oldest first. */
  daily: { primary: number[]; secondary: number[]; correlation: number[]; quality: number[] };
  events: StreamEvent[];
  refreshedAt: string;
}

export interface ApiErrorBody { error: string; code: 'FORBIDDEN' | 'NOT_FOUND' | 'BAD_REQUEST' | 'UNAUTHENTICATED' }

/* ------------------------------------------------------------------ Quality dashboards */

export type Flow = 'upstream' | 'downstream';

/** A monitoring point: one site has an upstream (US) and a downstream (DS) point. GET /api/points */
export interface MonitoringPoint { id: string; name: string; site: string; flow: Flow }

/** Common filters. `site` and `parameter` are optional ("All"). Dates are yyyy-mm-dd, inclusive. */
export interface QualityQuery { site?: string; parameter?: string; from: string; to: string }

export interface QualityCounts { expected: number; available: number; missing: number; flatline: number; impossible: number }

/** GET /api/operability/matrix?parameter&from&to - site filter deliberately ignored (all permitted points). */
export interface OperabilityMatrix {
  parameters: string[];
  rows: { point: MonitoringPoint; values: Record<string, number> }[];
  parameterAverages: Record<string, number>;
}

export interface TrendPoint { t: string; operability: number; missing: number; bad: number }
export interface LatestValues { operability: number; missing: number; bad: number; change: { operability: number | null; missing: number | null; bad: number | null } }

/** GET /api/operability/trend?site&parameter&from&to */
export interface OperabilityTrend {
  bucketHours: number;
  flows: Partial<Record<Flow, { point: MonitoringPoint; series: TrendPoint[]; latest: LatestValues }>>;
}

export interface BreakdownMetrics { operability: number; missing: number; bad: number; flatline: number; impossible: number }

/** GET /api/operability/breakdown?site&parameter&from&to */
export interface OperabilityBreakdown { parameters: string[]; rows: { point: MonitoringPoint; metrics: Record<string, BreakdownMetrics> }[] }

export type ReadingIssue = 'Missing' | 'Flatline' | 'Impossible value';

export interface IssueReading { id: string; point: string; flow: Flow; parameter: string; code: ReadingIssue; value: number | null; t: string }

/** GET /api/quality/readings?site&parameter&from&to&flow&codes&limit - newest first. */
export interface IssueReadingsResponse { total: number; rows: IssueReading[] }

/** GET /api/missing/summary?site&parameter&from&to */
export interface MissingSummary {
  totals: QualityCounts;
  parameters: string[];
  /** Available readings per day, per point, per parameter. */
  daily: { point: MonitoringPoint; days: { day: string; expectedPerParameter: number; available: Record<string, number> }[] }[];
  byParameter: { parameter: string; available: number; missing: number }[];
}

/** GET /api/missing/site-averages?parameter&from&to - all permitted points, worst first. */
export interface SiteAverage { point: MonitoringPoint; available: number; missing: number }

/* ------------------------------------------------------------------ Concern codes */

export type ConcernCode = 'Flatline' | 'Impossible value';
export type Priority = 'High' | 'Medium' | 'Low';

export interface ConcernInstance { id: string; point: string; site: string; flow: Flow; parameter: string; priority: Priority; code: ConcernCode; value: number; t: string }

export interface ConcernQuery extends QualityQuery {
  code?: string;
  q?: string;
  priority?: string;
  flow?: Flow;
  min?: number;
  max?: number;
  tFrom?: string;
  tTo?: string;
  sort?: 'point' | 'parameter' | 'priority' | 'code' | 'value' | 't';
  dir?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

/** GET /api/concern-codes/instances?...ConcernQuery - server-side filter, sort and paging. */
export interface ConcernInstancesResponse { total: number; page: number; pageSize: number; rows: ConcernInstance[] }

/** GET /api/concern-codes/summary?site&parameter&code&from&to */
export interface ConcernSummary {
  total: number;
  change: number | null;
  codes: { code: ConcernCode; count: number }[];
  points: string[];
  byFlow: Record<Flow, { count: number; change: number | null }>;
  /** Instance counts per time bucket, per flow, per parameter. */
  buckets: { t: string; label: string; counts: Record<Flow, Record<string, number>> }[];
  byPointCode: { point: string; flow: Flow; parameter: string; code: ConcernCode; count: number }[];
  busiestDays: { day: string; count: number }[];
}
