import { useNavigate, useSearch } from '@tanstack/react-router';
import { ArrowDown, ArrowUp, ArrowUpRight, BarChart3, Download, Grid2x2 } from 'lucide-react';
import {
  Button, DataTable, DeltaIndicator, DualAxisChart, icons, InfoCallout, MetricList, PageHeader, PanelCard, tv, type Column, type DualAxisSeries,
} from '@severn-trent/cwqm-design-system';
import type { BreakdownMetrics, Flow, IssueReading, LatestValues, OperabilityBreakdown, OperabilityTrend } from '../../api/contract';
import { useAccess } from '../../auth/useAccess';
import { useBreakdown, useIssueReadings, useOperabilityTrend, useParameters } from '../../api/queries';
import { apiGet } from '../../api/client';
import { HeaderActions } from '../../layout/HeaderActions';
import { FullPageMessage } from '../../layout/FullPageMessage';
import { QualityFilters } from '../../components/QualityFilters';
import { SectionTabs } from '../../components/SectionTabs';
import { WidgetState } from '../../components/WidgetState';
import { AccessError, accessErrorOf } from '../../components/AccessError';
import { fmtPct, operabilityCell, qualityCell } from '../../components/qualityStyles';
import { downloadCsv } from '../../lib/csv';
import { fmtDateTime, fmtDayHour } from '../../lib/format';
import { resolveDates, validateQualitySearch, type QualitySearch } from '../../lib/qualitySearch';
import { useSiteChoice } from '../../lib/useSiteChoice';

export const validateTrendSearch = (s: Record<string, unknown>): QualitySearch => validateQualitySearch(s);

const FLOWS: { flow: Flow; title: string; icon: JSX.Element }[] = [
  { flow: 'upstream', title: 'Upstream', icon: <ArrowUpRight /> },
  { flow: 'downstream', title: 'Downstream', icon: <ArrowDown /> },
];

export function OperabilityTrendPage() {
  const search = useSearch({ from: '/operability/trend' });
  const navigate = useNavigate({ from: '/operability/trend' });
  const set = (patch: Partial<QualitySearch>) => navigate({ search: (prev) => ({ ...prev, ...patch }) });
  const { canPage, can } = useAccess();
  const parameters = useParameters();
  const { sites, site, ready } = useSiteChoice(search.site);
  const dates = resolveDates(search);
  const query = { site, parameter: search.parameter, ...dates };
  const show = {
    trends: can('operability-trend', 'trends'), latest: can('operability-trend', 'latest-values'),
    breakdown: can('operability-trend', 'breakdown'), readings: can('operability-trend', 'readings'),
  };

  const trend = useOperabilityTrend(query, ready && (show.trends || show.latest));
  const breakdown = useBreakdown(query, ready && show.breakdown);
  const upReadings = useIssueReadings({ ...query, flow: 'upstream', limit: 50 }, ready && show.readings);
  const downReadings = useIssueReadings({ ...query, flow: 'downstream', limit: 50 }, ready && show.readings);

  if (!canPage('operability-trend')) return <FullPageMessage title="No access" text="Your groups don't include Operability Trend Analysis." />;
  const denied = accessErrorOf(trend.error, breakdown.error, upReadings.error);

  const exportCsv = () => breakdown.data && downloadCsv(`operability-breakdown-${site}-${dates.from}-to-${dates.to}.csv`,
    breakdown.data.rows.flatMap((r) => breakdown.data!.parameters.map((p) => ({ site: r.point.name, parameter: p, ...r.metrics[p] }))));

  return (
    <div className="space-y-lg">
      <PageHeader
        breadcrumb={[{ label: 'CWQM', href: '/cwqm' }, { label: 'Operability', href: '/operability' }, { label: 'Trend analysis' }]}
        title="Operability Trend Analysis"
        subtitle="Track operability, missing data and data quality trends across upstream and downstream."
        actions={<HeaderActions period={dates} onExport={show.breakdown ? exportCsv : undefined} exportDisabled={!breakdown.data} />}
      />
      <SectionTabs current="operability-trend" />

      <div className="grid gap-lg xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <QualityFilters
          site={{ sites, value: site, onChange: (s) => s && set({ site: s }) }}
          parameter={{ parameters: parameters.data ?? [], value: search.parameter, onChange: (parameter) => set({ parameter }) }}
          dates={{ ...dates, onChange: (r) => set(r) }}
        />
        <InfoCallout className="items-center">This page shows operability, missing data and total bad data trends for the selected site, parameter and date range.</InfoCallout>
      </div>

      {denied ? <AccessError error={denied} onReset={() => navigate({ search: {} })} /> : (
        <>
          {FLOWS.map(({ flow, title, icon }) => (show.trends || show.latest) && (
            <div key={flow} className={show.trends && show.latest ? 'grid items-start gap-lg xl:grid-cols-[minmax(0,1fr)_380px]' : 'grid gap-lg'}>
              {show.trends && (
                <PanelCard icon={icon} title={`Operability Trend - ${title}`} description={trend.data?.flows[flow]?.point.name}>
                  <WidgetState query={trend} height="h-72">{() => <TrendChart data={trend.data!} flow={flow} />}</WidgetState>
                </PanelCard>
              )}
              {show.latest && (
                <PanelCard icon={<BarChart3 />} title={`${title} - Latest Values`} description="Last 24 hours of the selected period">
                  <WidgetState query={trend} height="h-72">{() => <Latest values={trend.data!.flows[flow]?.latest} />}</WidgetState>
                </PanelCard>
              )}
            </div>
          ))}

          {show.breakdown && (
            <PanelCard icon={<Grid2x2 />} title="Operability & Data Quality Breakdown" description="Scroll sideways to see every parameter.">
              <WidgetState query={breakdown} height="h-40">{() => <Breakdown data={breakdown.data!} />}</WidgetState>
            </PanelCard>
          )}

          {show.readings && (
            <div className="grid gap-lg xl:grid-cols-2">
              <Readings title="Missing & Bad Data Readings - Upstream" icon={<ArrowUp />} query={upReadings} filename={`readings-upstream-${site}`} fetchAll={() => apiGet('/quality/readings', { site: site ?? '', ...(search.parameter ? { parameter: search.parameter } : {}), ...dates, flow: 'upstream', limit: 500 })} />
              <Readings title="Missing & Bad Data Readings - Downstream" icon={<ArrowDown />} query={downReadings} filename={`readings-downstream-${site}`} fetchAll={() => apiGet('/quality/readings', { site: site ?? '', ...(search.parameter ? { parameter: search.parameter } : {}), ...dates, flow: 'downstream', limit: 500 })} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TrendChart({ data, flow }: { data: OperabilityTrend; flow: Flow }) {
  const f = data.flows[flow];
  if (!f || !f.series.length) return <p className="py-2xl text-center text-content-subtle">No readings for this location in the period.</p>;
  const rows = f.series.map((p) => ({ ...p, label: fmtDayHour(p.t).replace(', ', '\n') }));
  // Round axis steps (1, 2, 5, 10, 20…) so ticks read 90, 92, 94… rather than 93.6
  const niceStep = (span: number) => [1, 2, 5, 10, 20, 25].find((s) => span / s <= 5) ?? 25;
  const minOp = Math.min(...f.series.map((p) => p.operability));
  const lStep = niceStep(100 - Math.min(90, minOp));
  const lo = Math.max(0, Math.floor(Math.min(90, minOp) / lStep) * lStep);
  const maxBad = Math.max(...f.series.flatMap((p) => [p.missing, p.bad]));
  const rStep = niceStep(Math.max(10, maxBad));
  const maxRight = Math.max(10, Math.ceil(maxBad / rStep) * rStep);
  const ticks = (l: number, hi: number, st: number) => Array.from({ length: Math.round((hi - l) / st) + 1 }, (_, i) => l + i * st);
  const pct = (v: number) => `${v.toFixed(2)}%`;
  const series: DualAxisSeries[] = [
    { key: 'operability', label: 'Operability%', colour: tv('color.data.trend.operability'), axis: 'left', showLabels: rows.length <= 12, format: pct },
    { key: 'missing', label: 'Missing Data%', colour: tv('color.data.trend.missing'), axis: 'right', dashed: true, format: pct },
    { key: 'bad', label: 'Total Bad Data%', colour: tv('color.data.trend.bad'), axis: 'right', dashed: true, format: pct },
  ];
  return (
    <DualAxisChart
      label={`Operability trend, ${flow}`} summary={`Operability from ${pct(f.series[0].operability)} to ${pct(f.series[f.series.length - 1].operability)}.`}
      data={rows as unknown as Record<string, string | number>[]} xKey="label" series={series} height={250}
      xInterval={Math.max(0, Math.floor(rows.length / 9))}
      leftAxis={{ label: 'Operability %', domain: [lo, 100], ticks: ticks(lo, 100, lStep), format: (v) => `${v}%` }}
      rightAxis={{ label: 'Missing & Bad Data %', domain: [0, maxRight], ticks: ticks(0, maxRight, rStep), format: (v) => `${v}%` }}
    />
  );
}

function Latest({ values }: { values?: LatestValues }) {
  if (!values) return <p className="text-content-subtle">No data.</p>;
  const d = (v: number | null, better: boolean) => (v === null ? undefined : <DeltaIndicator value={v} higherIsBetter={better} comparison="vs previous day" layout="stacked" className="items-end" />);
  return (
    <MetricList items={[
      { icon: <icons.data.operability />, tone: 'green', label: 'Operability', value: fmtPct(values.operability), detail: d(values.change.operability, true) },
      { icon: <icons.status.alert />, tone: 'pink', label: 'Missing Data', value: fmtPct(values.missing), detail: d(values.change.missing, false) },
      { icon: <icons.status.warning />, tone: 'orange', label: 'Total Bad Data', value: fmtPct(values.bad), detail: d(values.change.bad, false) },
    ]} />
  );
}

const METRICS: { key: keyof BreakdownMetrics; label: string }[] = [
  { key: 'operability', label: 'Operability %' }, { key: 'missing', label: 'Missing Data %' }, { key: 'bad', label: 'Total Bad Data %' },
  { key: 'flatline', label: 'Flatline %' }, { key: 'impossible', label: 'Impossible Value %' },
];

function Breakdown({ data }: { data: OperabilityBreakdown }) {
  type Row = OperabilityBreakdown['rows'][number];
  const columns: Column<Row>[] = [
    { key: 'site', header: 'Site', rowHeader: true, render: (r) => r.point.name },
    ...data.parameters.flatMap((p) => METRICS.map((m) => ({
      key: `${p}-${m.key}`, header: m.label, align: 'center' as const,
      render: (r: Row) => fmtPct(r.metrics[p][m.key]),
      cellStyle: (r: Row) => (m.key === 'operability' ? operabilityCell(r.metrics[p][m.key]) : qualityCell(r.metrics[p][m.key])),
    }))),
  ];
  return (
    <DataTable caption="Operability and data quality by location and parameter" columns={columns} rows={data.rows} getRowKey={(r) => r.point.id}
      headerTone="strong" striped={false} dense groups={[{ header: '', span: 1 }, ...data.parameters.map((p) => ({ header: p, span: METRICS.length }))]} />
  );
}

function Readings({ title, icon, query, filename, fetchAll }: {
  title: string; icon: JSX.Element; query: ReturnType<typeof useIssueReadings>; filename: string; fetchAll: () => Promise<unknown>;
}) {
  const columns: Column<IssueReading>[] = [
    { key: 'point', header: 'Site', rowHeader: true },
    { key: 'parameter', header: 'Parameter' },
    { key: 'code', header: 'E&C Code' },
    { key: 'value', header: 'Value', render: (r) => (r.value === null ? '—' : String(r.value)) },
    { key: 't', header: 'Phenomenon Time', render: (r) => fmtDateTime(r.t) },
  ];
  return (
    <PanelCard icon={icon} title={title}
      description={query.data ? `Newest first · showing ${Math.min(query.data.rows.length, query.data.total)} of ${query.data.total.toLocaleString('en-GB')}` : undefined}
      actions={<Button variant="ghost" size="sm" disabled={!query.data?.total} onClick={async () => {
        const all = (await fetchAll()) as { rows: IssueReading[] };
        downloadCsv(`${filename}.csv`, all.rows.map(({ id: _id, ...r }) => r));
      }}><Download aria-hidden />Download</Button>}
    >
      <WidgetState query={query} height="h-56">
        {() => <DataTable caption={title} columns={columns} rows={query.data!.rows} getRowKey={(r) => r.id} headerTone="strong" dense maxHeight={240} />}
      </WidgetState>
    </PanelCard>
  );
}
