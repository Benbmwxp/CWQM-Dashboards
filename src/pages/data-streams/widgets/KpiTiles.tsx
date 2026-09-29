import { DeltaIndicator, KpiTile, icons } from '@severn-trent/cwqm-design-system';
import { decimalsFor, fmtNum } from '../../../lib/format';
import { WidgetState, type SummaryQuery } from './common';

const white = '[&_*]:!text-white';

export function KpiTiles({ summary }: { summary: SummaryQuery }) {
  return (
    <WidgetState query={summary} height="h-40">
      {() => {
        const s = summary.data!;
        const days = s.daily.primary.length;
        const vs = `vs previous ${days} day${days === 1 ? '' : 's'}`;
        const foot = (v: number | null, unit = '%') =>
          v === null ? <span className="text-white/90">No earlier data</span> : <DeltaIndicator value={v} unit={unit} comparison={vs} className={white} />;
        const q = s.quality.good;
        return (
          <section aria-label="Key figures" className="grid gap-lg sm:grid-cols-2 xl:grid-cols-4">
            <KpiTile variant="solid" tone="teal" icon={<icons.data.stream />} eyebrow="Primary stream" label={s.pair.primary.name}
              value={fmtNum(s.averages.primary, decimalsFor(s.averages.primary))} unit={s.pair.primary.unit || undefined} detail="Avg (selected range)"
              trend={s.daily.primary.length > 1 ? s.daily.primary : undefined} footer={foot(s.change.primary)} />
            <KpiTile variant="solid" tone="purple" icon={<icons.data.chart />} eyebrow="Secondary stream" label={s.pair.secondary.name}
              value={fmtNum(s.averages.secondary, decimalsFor(s.averages.secondary))} unit={s.pair.secondary.unit || undefined} detail="Avg (selected range)"
              trend={s.daily.secondary.length > 1 ? s.daily.secondary : undefined} footer={foot(s.change.secondary)} />
            <KpiTile variant="solid" tone="navy" icon={<icons.data.stream />} eyebrow="Correlation (R)"
              label={`${s.correlation.strength[0].toUpperCase()}${s.correlation.strength.slice(1)} ${s.correlation.direction}`}
              value={fmtNum(s.correlation.r, 2)} trend={s.daily.correlation.length > 1 ? s.daily.correlation : undefined} footer={foot(s.correlation.change)} />
            <KpiTile variant="solid" tone="blue" icon={<icons.data.quality />} eyebrow="Data quality (both)"
              label={q >= 98 ? 'Good' : q >= 95 ? 'Fair' : 'Poor'} value={`${fmtNum(q, 1)}%`}
              trend={s.daily.quality.length > 1 ? s.daily.quality : undefined} footer={foot(s.quality.goodChange, ' pts')} />
          </section>
        );
      }}
    </WidgetState>
  );
}
