import { useMemo } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { Crosshair, Grid3x3, ScanSearch } from 'lucide-react';
import {
  bandOf, DonutChart, HeatmapTable, InfoCallout, LegendItem, OPERABILITY_BANDS, PageHeader, PanelCard, SearchField, Switch, tv, ValueBar,
} from '@severn-trent/cwqm-design-system';
import { useAccess } from '../../auth/useAccess';
import { useOperabilityMatrix, useParameters } from '../../api/queries';
import { HeaderActions } from '../../layout/HeaderActions';
import { FullPageMessage } from '../../layout/FullPageMessage';
import { QualityFilters } from '../../components/QualityFilters';
import { SectionTabs } from '../../components/SectionTabs';
import { WidgetState } from '../../components/WidgetState';
import { downloadCsv } from '../../lib/csv';
import { resolveDates, str, validateQualitySearch, type QualitySearch } from '../../lib/qualitySearch';

export interface AllSitesSearch extends QualitySearch { q?: string; values?: 'off' }
export const validateAllSitesSearch = (s: Record<string, unknown>): AllSitesSearch => ({ ...validateQualitySearch(s), q: str(s.q), values: s.values === 'off' ? 'off' : undefined });

export function OperabilityAllSitesPage() {
  const search = useSearch({ from: '/operability' });
  const navigate = useNavigate({ from: '/operability' });
  const set = (patch: Partial<AllSitesSearch>) => navigate({ search: (prev) => ({ ...prev, ...patch }) });
  const { canPage, can } = useAccess();
  const parameters = useParameters();
  const dates = resolveDates(search);
  const show = { heatmap: can('operability', 'heatmap'), summary: can('operability', 'summary'), averages: can('operability', 'parameter-averages') };
  const matrix = useOperabilityMatrix({ parameter: search.parameter, ...dates });

  const stats = useMemo(() => {
    const m = matrix.data;
    if (!m) return null;
    const cells = m.rows.flatMap((r) => m.parameters.map((p) => r.values[p]));
    return {
      total: cells.length,
      average: cells.length ? cells.reduce((a, v) => a + v, 0) / cells.length : 0,
      bands: OPERABILITY_BANDS.map((b) => ({ ...b, count: cells.filter((v) => bandOf(v).key === b.key).length })),
    };
  }, [matrix.data]);

  if (!canPage('operability')) return <FullPageMessage title="No access" text="Your groups don't include Operability - All Sites." />;

  const exportCsv = () => matrix.data && downloadCsv(`operability-all-sites-${dates.from}-to-${dates.to}.csv`,
    matrix.data.rows.map((r) => ({ site: r.point.name, ...Object.fromEntries(matrix.data!.parameters.map((p) => [p, r.values[p]])) })));

  const rows = (matrix.data?.rows ?? [])
    .filter((r) => !search.q || r.point.name.toLowerCase().includes(search.q.toLowerCase()))
    .map((r) => ({ label: r.point.name, values: r.values, worst: Math.min(...Object.values(r.values)) }))
    // Worst locations first, so problems surface at the top
    .sort((a, b) => a.worst - b.worst || a.label.localeCompare(b.label));

  const summary = show.summary && (
    <PanelCard icon={<Crosshair />} title="Overall Summary">
      <WidgetState query={matrix} height="h-56">
        {() => (
          <div className="flex flex-wrap items-center gap-lg">
            <DonutChart
              label="Share of cells in each operability band" size={180}
              segments={stats!.bands.map((b) => ({ label: b.label, value: b.count, colour: tv(`color.data.band.${b.key}`) }))}
              centre={<><span className="tabular text-3xl font-extrabold text-content-heading">{stats!.average.toFixed(1)}%</span><span className="text-sm leading-tight text-content-subtle">Average<br />Operability</span></>}
            />
            <ul className="min-w-[10rem] flex-1 space-y-xs">
              {stats!.bands.map((b) => <li key={b.key}><LegendItem colour={tv(`color.data.band.${b.key}`)} label={b.label} value={b.count} /></li>)}
              <li className="flex justify-between border-t border-line-default pt-xs font-bold text-content-accent"><span>Total cells</span><span className="tabular">{stats!.total}</span></li>
            </ul>
          </div>
        )}
      </WidgetState>
    </PanelCard>
  );

  const averages = show.averages && (
    <PanelCard icon={<ScanSearch />} title="Parameter Average (All Sites)">
      <WidgetState query={matrix} height="h-64">
        {() => (
          <div className="space-y-sm">
            {matrix.data!.parameters.map((p) => {
              const v = matrix.data!.parameterAverages[p];
              return <ValueBar key={p} label={p} value={v} colour={tv(`color.data.band.${bandOf(v).key}`)} />;
            })}
          </div>
        )}
      </WidgetState>
    </PanelCard>
  );

  const about = (
    <InfoCallout title="About Operability">
      Operability % shows the proportion of valid readings received for each parameter at each site: readings that arrived and passed quality checks. Higher values indicate better data availability.
    </InfoCallout>
  );

  return (
    <div className="space-y-lg">
      <PageHeader
        breadcrumb={[{ label: 'CWQM', href: '/cwqm' }, { label: 'Operability' }]}
        title="Operability - All Sites"
        subtitle="View operability percentage for all sites across key parameters. Filter by parameter(s) and date range to explore site performance."
        actions={<HeaderActions period={dates} onExport={exportCsv} exportDisabled={!matrix.data} />}
      />
      <SectionTabs current="operability" />

      <div className="grid gap-lg xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <QualityFilters
          parameter={{ parameters: parameters.data ?? [], value: search.parameter, onChange: (parameter) => set({ parameter }) }}
          dates={{ ...dates, onChange: (r) => set(r) }}
        />
        <InfoCallout className="items-center">Operability shows the percentage of valid readings for each parameter at each site. Darker colours indicate higher operability.</InfoCallout>
      </div>

      {show.heatmap ? (
        <div className="grid items-start gap-lg 2xl:grid-cols-[minmax(0,1fr)_340px]">
          <PanelCard
            icon={<Grid3x3 />}
            title="Operability % - All Sites"
            description="(Filtered by selected parameter(s) and date period. Site selection is ignored.)"
            actions={
              <>
                <SearchField value={search.q ?? ''} onChange={(q) => set({ q: q || undefined })} placeholder="Search site…" aria-label="Search site" className="h-10 w-56" />
                <Switch label="Show values" checked={search.values !== 'off'} onChange={(on) => set({ values: on ? undefined : 'off' })} />
              </>
            }
          >
            <WidgetState query={matrix} height="h-[560px]">
              {() => rows.length
                ? <HeatmapTable caption="Operability percentage by site and parameter" rowHeader="Site" columns={matrix.data!.parameters} rows={rows} showValues={search.values !== 'off'} />
                : <p className="py-2xl text-center text-content-subtle">No sites match "{search.q}".</p>}
            </WidgetState>
          </PanelCard>
          <div className="grid gap-lg lg:grid-cols-2 2xl:grid-cols-1">{summary}{averages}{about}</div>
        </div>
      ) : (
        <div className="grid items-start gap-lg lg:grid-cols-2">{summary}{averages}{about}</div>
      )}
    </div>
  );
}
