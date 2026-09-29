import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { BarChart3, Clock, Download, FileText, Filter, MapPin, TriangleAlert, X } from 'lucide-react';
import {
  ActionList, Button, Card, CountBadge, DeltaIndicator, FormField, IconButton, Input, KeyInsight, KpiTile, PageHeader, PanelCard,
  SearchField, SegmentedControl, SelectField, TextLink,
} from '@severn-trent/cwqm-design-system';
import type { ConcernInstance, ConcernQuery, ConcernSummary } from '../../api/contract';
import { useAccess } from '../../auth/useAccess';
import { useConcernInstances, useConcernSummary, useParameters } from '../../api/queries';
import { apiGet } from '../../api/client';
import { HeaderActions } from '../../layout/HeaderActions';
import { FullPageMessage } from '../../layout/FullPageMessage';
import { QualityFilters } from '../../components/QualityFilters';
import { SectionTabs } from '../../components/SectionTabs';
import { ServerTable, type ServerColumn } from '../../components/ServerTable';
import { CompactPagination } from '../../components/CompactPagination';
import { PriorityLabel } from '../../components/Priority';
import { WidgetState } from '../../components/WidgetState';
import { AccessError, accessErrorOf } from '../../components/AccessError';
import { downloadCsv } from '../../lib/csv';
import { addDays, daysBetween, isYmd, today } from '../../lib/dates';
import { fmtDateTime, fmtDay } from '../../lib/format';
import { resolveDates, str, validateQualitySearch, type QualitySearch } from '../../lib/qualitySearch';
import { useSiteChoice } from '../../lib/useSiteChoice';

const SORTS = ['point', 'parameter', 'priority', 'code', 'value', 't'] as const;

export interface InstancesSearch extends QualitySearch {
  code?: string; q?: string; priority?: string; min?: number; max?: number; tFrom?: string; tTo?: string;
  sort?: (typeof SORTS)[number]; dir?: 'asc' | 'desc'; page?: number; size?: number;
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v !== '' && Number.isFinite(Number(v)) ? Number(v) : undefined);

export const validateInstancesSearch = (s: Record<string, unknown>): InstancesSearch => ({
  ...validateQualitySearch(s),
  code: s.code === 'Flatline' || s.code === 'Impossible value' ? s.code : undefined,
  q: str(s.q),
  priority: ['High', 'Medium', 'Low'].includes(s.priority as string) ? (s.priority as string) : undefined,
  min: num(s.min), max: num(s.max),
  tFrom: isYmd(s.tFrom) ? s.tFrom : undefined, tTo: isYmd(s.tTo) ? s.tTo : undefined,
  sort: SORTS.includes(s.sort as (typeof SORTS)[number]) ? (s.sort as (typeof SORTS)[number]) : undefined,
  dir: s.dir === 'asc' ? 'asc' : s.dir === 'desc' ? 'desc' : undefined,
  page: num(s.page), size: [25, 50, 100].includes(num(s.size) ?? 0) ? num(s.size) : undefined,
});

export function ConcernInstancesPage() {
  const search = useSearch({ from: '/concern-codes' });
  const navigate = useNavigate({ from: '/concern-codes' });
  const set = (patch: Partial<InstancesSearch>, resetPage = true) => navigate({ search: (prev) => ({ ...prev, ...patch, ...(resetPage ? { page: undefined } : {}) }) });
  const { canPage, can } = useAccess();
  const parameters = useParameters();
  const { sites, site, name } = useSiteChoice(search.site);
  const dates = resolveDates(search, 7);
  const show = { kpis: can('concern-codes', 'kpis'), table: can('concern-codes', 'instances'), refine: can('concern-codes', 'refine'), insight: can('concern-codes', 'insight') };

  const base = { site: search.site === undefined ? site : search.site, parameter: search.parameter, code: search.code, ...dates };
  const query: ConcernQuery = {
    ...base, q: search.q, priority: search.priority, min: search.min, max: search.max, tFrom: search.tFrom, tTo: search.tTo,
    sort: search.sort ?? 't', dir: search.dir ?? 'desc', page: search.page ?? 1, pageSize: search.size ?? 25,
  };
  const summary = useConcernSummary(base, Boolean(base.site) && (show.kpis || show.insight));
  const instances = useConcernInstances(query, Boolean(base.site) && show.table);
  const refineRef = useRef<HTMLDivElement>(null);
  const [detail, setDetail] = useState<ConcernInstance | null>(null);

  if (!canPage('concern-codes')) return <FullPageMessage title="No access" text="Your groups don't include Concern Codes Data." />;
  const denied = accessErrorOf(summary.error, instances.error);
  const days = daysBetween(dates.from, dates.to);
  const quick = [7, 30, 90].find((d) => dates.to === today() && days === d);
  const refineCount = [search.priority, search.min, search.max, search.tFrom, search.tTo].filter((v) => v !== undefined).length + (search.parameter ? 1 : 0);

  const exportAll = async () => {
    const all = await apiGet<{ rows: ConcernInstance[] }>('/concern-codes/instances', clean({ ...query, page: 1, pageSize: 5000 }));
    downloadCsv(`concern-codes-${dates.from}-to-${dates.to}.csv`, all.rows.map(({ id: _id, site: _s, ...r }) => r));
  };
  const toAnalysis = () => navigate({ to: '/concern-codes/site-analysis', search: { site: base.site, parameter: search.parameter, code: search.code, from: dates.from, to: dates.to } });

  return (
    <div className="space-y-lg">
      <PageHeader
        breadcrumb={[{ label: 'CWQM', href: '/cwqm' }, { label: 'Concern Codes' }]}
        title="CWQM: Concern Codes Data"
        subtitle="View, filter and explore all concern code instances for the selected site, parameter and date range."
        actions={<HeaderActions onExport={show.table ? exportAll : undefined} exportDisabled={!instances.data?.total} />}
      />
      <SectionTabs current="concern-codes" />

      <div className="grid gap-lg 2xl:grid-cols-[minmax(0,1fr)_auto]">
        <QualityFilters
          site={{ sites, value: base.site, onChange: (s) => set({ site: s }), allowAll: false }}
          parameter={{ parameters: parameters.data ?? [], value: search.parameter, onChange: (parameter) => set({ parameter }) }}
          dates={{ ...dates, onChange: (r) => set(r) }}
          code={{ value: search.code, onChange: (code) => set({ code }) }}
        />
        <Card className="flex flex-col justify-center gap-2xs p-md">
          <p className="text-sm font-semibold text-content-accent">Quick filters</p>
          <SegmentedControl label="Quick filters" appearance="separate" value={quick ? String(quick) : ''}
            options={[{ value: '7', label: 'Last 7 days' }, { value: '30', label: 'Last 30 days' }, { value: '90', label: 'Last 90 days' }]}
            onChange={(d) => set({ to: today(), from: addDays(today(), -(Number(d) - 1)) })} />
        </Card>
      </div>

      {denied ? <AccessError error={denied} onReset={() => navigate({ search: {} })} /> : (
        <>
          {show.kpis && (
            <WidgetState query={summary} height="h-32">{() => <Kpis s={summary.data!} dates={dates} days={days} />}</WidgetState>
          )}

          <div className={show.table && (show.refine || show.insight) ? 'grid items-start gap-lg 2xl:grid-cols-[minmax(0,1fr)_380px]' : 'grid gap-lg'}>
            {show.table && (
              <PanelCard
                title="Concern Code Instances"
                description={instances.data ? `Showing ${instances.data.total ? (instances.data.page - 1) * instances.data.pageSize + 1 : 0}–${Math.min(instances.data.page * instances.data.pageSize, instances.data.total)} of ${instances.data.total.toLocaleString('en-GB')} instances` : 'Loading…'}
                actions={
                  <>
                    <DebouncedSearch value={search.q ?? ''} onChange={(q) => set({ q: q || undefined })} />
                    {show.refine && (
                      <Button variant="secondary" onClick={() => { refineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); refineRef.current?.querySelector('select')?.focus(); }}>
                        <Filter aria-hidden />Filters{refineCount > 0 && <CountBadge count={refineCount} label="filters applied" />}
                      </Button>
                    )}
                  </>
                }
              >
                <WidgetState query={instances} height="h-[640px]">
                  {() => (
                    <>
                      <ServerTable
                        caption="Concern code instances" rows={instances.data!.rows} getRowKey={(r) => r.id} maxHeight={640}
                        sort={query.sort} dir={query.dir} onSort={(sort, dir) => set({ sort: sort as InstancesSearch['sort'], dir })}
                        onRowAction={setDetail} rowActionLabel={(r) => `Details for ${r.point} ${r.parameter} at ${fmtDateTime(r.t)}`}
                        columns={columns}
                      />
                      <CompactPagination className="mt-md" page={instances.data!.page} pageSize={instances.data!.pageSize} total={instances.data!.total}
                        pageSizes={[25, 50, 100]} onPageChange={(page) => set({ page }, false)} onPageSizeChange={(size) => set({ size })} />
                    </>
                  )}
                </WidgetState>
              </PanelCard>
            )}

            {(show.refine || show.insight) && (
              <div className={show.table ? 'space-y-lg' : 'grid gap-lg lg:grid-cols-2'}>
                {show.refine && (
                  <div ref={refineRef}>
                    <Refine key={JSON.stringify([search.priority, search.parameter, search.min, search.max, search.tFrom, search.tTo])} search={search} parameters={parameters.data ?? []} onApply={(v) => set(v)} />
                  </div>
                )}
                {show.insight && (
                  <WidgetState query={summary} height="h-40">
                    {() => <Insight s={summary.data!} site={name} onAnalysis={toAnalysis} />}
                  </WidgetState>
                )}
                <ActionList title="Useful Actions" actions={[
                  ...(show.table ? [{ icon: <Download />, label: 'Export filtered data', onClick: (e?: unknown) => { (e as Event | undefined)?.preventDefault?.(); exportAll(); } }] : []),
                  ...(canPage('concern-codes-analysis') ? [{ icon: <BarChart3 />, label: 'View site comparison', onClick: (e?: unknown) => { (e as Event | undefined)?.preventDefault?.(); toAnalysis(); } }] : []),
                ]} />
              </div>
            )}
          </div>
        </>
      )}
      <DetailDialog instance={detail} onClose={() => setDetail(null)} onTrend={(i) => navigate({ to: '/operability/trend', search: { site: i.site, parameter: i.parameter, from: i.t.slice(0, 10), to: i.t.slice(0, 10) } })} />
    </div>
  );
}

const clean = (o: object) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== '')) as Record<string, string | number>;

const columns: ServerColumn<ConcernInstance>[] = [
  { key: 'point', header: 'Site', sortKey: 'point', rowHeader: true, render: (r) => r.point },
  { key: 'parameter', header: 'Data Stream', sortKey: 'parameter', render: (r) => r.parameter },
  { key: 'priority', header: 'Priority', sortKey: 'priority', render: (r) => <PriorityLabel priority={r.priority} /> },
  { key: 'code', header: 'Code Name', sortKey: 'code', render: (r) => r.code },
  { key: 'value', header: 'Value', sortKey: 'value', highlight: true, render: (r) => String(r.value) },
  { key: 't', header: 'Phenomenon Time', sortKey: 't', render: (r) => fmtDateTime(r.t) },
];

function Kpis({ s, dates, days }: { s: ConcernSummary; dates: { from: string; to: string }; days: number }) {
  const pts = s.points.length > 3 ? `${s.points.slice(0, 3).join(', ')} +${s.points.length - 3} more` : s.points.join(', ') || 'None';
  return (
    <section aria-label="Totals" className="grid gap-lg sm:grid-cols-2 2xl:grid-cols-4">
      <KpiTile variant="tinted" icon={<FileText />} tone="blue" label="Total Instances" value={s.total.toLocaleString('en-GB')}
        detail={s.change === null ? 'No earlier data' : <DeltaIndicator value={s.change} higherIsBetter={false} comparison="vs previous period" layout="stacked" />} />
      <KpiTile variant="tinted" icon={<TriangleAlert />} tone="red" label="Unique Concern Codes" value={s.codes.length}
        detail={<span>{s.codes.map((c) => c.code).join(', ') || 'None'}<br />(in selected filters)</span>} />
      <KpiTile variant="tinted" icon={<MapPin />} tone="teal" label="Sites Affected" value={s.points.length} detail={pts} />
      <KpiTile variant="tinted" icon={<Clock />} tone="orange" label="Time Range" value={<span className="text-2xl">{fmtDay(dates.from)} - {fmtDay(dates.to)}</span>} detail={`${days} day${days === 1 ? '' : 's'}`} />
    </section>
  );
}

/** Search box that waits for a pause in typing before asking the server. */
function DebouncedSearch({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  useEffect(() => {
    if (text === value) return;
    const t = setTimeout(() => onChange(text), 350);
    return () => clearTimeout(t);
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps
  return <SearchField value={text} onChange={setText} placeholder="Search by site, parameter or code…" aria-label="Search instances" className="h-10 w-72" />;
}

function Refine({ search, parameters, onApply }: { search: InstancesSearch; parameters: string[]; onApply: (v: Partial<InstancesSearch>) => void }) {
  const [d, setD] = useState({
    priority: search.priority ?? '', parameter: search.parameter ?? '', min: search.min?.toString() ?? '', max: search.max?.toString() ?? '',
    tFrom: search.tFrom ?? '', tTo: search.tTo ?? '',
  });
  const invalid = (d.min && d.max && Number(d.min) > Number(d.max)) || (d.tFrom && d.tTo && d.tFrom > d.tTo);
  const apply = () => onApply({
    priority: d.priority || undefined, parameter: d.parameter || undefined, min: d.min === '' ? undefined : Number(d.min),
    max: d.max === '' ? undefined : Number(d.max), tFrom: d.tFrom || undefined, tTo: d.tTo || undefined,
  });
  return (
    <PanelCard title="Filter & Refine" actions={<TextLink arrow={false} href="#" onClick={(e) => { e.preventDefault(); onApply({ priority: undefined, parameter: undefined, min: undefined, max: undefined, tFrom: undefined, tTo: undefined }); }}>Clear all</TextLink>}>
      <form className="space-y-md" onSubmit={(e) => { e.preventDefault(); if (!invalid) apply(); }}>
        <FormField label="Priority"><SelectField value={d.priority} onChange={(e) => setD({ ...d, priority: e.target.value })} options={[{ value: '', label: 'All' }, 'High', 'Medium', 'Low']} /></FormField>
        <FormField label="Data Stream"><SelectField value={d.parameter} onChange={(e) => setD({ ...d, parameter: e.target.value })} options={[{ value: '', label: 'All' }, ...parameters]} /></FormField>
        <fieldset>
          <legend className="mb-2xs text-sm font-semibold text-content-accent">Value range</legend>
          <div className="flex items-center gap-xs">
            <Input aria-label="Minimum value" placeholder="Min" inputMode="decimal" value={d.min} onChange={(e) => setD({ ...d, min: e.target.value.replace(/[^\d.-]/g, '') })} />
            <span aria-hidden>–</span>
            <Input aria-label="Maximum value" placeholder="Max" inputMode="decimal" value={d.max} onChange={(e) => setD({ ...d, max: e.target.value.replace(/[^\d.-]/g, '') })} />
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-2xs text-sm font-semibold text-content-accent">Phenomenon Time</legend>
          <div className="flex items-center gap-xs">
            <Input type="date" aria-label="From date" value={d.tFrom} onChange={(e) => setD({ ...d, tFrom: e.target.value })} />
            <Input type="date" aria-label="To date" value={d.tTo} onChange={(e) => setD({ ...d, tTo: e.target.value })} />
          </div>
        </fieldset>
        {invalid && <p role="alert" className="text-sm text-feedback-negative">Check the ranges: the first value must be the smaller one.</p>}
        <Button type="submit" size="lg" block disabled={Boolean(invalid)}>Apply Filters</Button>
      </form>
    </PanelCard>
  );
}

function Insight({ s, site, onAnalysis }: { s: ConcernSummary; site: string; onAnalysis: () => void }) {
  if (!s.total) return <KeyInsight>No concern codes were raised at {site} in the selected period.</KeyInsight>;
  const top = s.codes[0];
  const days = s.busiestDays.map((d) => fmtDay(d.day));
  return (
    <KeyInsight action={<TextLink href="#" onClick={(e) => { e.preventDefault(); onAnalysis(); }}>View trend analysis</TextLink>}>
      {top.code} is {s.codes.length === 1 ? 'the only' : 'the most frequent'} concern code in the selected period, with {top.count.toLocaleString('en-GB')} instance{top.count === 1 ? '' : 's'} across {s.points.length} site location{s.points.length === 1 ? '' : 's'}.
      {days.length > 0 && <> Most instances occur on {days.join(' and ')}.</>}
    </KeyInsight>
  );
}

function DetailDialog({ instance, onClose, onTrend }: { instance: ConcernInstance | null; onClose: () => void; onTrend: (i: ConcernInstance) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (instance && !ref.current?.open) ref.current?.showModal(); }, [instance]);
  const rows = instance ? [
    ['Site', instance.point], ['Location', instance.flow === 'upstream' ? 'Upstream' : 'Downstream'], ['Data stream', instance.parameter],
    ['Concern code', instance.code], ['Priority', <PriorityLabel key="p" priority={instance.priority} />], ['Value', String(instance.value)], ['Phenomenon time', fmtDateTime(instance.t)],
  ] : [];
  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="instance-title"
      className="m-auto w-[min(32rem,92vw)] rounded-lg border border-line-default bg-surface-default p-0 text-content-default shadow-raised backdrop:bg-black/50">
      {instance && (
        <>
          <div className="flex items-center justify-between border-b border-line-default px-lg py-md">
            <h2 id="instance-title" className="text-xl font-bold text-content-accent">Concern code instance</h2>
            <form method="dialog"><IconButton aria-label="Close" size="sm"><X aria-hidden /></IconButton></form>
          </div>
          <dl className="grid grid-cols-[9rem_1fr] gap-x-md gap-y-xs px-lg py-md text-sm">
            {rows.map(([k, v]) => <div key={String(k)} className="contents"><dt className="text-content-muted">{k}</dt><dd className="font-semibold">{v}</dd></div>)}
          </dl>
          <p className="px-lg text-sm text-content-subtle">
            {instance.code === 'Flatline' ? 'The sensor reported the same value repeatedly, which usually means it is stuck or not sampling.' : 'The value is outside what is physically possible for this parameter, so it was rejected.'}
          </p>
          <div className="flex justify-end gap-sm px-lg py-md">
            <Button variant="secondary" onClick={() => ref.current?.close()}>Close</Button>
            <Button onClick={() => { ref.current?.close(); onTrend(instance); }}>View operability that day</Button>
          </div>
        </>
      )}
    </dialog>
  );
}
