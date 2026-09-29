import type { UseQueryResult } from '@tanstack/react-query';
import { Download, Info } from 'lucide-react';
import { DualAxisChart, IconButton, PanelCard, SegmentedControl, tv } from '@severn-trent/cwqm-design-system';
import type { SeriesResponse, StreamEvent } from '../../../api/contract';
import { RANGES, type RangeKey } from '../../../lib/dates';
import { decimalsFor, fmtDayHour, fmtNum } from '../../../lib/format';
import { niceAxis } from '../../../lib/scale';
import { WidgetState } from './common';

interface Props {
  series: UseQueryResult<SeriesResponse, Error>;
  events: StreamEvent[];
  range: RangeKey;
  days: number;
  mode: 'line' | 'area';
  onRange: (r: Exclude<RangeKey, 'custom'>) => void;
  onMode: (m: 'line' | 'area') => void;
}

export function DualChart({ series, events, range, days, mode, onRange, onMode }: Props) {
  return (
    <PanelCard
      title="Dual Data Stream Analysis"
      actions={
        <>
          <SegmentedControl label="Time range" size="sm" options={RANGES as unknown as string[]} value={range === 'custom' ? '' : range} onChange={(r) => onRange(r as Exclude<RangeKey, 'custom'>)} />
          <SegmentedControl label="Chart style" size="sm" options={[{ value: 'line', label: 'Line' }, { value: 'area', label: 'Area' }]} value={mode} onChange={(m) => onMode(m as 'line' | 'area')} />
          <IconButton aria-label="Download chart data (CSV)" size="sm" disabled={!series.data} onClick={() => series.data && downloadCsv(series.data)}><Download aria-hidden /></IconButton>
        </>
      }
    >
      <WidgetState query={series} height="h-[520px]">
        {() => <Chart data={series.data!} events={events} mode={mode} days={days} />}
      </WidgetState>
    </PanelCard>
  );
}

function Chart({ data, events, mode, days }: { data: SeriesResponse; events: StreamEvent[]; mode: 'line' | 'area'; days: number }) {
  const { pair, points } = data;
  if (!points.length) return <p className="py-3xl text-center text-content-subtle">No readings in this period yet.</p>;

  const rows = points.map((p) => ({ label: fmtDayHour(p.t), primary: p.primary, secondary: p.secondary }));
  const left = niceAxis(points.map((p) => p.primary));
  const right = niceAxis(points.map((p) => p.secondary));
  const pd = decimalsFor(left.domain[1] / 10), sd = decimalsFor(right.domain[1] / 10);
  const primaryColour = tv('color.data.stream.primary'), secondaryColour = tv('color.data.stream.secondary');
  const unit = (u: string) => (u ? ` (${u})` : '');

  // Pin the three most severe events to the nearest aggregated point.
  const times = points.map((p) => Date.parse(p.t));
  const markers = events.slice(0, 3).flatMap((e, i) => {
    const t = Date.parse(e.t);
    if (t < times[0] || t > times[times.length - 1] + 86_400_000) return [];
    let idx = 0;
    times.forEach((x, j) => { if (Math.abs(x - t) < Math.abs(times[idx] - t)) idx = j; });
    const y = points[idx][e.stream];
    return y === null ? [] : [{ x: rows[idx].label, y, axis: e.stream === 'primary' ? ('left' as const) : ('right' as const), label: String(i + 1) }];
  });

  return (
    <>
      <DualAxisChart
        label={`${pair.primary.name} and ${pair.secondary.name} over time`}
        summary={`${points.length} points. ${markers.length} highlighted events.`}
        data={rows as unknown as Record<string, string | number>[]}
        xKey="label"
        mode={mode}
        legendPosition="top"
        navigator
        height={420}
        xTickFormat={(v) => (days <= 2 ? v.split(', ')[1] ?? v : v.split(',')[0])}
        xInterval={Math.max(0, Math.floor(rows.length / 8))}
        leftAxis={{ label: `${pair.primary.name}${unit(pair.primary.unit)}`, domain: left.domain, ticks: left.ticks, colour: primaryColour, format: (v) => fmtNum(v, pd) }}
        rightAxis={{ label: `${pair.secondary.name}${unit(pair.secondary.unit)}`, domain: right.domain, ticks: right.ticks, colour: secondaryColour, format: (v) => fmtNum(v, sd) }}
        series={[
          { key: 'primary', label: `${pair.primary.name}${unit(pair.primary.unit)}`, colour: primaryColour, axis: 'left', format: (v) => `${fmtNum(v, decimalsFor(v))} ${pair.primary.unit}` },
          { key: 'secondary', label: `${pair.secondary.name}${unit(pair.secondary.unit)}`, colour: secondaryColour, axis: 'right', format: (v) => `${fmtNum(v, decimalsFor(v))} ${pair.secondary.unit}` },
        ]}
        markers={markers}
      />
      <p className="mt-xs flex items-center gap-xs text-sm text-content-subtle">
        <Info aria-hidden className="size-4" />Drag the handles under the chart to zoom. Numbered pins mark the most unusual readings.
      </p>
    </>
  );
}

function downloadCsv(data: SeriesResponse) {
  const head = `time_utc,${data.pair.primary.name},${data.pair.secondary.name}\n`;
  const body = data.points.map((p) => `${p.t},${p.primary ?? ''},${p.secondary ?? ''}`).join('\n');
  const url = URL.createObjectURL(new Blob([head + body], { type: 'text/csv' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: `data-streams-${data.pair.id}.csv` });
  a.click();
  URL.revokeObjectURL(url);
}
