import { DeltaIndicator, MetricList, PanelCard, icons } from '@severn-trent/cwqm-design-system';
import { decimalsFor, fmtNum } from '../../../lib/format';
import { WidgetState, type SummaryQuery } from './common';

export function KeyMetrics({ summary }: { summary: SummaryQuery }) {
  return (
    <PanelCard title="Key Metrics">
      <WidgetState query={summary} height="h-80">
        {() => {
          const s = summary.data!;
          const d = (v: number | null, unit = '%') => (v === null ? undefined : <DeltaIndicator value={v} unit={unit} />);
          const val = (v: number | null, u: string) => `${fmtNum(v, decimalsFor(v))}${u ? ` ${u}` : ''}`;
          return (
            <MetricList
              items={[
                { icon: <icons.data.stream />, tone: 'blue', label: s.pair.primary.name, value: val(s.averages.primary, s.pair.primary.unit), detail: d(s.change.primary) },
                { icon: <icons.data.chart />, tone: 'purple', label: s.pair.secondary.name, value: val(s.averages.secondary, s.pair.secondary.unit), detail: d(s.change.secondary) },
                { icon: <icons.data.correlation />, tone: 'teal', label: 'Correlation (R)', value: fmtNum(s.correlation.r, 2), detail: d(s.correlation.change) },
                { icon: <icons.data.quality />, tone: 'green', label: 'Data Quality (Both)', value: `${fmtNum(s.quality.good, 1)}%`, detail: d(s.quality.goodChange, ' pts') },
              ]}
            />
          );
        }}
      </WidgetState>
    </PanelCard>
  );
}
