import { useNavigate, useSearch } from '@tanstack/react-router';
import { ArrowDown, ArrowUp, BarChart3, CalendarDays, CalendarRange, CircleCheck, Clock, TriangleAlert } from 'lucide-react';
import {
  DataTable, GroupedBarChart, InfoCallout, KpiTile, PageHeader, PanelCard, parameterColour, PeriodChip, ProgressBar, TextLink, tv, type Column,
} from '@severn-trent/cwqm-design-system';
import type { IssueReading, MissingSummary, SiteAverage } from '../../api/contract';
import { useAccess } from '../../auth/useAccess';
import { useIssueReadings, useMissingSummary, useParameters, useSiteAverages } from '../../api/queries';
import { HeaderActions } from '../../layout/HeaderActions';
import { FullPageMessage } from '../../layout/FullPageMessage';
import { QualityFilters } from '../../components/QualityFilters';
import { SectionTabs } from '../../components/SectionTabs';
import { WidgetState } from '../../components/WidgetState';
import { AccessError, accessErrorOf } from '../../components/AccessError';
import { downloadCsv } from '../../lib/csv';
import { daysBetween } from '../../lib/dates';
import { fmtDateTime, fmtDay } from '../../lib/format';
import { resolveDates, validateQualitySearch, type QualitySearch } from '../../lib/qualitySearch';
import { useSiteChoice } from '../../lib/useSiteChoice';

export const validateMissingSearch = (s: Record<string, unknown>): QualitySearch => validateQualitySearch(s);

const pctText = (v: number) => `${v.toFixed(1)}%`;
const shortDay = (ymd: string) => new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' }).format(new Date(`${ymd}T00:00:00Z`));

export function MissingDataPage() {
  const search = useSearch({ from: '/operability/missing-data' });
  const navigate = useNavigate({ from: '/operability/missing-data' });
  const set = (patch: Partial<QualitySearch>) => navigate({ search: (prev) => ({ ...prev, ...patch }) });
  const { canPage, can } = useAccess();
  const parameters = useParameters();
  const { sites, site, name, ready } = useSiteChoice(search.site);
  const dates = resolveDates(search);
  const query = { site, parameter: search.parameter, ...dates };
  const w = (id: string) => can('missing-data', id);
  const show = { kpis: w('kpis'), charts: w('daily-charts'), sites: w('site-averages'), params: w('parameter-availability'), readings: w('missing-readings') };

  const summary = useMissingSummary(query, ready && (show.kpis || show.charts || show.params));
  const averages = useSiteAverages(query, show.sites);
  const upMissing = useIssueReadings({ ...query, flow: 'upstream', codes: 'missing', limit: 50 }, ready && show.readings);
  const downMissing = useIssueReadings({ ...query, flow: 'downstream', codes: 'missing', limit: 50 }, ready && show.readings);

  if (!canPage('missing-data')) return <FullPageMessage title="No access" text="Your groups don't include Missing Data." />;
  const denied = accessErrorOf(summary.error, averages.error, upMissing.error);
  const days = daysBetween(dates.from, dates.to);

  const exportCsv = () => summary.data && downloadCsv(`missing-data-${site}-${dates.from}-to-${dates.to}.csv`,
    summary.data.daily.flatMap((d) => d.days.flatMap((day) => summary.data!.parameters.map((p) => ({
      site: d.point.name, day: day.day, parameter: p, expected: day.expectedPerParameter, available: day.available[p], missing: day.expectedPerParameter - day.available[p],
    })))));

  return (
    <div className="space-y-lg">
      <PageHeader
        breadcrumb={[{ label: 'CWQM', href: '/cwqm' }, { label: 'Operability', href: '/operability' }, { label: 'Missing data' }]}
        title="Missing Data - Available vs Expected"
        subtitle="Compare available and expected telemetry data to identify potential data gaps across sites and parameters."
        actions={
          <>
            <PeriodChip icon={<Clock />} label="Telemetry data available through" value={fmtDateTime(new Date(Math.floor(Date.now() / 900_000) * 900_000).toISOString())} />
            <HeaderActions onExport={show.charts ? exportCsv : undefined} exportDisabled={!summary.data} />
          </>
        }
      />
      <SectionTabs current="missing-data" />

      <div className="grid gap-lg xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <QualityFilters
          site={{ sites, value: site, onChange: (s) => s && set({ site: s }) }}
          parameter={{ parameters: parameters.data ?? [], value: search.parameter, onChange: (parameter) => set({ parameter }) }}
          dates={{ ...dates, onChange: (r) => set(r) }}
        />
        <InfoCallout>
          <strong>Note:</strong> Visuals on this page reflect the selected site, parameter(s) and date period. Exception: the Site-Level Average % table always shows all sites, to help spot sites with concerns.
        </InfoCallout>
      </div>

      {denied ? <AccessError error={denied} onReset={() => navigate({ search: {} })} /> : (
        <>
          {show.kpis && (
            <WidgetState query={summary} height="h-32">
              {() => {
                const t = summary.data!.totals;
                const availability = t.expected ? (t.available / t.expected) * 100 : 0;
                return (
                  <section aria-label="Totals" className="grid gap-lg sm:grid-cols-2 2xl:grid-cols-4">
                    <KpiTile icon={<BarChart3 />} tone="blue" label="Total Expected Readings" value={t.expected.toLocaleString('en-GB')} detail={`Across ${summary.data!.parameters.length} parameter${summary.data!.parameters.length === 1 ? '' : 's'} (${name})`} />
                    <KpiTile icon={<CircleCheck />} tone="teal" label="Total Available Readings" value={t.available.toLocaleString('en-GB')}
                      detail={<span><span className={`font-semibold ${availability >= 95 ? 'text-feedback-positive' : 'text-feedback-negative'}`}>{pctText(availability)}</span> availability</span>} />
                    <KpiTile icon={<TriangleAlert />} tone="red" label="Total Missing Readings" value={t.missing.toLocaleString('en-GB')}
                      detail={<span><span className="font-semibold text-feedback-negative">{pctText(100 - availability)}</span> missing</span>} />
                    <KpiTile icon={<CalendarDays />} tone="blue" label="Date Range" value={<span className="text-2xl">{fmtDay(dates.from)} - {fmtDay(dates.to)}</span>} detail={`${days} day${days === 1 ? '' : 's'} (15-minute data)`} />
                  </section>
                );
              }}
            </WidgetState>
          )}

          {show.charts && (
            <WidgetState query={summary} height="h-80">
              {() => (
                <div className="grid gap-lg 2xl:grid-cols-2">
                  {summary.data!.daily.map((d) => <DailyChart key={d.point.id} data={d} parameters={summary.data!.parameters} onDetails={() => navigate({ to: '/operability/trend', search: { site, parameter: search.parameter, ...dates } })} />)}
                </div>
              )}
            </WidgetState>
          )}

          {(show.sites || show.params || show.readings) && (
            <div className="grid items-start gap-lg xl:grid-cols-2">
              {show.sites && (
                <PanelCard icon={<BarChart3 />} title="Site-Level Average %" description="(Each site value is averaged across the selected parameter(s) and date period.)">
                  <WidgetState query={averages} height="h-80">{() => <SiteAverages rows={averages.data!} />}</WidgetState>
                </PanelCard>
              )}
              {show.params && (
                <PanelCard icon={<CalendarRange />} title="Available vs Missing Data %" titleSuffix="(By Parameter)" description={name}>
                  <WidgetState query={summary} height="h-80">{() => <ByParameter rows={summary.data!.byParameter} />}</WidgetState>
                </PanelCard>
              )}
              {show.readings && (
                <div className="grid gap-lg xl:col-span-2 xl:grid-cols-2">
                  <MissingReadings title="Missing Readings - Upstream" icon={<ArrowUp />} query={upMissing} />
                  <MissingReadings title="Missing Readings - Downstream" icon={<ArrowDown />} query={downMissing} />
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function DailyChart({ data, parameters, onDetails }: { data: MissingSummary['daily'][number]; parameters: string[]; onDetails: () => void }) {
  const expected = data.days[0]?.expectedPerParameter ?? 96;
  const rows = data.days.map((d) => ({ d: shortDay(d.day), ...d.available }));
  const top = Math.ceil((expected * 1.2) / 20) * 20;
  const axis = { domain: [0, top] as [number, number], ticks: Array.from({ length: top / 20 + 1 }, (_, i) => i * 20) };
  return (
    <PanelCard icon={<BarChart3 />} title={`${data.point.name} : Available vs Expected Readings`}
      description={`Readings received per parameter per day. A full day is ${expected} readings; today is counted so far.`}
      actions={<TextLink onClick={(e) => { e.preventDefault(); onDetails(); }}>View details</TextLink>}>
      {rows.length ? (
        <GroupedBarChart label={`${data.point.name} available readings per day by parameter`} data={rows} xKey="d"
          series={parameters.map((p) => ({ key: p, label: p, colour: parameterColour(p) }))}
          yLabel="Readings" yDomain={axis.domain} yTicks={axis.ticks} showValues={rows.length <= 7} />
      ) : <p className="py-2xl text-center text-content-subtle">No readings expected in this period yet.</p>}
    </PanelCard>
  );
}

const availabilityCell = (v: number, missing = false) => (
  <div className="flex items-center gap-sm">
    <span className={`tabular w-14 shrink-0 font-semibold ${missing ? (v > 0 ? 'text-feedback-negative' : 'text-feedback-positive') : v >= 95 ? 'text-feedback-positive' : 'text-feedback-negative'}`}>{pctText(v)}</span>
    <ProgressBar label={`${missing ? 'Missing' : 'Available'} ${pctText(v)}`} value={v} className="min-w-12"
      colour={tv(missing ? 'color.data.missing' : v >= 95 ? 'color.data.band.70' : 'color.data.missing')}
      track={tv(missing ? 'color.data.missing-track' : 'color.data.track')} />
  </div>
);

function SiteAverages({ rows }: { rows: SiteAverage[] }) {
  const columns: Column<SiteAverage>[] = [
    { key: 'site', header: 'Site', rowHeader: true, sortable: true, sortValue: (r) => r.point.name, render: (r) => r.point.name },
    { key: 'available', header: 'Available %', sortable: true, render: (r) => availabilityCell(r.available) },
    { key: 'missing', header: 'Missing %', sortable: true, render: (r) => <span className={`tabular font-semibold ${r.missing > 0 ? 'text-feedback-negative' : 'text-feedback-positive'}`}>{pctText(r.missing)}</span> },
  ];
  return <DataTable caption="Availability by site, worst first" columns={columns} rows={rows} getRowKey={(r) => r.point.id} dense maxHeight={460} />;
}

function ByParameter({ rows }: { rows: MissingSummary['byParameter'] }) {
  type Row = MissingSummary['byParameter'][number];
  const columns: Column<Row>[] = [
    { key: 'parameter', header: 'Parameter', rowHeader: true },
    { key: 'available', header: 'Available %', render: (r) => (
      <div className="flex items-center gap-sm"><span className="tabular w-14">{pctText(r.available)}</span><ProgressBar label={`Available ${pctText(r.available)}`} value={r.available} className="min-w-12" /></div>
    ) },
    { key: 'missing', header: 'Missing %', render: (r) => availabilityCell(r.missing, true) },
  ];
  return <DataTable caption="Availability by parameter" columns={columns} rows={rows} getRowKey={(r) => r.parameter} dense />;
}

function MissingReadings({ title, icon, query }: { title: string; icon: JSX.Element; query: ReturnType<typeof useIssueReadings> }) {
  const columns: Column<IssueReading>[] = [
    { key: 'point', header: 'Site', rowHeader: true },
    { key: 'parameter', header: 'Parameter' },
    { key: 't', header: 'Missing Reading', render: (r) => fmtDateTime(r.t) },
  ];
  return (
    <PanelCard icon={icon} title={title} description={query.data ? `Newest first · ${query.data.total.toLocaleString('en-GB')} in total` : undefined}>
      <WidgetState query={query} height="h-48">
        {() => <DataTable caption={title} columns={columns} rows={query.data!.rows} getRowKey={(r) => r.id} dense maxHeight={210} />}
      </WidgetState>
    </PanelCard>
  );
}
