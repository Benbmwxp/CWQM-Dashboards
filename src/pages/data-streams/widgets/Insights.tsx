import { useRef, useState } from 'react';
import { CalendarDays, Flag, Info, Lightbulb } from 'lucide-react';
import { Button, DonutChart, InsightStepCard, LegendItem, tv } from '@severn-trent/cwqm-design-system';
import type { Severity, StreamEvent } from '../../../api/contract';
import { fmtNum } from '../../../lib/format';
import { WidgetState, type SummaryQuery } from './common';
import { EventsDialog } from './EventsDialog';

const SEVERITY: { key: Severity; label: string; action: string }[] = [
  { key: 'high', label: 'High', action: 'Investigate first' },
  { key: 'medium', label: 'Medium', action: 'Review required' },
  { key: 'low', label: 'Low', action: 'Monitor' },
];

interface Props { summary: SummaryQuery; pairName: string; onZoom: (range: { from: string; to: string }) => void }

export function Insights({ summary, pairName, onZoom }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const open = (id: string | null) => { setFocus(id); dialog.current?.showModal(); };
  const zoomTo = (e: StreamEvent) => { dialog.current?.close(); const day = e.t.slice(0, 10); onZoom({ from: day, to: day }); };

  return (
    <section aria-labelledby="insights-title" className="space-y-md">
      <div>
        <h2 id="insights-title" className="text-2xl font-bold text-content-accent">Data Confidence & Insights</h2>
        <p className="text-md text-content-subtle">Understand the data quality, identified events and what the data is telling us.</p>
      </div>
      <WidgetState query={summary} height="h-64">
        {() => {
          const s = summary.data!;
          const counts = Object.fromEntries(SEVERITY.map((x) => [x.key, s.events.filter((e) => e.severity === x.key).length])) as Record<Severity, number>;
          const quality = [
            { label: 'Good', value: s.quality.good, colour: tv('color.data.quality.good') },
            { label: 'Fair', value: s.quality.fair, colour: tv('color.data.quality.fair') },
            { label: 'Poor', value: s.quality.poor, colour: tv('color.data.quality.poor') },
          ];
          const top = s.events[0];
          const r = s.correlation.r;
          const lagText = s.correlation.lagMinutes >= 60 ? `about ${+(s.correlation.lagMinutes / 60).toFixed(1)} hours` : s.correlation.lagMinutes > 0 ? `about ${s.correlation.lagMinutes} minutes` : 'no noticeable delay';
          const [a, b] = [s.pair.primary.name, s.pair.secondary.name];

          return (
            <>
              <div className="grid gap-lg md:grid-cols-2 2xl:grid-cols-4">
                <InsightStepCard step={1} title="Data Confidence" tone="green">
                  <div className="flex flex-wrap items-center gap-md">
                    <DonutChart label="Reading quality" size={130} thickness={16} segments={quality} centre={<span className="text-2xl font-extrabold text-content-heading">{fmtNum(s.quality.good, 1)}%</span>} />
                    <ul className="min-w-[9rem] flex-1 space-y-2xs">{quality.map((q) => <li key={q.label}><LegendItem colour={q.colour} label={q.label} value={`${fmtNum(q.value, 1)}%`} /></li>)}</ul>
                  </div>
                  <p className="mt-sm text-sm text-content-subtle">
                    {fmtNum(s.quality.good, 1)}% of expected readings passed quality checks. {fmtNum(s.quality.fair, 1)}% need review and {fmtNum(s.quality.poor, 1)}% are missing.
                  </p>
                </InsightStepCard>

                <InsightStepCard step={2} title="Events Requiring Attention" tone="purple">
                  <p className="flex items-center gap-sm">
                    <CalendarDays aria-hidden className="size-7 text-content-accent" />
                    <span className="text-3xl font-extrabold text-content-heading">{s.events.length}</span>
                    <span className="text-sm">unusual reading{s.events.length === 1 ? '' : 's'} detected in the selected period.</span>
                  </p>
                  <ul className="my-sm space-y-2xs">
                    {SEVERITY.map((x) => (
                      <li key={x.key} className="grid grid-cols-[1fr_auto_1.4fr] gap-sm text-sm">
                        <LegendItem colour={tv(`color.data.severity.${x.key}`)} label={x.label} /><span className="tabular">{counts[x.key]}</span><span className="text-content-subtle">{x.action}</span>
                      </li>
                    ))}
                  </ul>
                  <Button variant="secondary" className="h-auto min-h-10 whitespace-normal py-xs text-center" block disabled={!s.events.length} onClick={() => open(null)}>View Anomalies</Button>
                </InsightStepCard>

                <InsightStepCard step={3} title="What the Data Shows" tone="blue">
                  <p className="flex gap-sm">
                    <Lightbulb aria-hidden className="size-6 shrink-0 text-content-accent" />
                    <span>
                      {r === null ? `There isn't enough overlapping data to compare ${pairName}.` : (
                        <>Both streams show a <strong>{s.correlation.strength} {s.correlation.direction} correlation (R = {fmtNum(r, 2)})</strong>.{' '}
                        {s.correlation.strength !== 'weak' && <>{b} tends to {s.correlation.direction === 'positive' ? 'rise' : 'fall'} when {a} increases, with {lagText}.</>}</>
                      )}
                    </span>
                  </p>
                  <p className="mt-sm flex gap-xs rounded-md bg-surface-accent p-sm text-sm text-content-subtle">
                    <Info aria-hidden className="size-4 shrink-0" />Correlation indicates the streams move together; it does not necessarily mean one causes the other.
                  </p>
                </InsightStepCard>

                <InsightStepCard step={4} title="Recommended Next Step" tone="green">
                  <p className="flex gap-sm">
                    <Flag aria-hidden className="size-6 shrink-0 text-feedback-positive" />
                    <span>
                      {top?.severity === 'high' ? 'Investigate the high-severity event to understand the cause and whether any action is required.'
                        : top ? 'No high-severity events. Review the flagged readings when convenient.'
                        : s.quality.good < 95 ? 'Data quality is below 95%. Check the sensors for missing readings.'
                        : 'Nothing needs attention in this period.'}
                    </span>
                  </p>
                  {top && (
                    <Button className="mt-md h-auto min-h-12 whitespace-normal py-xs text-center leading-snug" size="lg" block onClick={() => open(top.id)}>
                      {top.severity === 'high' ? 'Investigate High-Severity Event' : 'Review flagged readings'}
                    </Button>
                  )}
                </InsightStepCard>
              </div>
              <EventsDialog ref={dialog} events={s.events} focusId={focus} pair={s.pair} onZoom={zoomTo} />
            </>
          );
        }}
      </WidgetState>
    </section>
  );
}
