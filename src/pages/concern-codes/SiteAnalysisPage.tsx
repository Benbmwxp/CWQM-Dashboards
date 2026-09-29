import { useNavigate, useSearch } from '@tanstack/react-router';
import { ArrowDown, ArrowUp, Database, FileText, List } from 'lucide-react';
import {
  Card, ColumnChart, DataTable, DeltaIndicator, DonutChart, GroupedBarChart, KeyInsight, KpiTile, LegendItem, PageHeader, PanelCard,
  SegmentedControl, SelectField, TextLink, tv, type Column,
} from '@severn-trent/cwqm-design-system';
import type { ConcernInstance, ConcernSummary, Flow } from '../../api/contract';
import { useAccess } from '../../auth/useAccess';
import { useConcernInstances, useConcernSummary, useParameters } from '../../api/queries';
import { HeaderActions } from '../../layout/HeaderActions';
import { FullPageMessage } from '../../layout/FullPageMessage';
import { QualityFilters } from '../../components/QualityFilters';
import { SectionTabs } from '../../components/SectionTabs';
import { WidgetState } from '../../components/WidgetState';
import { AccessError, accessErrorOf } from '../../components/AccessError';
import { downloadCsv } from '../../lib/csv';
import { fmtDateTime } from '../../lib/format';
import { niceAxis } from '../../lib/scale';
import { resolveDates, str, validateQualitySearch, type QualitySearch } from '../../lib/qualitySearch';
import { useSiteChoice } from '../../lib/useSiteChoice';

export interface AnalysisSearch extends QualitySearch { code?: string; view?: 'single'; up?: string; down?: string }

export const validateAnalysisSearch = (s: Record<string, unknown>): AnalysisSearch => ({
  ...validateQualitySearch(s),
  code: s.code === 'Flatline' || s.code === 'Impossible value' ? s.code : undefined,
  view: s.view === 'single' ? 'single' : undefined,
  up: str(s.up), down: str(s.down),
});

const FLOW_COLOUR: Record<Flow, string> = { upstream: tv('color.data.flow.upstream'), downstream: tv('color.data.flow.downstream') };
const pct1 = (n: number, of: number) => (of ? `${((n / of) * 100).toFixed(1)}%` : '0%');

export function ConcernSiteAnalysisPage() {
  const search = useSearch({ from: '/concern-codes/site-analysis' });
  const navigate = useNavigate({ from: '/concern-codes/site-analysis' });
  const set = (patch: Partial<AnalysisSearch>) => navigate({ search: (prev) => ({ ...prev, ...patch }) });
  const { canPage, can } = useAccess();
  const parameters = useParameters();
  const { sites, site, name } = useSiteChoice(search.site);
  const dates = resolveDates(search);
  const w = (id: string) => can('concern-codes-analysis', id);
  const show = { kpis: w('kpis'), charts: w('charts'), codes: w('ec-codes'), latest: w('latest'), insight: w('insight') };
  const base = { site, parameter: search.parameter, code: search.code, ...dates };

  const summary = useConcernSummary(base, Boolean(site) && (show.kpis || show.charts || show.codes || show.insight));
  const latest = (flow: Flow) => ({ ...base, flow, sort: 't' as const, dir: 'desc' as const, page: 1, pageSize: 4 });
  const upLatest = useConcernInstances(latest('upstream'), Boolean(site) && show.latest);
  const downLatest = useConcernInstances(latest('downstream'), Boolean(site) && show.latest);

  if (!canPage('concern-codes-analysis')) return <FullPageMessage title="No access" text="Your groups don't include Concern Codes - Site Analysis." />;
  const denied = accessErrorOf(summary.error, upLatest.error);

  const toInstances = () => navigate({ to: '/concern-codes', search: { site, parameter: search.parameter, code: search.code, from: dates.from, to: dates.to } });
  const exportCsv = () => summary.data && downloadCsv(`concern-codes-by-site-${site}-${dates.from}-to-${dates.to}.csv`,
    summary.data.byPointCode.map((r) => ({ site: r.point, location: r.flow, data_stream: r.parameter, code: r.code, instances: r.count, share_of_total: pct1(r.count, summary.data!.total) })));

  return (
    <div className="space-y-lg">
      <PageHeader
        breadcrumb={[{ label: 'CWQM', href: '/cwqm' }, { label: 'Concern Codes', href: '/concern-codes' }, { label: 'Site analysis' }]}
        title="CWQM: Concern Codes - Site Analysis"
        subtitle="Analyse and investigate concern code instances by parameter for upstream and downstream locations."
        actions={<HeaderActions period={dates} onExport={show.codes ? exportCsv : undefined} exportDisabled={!summary.data} />}
      />
      <SectionTabs current="concern-codes-analysis" />

      <div className="grid gap-lg 2xl:grid-cols-[minmax(0,1fr)_auto]">
        <QualityFilters
          site={{ sites, value: site, onChange: (s) => s && set({ site: s }) }}
          parameter={{ parameters: parameters.data ?? [], value: search.parameter, onChange: (parameter) => set({ parameter, up: undefined, down: undefined }) }}
          dates={{ ...dates, onChange: (r) => set(r) }}
          code={{ value: search.code, onChange: (code) => set({ code }) }}
        />
        {show.charts && (
          <Card className="flex flex-col justify-center gap-2xs p-md">
            <p className="text-sm font-semibold text-content-accent">View by</p>
            <SegmentedControl label="View by" appearance="separate" value={search.view === 'single' ? 'single' : 'split'}
              options={[{ value: 'split', label: 'Up & Down Stream' }, { value: 'single', label: 'Single Chart' }]}
              onChange={(v) => set({ view: v === 'single' ? 'single' : undefined })} />
          </Card>
        )}
      </div>

      {denied ? <AccessError error={denied} onReset={() => navigate({ search: {} })} /> : (
        <>
          {show.kpis && <WidgetState query={summary} height="h-32">{() => <Kpis s={summary.data!} />}</WidgetState>}

          {show.charts && (
            <WidgetState query={summary} height="h-80">
              {() => search.view === 'single'
                ? <SingleChart s={summary.data!} parameter={search.parameter} />
                : (
                  <div className="grid gap-lg 2xl:grid-cols-2">
                    {(['upstream', 'downstream'] as Flow[]).map((flow) => (
                      <FlowChart key={flow} s={summary.data!} flow={flow} parameters={search.parameter ? [search.parameter] : parameters.data ?? []}
                        value={(flow === 'upstream' ? search.up : search.down) ?? search.parameter ?? ''}
                        onChange={(v) => set(flow === 'upstream' ? { up: v || undefined } : { down: v || undefined })} />
                    ))}
                  </div>
                )}
            </WidgetState>
          )}

          {(show.codes || show.latest || show.insight) && (
            <div className="grid items-start gap-lg 2xl:grid-cols-2">
              {(show.codes || show.insight) && (
                <div className="space-y-lg">
                  {show.codes && (
                    <PanelCard icon={<List />} iconVariant="solid" title="E&C Codes - Instances" titleSuffix="(in the selected filters)">
                      <WidgetState query={summary} height="h-56">{() => <EcCodes s={summary.data!} />}</WidgetState>
                    </PanelCard>
                  )}
                  {show.insight && <WidgetState query={summary} height="h-32">{() => <Insight s={summary.data!} site={name} parameter={search.parameter} />}</WidgetState>}
                </div>
              )}
              {show.latest && (
                <div className="space-y-lg">
                  <Latest title="Upstream Instances (Latest)" icon={<ArrowUp />} query={upLatest} onAll={canPage('concern-codes') ? toInstances : undefined} />
                  <Latest title="Downstream Instances (Latest)" icon={<ArrowDown />} query={downLatest} onAll={canPage('concern-codes') ? toInstances : undefined} />
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Kpis({ s }: { s: ConcernSummary }) {
  const d = (v: number | null) => (v === null ? 'No earlier data' : <DeltaIndicator value={v} higherIsBetter={false} comparison="vs previous period" layout="stacked" />);
  const top = s.codes[0];
  return (
    <section aria-label="Totals" className="grid gap-lg sm:grid-cols-2 2xl:grid-cols-4">
      <KpiTile icon={<Database />} tone="blue" label="Total Instances" eyebrow="(in selected filters)" value={s.total.toLocaleString('en-GB')} detail={d(s.change)} />
      <KpiTile icon={<ArrowUp />} tone="purple" label="Upstream Instances" value={s.byFlow.upstream.count.toLocaleString('en-GB')} detail={d(s.byFlow.upstream.change)} />
      <KpiTile icon={<ArrowDown />} tone="teal" label="Downstream Instances" value={s.byFlow.downstream.count.toLocaleString('en-GB')} detail={d(s.byFlow.downstream.change)} />
      <KpiTile icon={<FileText />} tone="purple" label="Most Frequent Code" value={top?.code ?? 'None'}
        detail={top ? `${top.count.toLocaleString('en-GB')} instances (${pct1(top.count, s.total)} of filtered data)` : 'No instances in this period'} />
    </section>
  );
}

const bucketTotal = (b: ConcernSummary['buckets'][number], flow: Flow, param?: string) =>
  param ? b.counts[flow][param] ?? 0 : Object.values(b.counts[flow]).reduce((a, n) => a + n, 0);

function FlowChart({ s, flow, parameters, value, onChange }: { s: ConcernSummary; flow: Flow; parameters: string[]; value: string; onChange: (v: string) => void }) {
  const title = `${flow === 'upstream' ? 'Upstream' : 'Downstream'} - Instances by Parameter`;
  const data = s.buckets.map((b) => ({ label: b.label, value: bucketTotal(b, flow, value || undefined) }));
  const axis = niceAxis(data.map((d) => d.value));
  return (
    <PanelCard icon={flow === 'upstream' ? <ArrowUp /> : <ArrowDown />} iconTone={flow === 'upstream' ? 'teal' : 'purple'} iconVariant="solid" title={title}
      actions={<label className="flex items-center gap-xs text-sm text-content-subtle">Parameter
        <SelectField size="sm" className="w-48" value={value} onChange={(e) => onChange(e.target.value)} options={[{ value: '', label: 'All parameters' }, ...parameters]} /></label>}>
      <ColumnChart label={title} data={data} colour={FLOW_COLOUR[flow]} seriesLabel={value || 'All parameters'} yLabel="No. of Instances" yDomain={axis.domain} yTicks={axis.ticks} />
    </PanelCard>
  );
}

function SingleChart({ s, parameter }: { s: ConcernSummary; parameter?: string }) {
  const data = s.buckets.map((b) => ({ label: b.label, upstream: bucketTotal(b, 'upstream', parameter), downstream: bucketTotal(b, 'downstream', parameter) }));
  const axis = niceAxis(data.flatMap((d) => [d.upstream, d.downstream]));
  return (
    <PanelCard icon={<Database />} title="Upstream and Downstream - Instances over Time" description={parameter ?? 'All parameters'}>
      <GroupedBarChart label="Instances upstream and downstream over time" data={data} xKey="label" yLabel="No. of Instances" yDomain={axis.domain} yTicks={axis.ticks}
        series={[{ key: 'upstream', label: 'Upstream', colour: FLOW_COLOUR.upstream }, { key: 'downstream', label: 'Downstream', colour: FLOW_COLOUR.downstream }]} />
    </PanelCard>
  );
}

function EcCodes({ s }: { s: ConcernSummary }) {
  type Row = ConcernSummary['byPointCode'][number];
  const columns: Column<Row>[] = [
    { key: 'point', header: 'Site', rowHeader: true },
    { key: 'parameter', header: 'Data Stream' },
    { key: 'code', header: 'Code Name' },
    { key: 'count', header: 'No. of Instances', align: 'center', highlight: true, render: (r) => r.count.toLocaleString('en-GB') },
    { key: 'share', header: '% of Total', align: 'center', render: (r) => pct1(r.count, s.total) },
  ];
  const up = s.byFlow.upstream.count, down = s.byFlow.downstream.count;
  if (!s.total) return <p className="py-xl text-center text-content-subtle">No concern codes in the selected filters.</p>;
  return (
    <div className="space-y-lg">
      <div>
        <DataTable caption="Concern code instances by site and data stream" columns={columns} rows={s.byPointCode} getRowKey={(r) => `${r.point}|${r.parameter}|${r.code}`} dense striped={false} maxHeight={260} />
        <div className="flex justify-between px-sm pt-sm text-lg font-bold text-content-default"><span>Total</span><span className="tabular">{s.total.toLocaleString('en-GB')} · 100%</span></div>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-xl">
        <DonutChart label="Upstream and downstream share of instances" size={170} thickness={20}
          segments={[{ label: 'Upstream', value: up, colour: FLOW_COLOUR.upstream }, { label: 'Downstream', value: down, colour: FLOW_COLOUR.downstream }]}
          centre={<><span className="tabular text-3xl font-extrabold text-content-heading">{s.total.toLocaleString('en-GB')}</span><span className="text-sm leading-tight text-content-subtle">Total<br />instances</span></>} />
        <ul className="w-56 space-y-2xs">
          <li><LegendItem colour={FLOW_COLOUR.upstream} label="Upstream" value={`${up} (${pct1(up, s.total)})`} /></li>
          <li><LegendItem colour={FLOW_COLOUR.downstream} label="Downstream" value={`${down} (${pct1(down, s.total)})`} /></li>
        </ul>
      </div>
    </div>
  );
}

function Insight({ s, site, parameter }: { s: ConcernSummary; site: string; parameter?: string }) {
  if (!s.total) return <KeyInsight>No concern codes were raised{parameter ? ` for ${parameter}` : ''} at {site} in the selected period.</KeyInsight>;
  const up = s.byFlow.upstream.count, down = s.byFlow.downstream.count;
  const [hi, lo] = up >= down ? ['upstream', 'downstream'] : ['downstream', 'upstream'];
  return (
    <KeyInsight>
      {s.codes[0].code} is the most frequent concern code{parameter ? ` for ${parameter}` : ''} at {site}, with {up === down ? 'equal instances upstream and downstream' : <>higher instances {hi} ({pct1(Math.max(up, down), s.total)}) compared to {lo} ({pct1(Math.min(up, down), s.total)})</>} in the selected period.
    </KeyInsight>
  );
}

function Latest({ title, icon, query, onAll }: { title: string; icon: JSX.Element; query: ReturnType<typeof useConcernInstances>; onAll?: () => void }) {
  const columns: Column<ConcernInstance>[] = [
    { key: 'point', header: 'Site', rowHeader: true },
    { key: 'parameter', header: 'Data Stream' },
    { key: 'code', header: 'Code Name' },
    { key: 'value', header: 'Value', highlight: true, render: (r) => String(r.value) },
    { key: 't', header: 'Phenomenon Time', render: (r) => fmtDateTime(r.t) },
  ];
  return (
    <PanelCard icon={icon} title={title} description={query.data ? `${query.data.total.toLocaleString('en-GB')} in total` : undefined}
      actions={onAll && <TextLink href="#" onClick={(e) => { e.preventDefault(); onAll(); }}>View all</TextLink>}>
      <WidgetState query={query} height="h-48">
        {() => <DataTable caption={title} columns={columns} rows={query.data!.rows} getRowKey={(r) => r.id} dense />}
      </WidgetState>
    </PanelCard>
  );
}
