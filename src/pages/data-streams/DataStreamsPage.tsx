import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { Button, FilterBar, FormField, Input, PageHeader, SearchField, SelectField } from '@severn-trent/cwqm-design-system';
import { useAccess } from '../../auth/useAccess';
import { usePairs, useSeries, useSites, useSummary } from '../../api/queries';
import { ApiError } from '../../api/client';
import type { DataStreamsQuery } from '../../api/contract';
import { daysBetween, rangeDates, type RangeKey } from '../../lib/dates';
import { fmtDateTime } from '../../lib/format';
import { HeaderActions } from '../../layout/HeaderActions';
import { FullPageMessage } from '../../layout/FullPageMessage';
import type { DataStreamsSearch } from './search';
import { KpiTiles } from './widgets/KpiTiles';
import { DualChart } from './widgets/DualChart';
import { KeyMetrics } from './widgets/KeyMetrics';
import { StreamComparison } from './widgets/StreamComparison';
import { Insights } from './widgets/Insights';

export { validateDataStreamsSearch } from './search';

const DEFAULT_PAIR = 'spconductivity~index-value';

export function DataStreamsPage() {
  const search = useSearch({ from: '/data-streams' });
  const navigate = useNavigate({ from: '/data-streams' });
  const { canPage, can } = useAccess();
  const sites = useSites();
  const pairs = usePairs();

  const siteList = sites.data ?? [];
  const site = search.site ?? (siteList.find((s) => s.id === 'littleaston') ?? siteList[0])?.id ?? '';
  const pairId = search.pair ?? DEFAULT_PAIR;
  const range: RangeKey = search.range ?? '7D';
  const dates = range === 'custom' && search.from && search.to ? { from: search.from, to: search.to } : rangeDates(range === 'custom' ? '7D' : range);
  const query: DataStreamsQuery = { site, pair: pairId, from: dates.from, to: dates.to };

  const show = {
    kpis: can('data-streams', 'kpis'),
    chart: can('data-streams', 'chart'),
    keyMetrics: can('data-streams', 'key-metrics'),
    comparison: can('data-streams', 'comparison'),
    insights: can('data-streams', 'insights'),
  };
  const needsSummary = show.kpis || show.keyMetrics || show.comparison || show.insights;
  const ready = Boolean(site) && pairs.isSuccess;
  const summary = useSummary(query, ready && needsSummary);
  const series = useSeries(query, ready && show.chart);

  const set = (patch: Partial<DataStreamsSearch>) => navigate({ search: (prev) => ({ ...prev, ...patch }), replace: false });

  if (!canPage('data-streams')) return <FullPageMessage title="No access" text="Your groups don't include the Data Streams dashboard." />;

  const accessError = [summary.error, series.error].find((e) => e instanceof ApiError && (e.status === 403 || e.status === 404)) as ApiError | undefined;
  const pair = pairs.data?.find((p) => p.id === pairId);

  return (
    <div className="space-y-lg">
      <PageHeader
        breadcrumb={[{ label: 'CWQM', href: '/cwqm' }, { label: 'Data Streams' }]}
        title="CWQM: Data Streams Analysis"
        subtitle="Dual-axis view of two correlated data streams. Understand the relationship between physical and index values over time."
        actions={<HeaderActions />}
      />

      <Filters
        key={`${site}|${pairId}|${dates.from}|${dates.to}`}
        sites={siteList}
        pairs={pairs.data ?? []}
        param={search.param ?? 'All'}
        value={{ site, pair: pairId, from: dates.from, to: dates.to }}
        onApply={(v) => set({ ...v, range: 'custom' })}
        onParam={(param) => set({ param })}
      />

      {accessError ? (
        <FullPageMessage title={accessError.status === 403 ? 'No access to this view' : 'Not found'} text={accessError.message}
          action={<Button onClick={() => navigate({ search: {} })}>Back to default view</Button>} />
      ) : (
        <>
          <p className="text-sm text-content-subtle" aria-live="polite">
            {summary.data && <>Data refreshed {fmtDateTime(summary.data.refreshedAt)} · </>}
            {series.data && <>{series.data.rawPointCount.toLocaleString('en-GB')} readings, shown as {series.data.points.length} points ({series.data.resolutionMinutes >= 60 ? `${+(series.data.resolutionMinutes / 60).toFixed(1)}-hour` : `${series.data.resolutionMinutes}-minute`} averages) · </>}
            {daysBetween(dates.from, dates.to)} day{daysBetween(dates.from, dates.to) === 1 ? '' : 's'}
          </p>

          {show.kpis && <KpiTiles summary={summary} />}

          <div className={show.chart && (show.keyMetrics || show.comparison) ? 'grid items-start gap-lg xl:grid-cols-[minmax(0,1fr)_420px]' : 'grid gap-lg'}>
            {show.chart && (
              <DualChart
                series={series}
                events={summary.data?.events ?? []}
                range={range}
                days={daysBetween(dates.from, dates.to)}
                mode={search.mode ?? 'area'}
                onRange={(r) => set({ range: r, from: undefined, to: undefined })}
                onMode={(mode) => set({ mode })}
              />
            )}
            {(show.keyMetrics || show.comparison) && (
              <div className={show.chart ? 'space-y-lg' : 'grid gap-lg lg:grid-cols-2'}>
                {show.keyMetrics && <KeyMetrics summary={summary} />}
                {show.comparison && <StreamComparison summary={summary} mode={search.cmp ?? 'abs'} onMode={(cmp) => set({ cmp })} />}
              </div>
            )}
          </div>

          {show.insights && (
            <Insights
              summary={summary}
              pairName={pair ? `${pair.primary.name} and ${pair.secondary.name}` : ''}
              onZoom={(day) => set({ range: 'custom', from: day.from, to: day.to })}
            />
          )}
        </>
      )}
    </div>
  );
}

/** Filters are a draft until Apply, as in the design. Parameter narrows the stream pairs immediately. */
function Filters({ sites, pairs, param, value, onApply, onParam }: {
  sites: { id: string; name: string }[];
  pairs: { id: string; primary: { name: string }; secondary: { name: string } }[];
  param: string;
  value: { site: string; pair: string; from: string; to: string };
  onApply: (v: { site: string; pair: string; from: string; to: string }) => void;
  onParam: (p: string) => void;
}) {
  const siteName = (id: string) => sites.find((s) => s.id === id)?.name ?? '';
  const [draft, setDraft] = useState({ ...value, siteText: siteName(value.site) });
  useEffect(() => setDraft((d) => ({ ...d, siteText: d.siteText || siteName(value.site) })), [sites.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const params = useMemo(() => ['All', ...new Set(pairs.flatMap((p) => [p.primary.name, p.secondary.name]))], [pairs]);
  const pairOptions = pairs
    .filter((p) => param === 'All' || p.primary.name === param || p.secondary.name === param)
    .map((p) => ({ value: p.id, label: `${p.primary.name} & ${p.secondary.name}` }));
  const matchedSite = sites.find((s) => s.name.toLowerCase() === draft.siteText.trim().toLowerCase());
  const datesOk = draft.from <= draft.to;
  const canApply = Boolean(matchedSite) && datesOk && pairOptions.some((o) => o.value === draft.pair);

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (canApply) onApply({ site: matchedSite!.id, pair: draft.pair, from: draft.from, to: draft.to }); }}>
      <FilterBar>
        <FormField label="Site">
          <SearchField value={draft.siteText} onChange={(v) => setDraft({ ...draft, siteText: v })} clearable options={sites.map((s) => s.name)} placeholder="Search site…"
            aria-invalid={!matchedSite} />
        </FormField>
        <FormField label="Parameter">
          <SelectField value={param} options={params} onChange={(e) => onParam(e.target.value)} />
        </FormField>
        <FormField label="Data Streams (2)">
          <SelectField value={pairOptions.some((o) => o.value === draft.pair) ? draft.pair : ''} onChange={(e) => setDraft({ ...draft, pair: e.target.value })}
            options={pairOptions.length ? [...(pairOptions.some((o) => o.value === draft.pair) ? [] : [{ value: '', label: 'Choose streams…' }]), ...pairOptions] : [{ value: '', label: 'No streams' }]} />
        </FormField>
        <FormField label="From"><Input type="date" value={draft.from} max={draft.to} onChange={(e) => setDraft({ ...draft, from: e.target.value })} /></FormField>
        <FormField label="To"><Input type="date" value={draft.to} min={draft.from} onChange={(e) => setDraft({ ...draft, to: e.target.value })} /></FormField>
        <div className="flex h-full flex-col justify-end gap-2xs">
          <Button type="submit" size="lg" block disabled={!canApply}>Apply</Button>
        </div>
      </FilterBar>
      {!matchedSite && draft.siteText && <p role="alert" className="mt-xs text-sm text-feedback-negative">Pick a site from the list.</p>}
      {!datesOk && <p role="alert" className="mt-xs text-sm text-feedback-negative">"From" must be on or before "To".</p>}
    </form>
  );
}
