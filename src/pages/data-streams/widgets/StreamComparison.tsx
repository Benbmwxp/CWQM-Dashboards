import { ColumnChart, PanelCard, SegmentedControl, tv } from '@severn-trent/cwqm-design-system';
import { decimalsFor, fmtNum } from '../../../lib/format';
import { niceAxis } from '../../../lib/scale';
import { WidgetState, type SummaryQuery } from './common';

/** Absolute averages, or each average as a % of its stream's usual scale (so different units compare fairly). */
export function StreamComparison({ summary, mode, onMode }: { summary: SummaryQuery; mode: 'abs' | 'rel'; onMode: (m: 'abs' | 'rel') => void }) {
  return (
    <PanelCard
      title="Stream Comparison"
      titleSuffix="(Averages)"
      actions={<SegmentedControl label="Comparison" size="sm" options={[{ value: 'abs', label: 'Absolute' }, { value: 'rel', label: 'Relative (%)' }]} value={mode} onChange={(m) => onMode(m as 'abs' | 'rel')} />}
    >
      <WidgetState query={summary} height="h-64">
        {() => {
          const { pair, averages } = summary.data!;
          const rel = mode === 'rel';
          const value = (v: number | null, max: number) => (v === null ? 0 : rel ? +((v / max) * 100).toFixed(1) : v);
          const data = [
            { label: `${pair.primary.name}${pair.primary.unit ? `\n(${pair.primary.unit})` : ''}`, value: value(averages.primary, pair.primary.scaleMax), colour: tv('color.data.stream.primary') },
            { label: `${pair.secondary.name}${pair.secondary.unit ? `\n(${pair.secondary.unit})` : ''}`, value: value(averages.secondary, pair.secondary.scaleMax), colour: tv('color.data.stream.secondary') },
          ];
          const axis = rel ? { domain: [0, 100] as [number, number], ticks: [0, 25, 50, 75, 100] } : niceAxis(data.map((d) => d.value));
          return (
            <ColumnChart
              label="Average of each stream" seriesLabel={rel ? '% of usual scale' : 'Average'} yLabel={rel ? '% of scale' : 'Average value'}
              colour={tv('color.data.stream.primary')} showLegend={false} height={230} yDomain={axis.domain} yTicks={axis.ticks}
              format={(v) => (rel ? `${fmtNum(v, 1)}%` : fmtNum(v, decimalsFor(v)))} data={data}
            />
          );
        }}
      </WidgetState>
    </PanelCard>
  );
}
