import { forwardRef } from 'react';
import { X } from 'lucide-react';
import { Button, IconButton, LegendItem, tv } from '@severn-trent/cwqm-design-system';
import type { StreamEvent, StreamPair } from '../../../api/contract';
import { fmtDateTime, fmtNum, decimalsFor } from '../../../lib/format';

interface Props { events: StreamEvent[]; focusId: string | null; pair: StreamPair; onZoom: (e: StreamEvent) => void }

/** Native <dialog>: focus is trapped, Escape closes it, and focus returns to the button that opened it. */
export const EventsDialog = forwardRef<HTMLDialogElement, Props>(({ events, focusId, pair, onZoom }, ref) => {
  const list = focusId ? [...events.filter((e) => e.id === focusId), ...events.filter((e) => e.id !== focusId)] : events;
  return (
    <dialog ref={ref} aria-labelledby="events-title"
      className="m-auto w-[min(56rem,92vw)] rounded-lg border border-line-default bg-surface-default p-0 text-content-default shadow-raised backdrop:bg-black/50">
      <div className="flex items-center justify-between border-b border-line-default px-lg py-md">
        <h2 id="events-title" className="text-xl font-bold text-content-accent">Unusual readings ({events.length})</h2>
        <form method="dialog"><IconButton aria-label="Close" size="sm"><X aria-hidden /></IconButton></form>
      </div>
      <ul className="max-h-[60vh] divide-y divide-line-default overflow-auto">
        {list.map((e) => {
          const stream = e.stream === 'primary' ? pair.primary : pair.secondary;
          return (
            <li key={e.id} className={`grid gap-xs px-lg py-md sm:grid-cols-[7rem_1fr_auto] sm:items-center ${e.id === focusId ? 'bg-surface-accent' : ''}`}>
              <LegendItem colour={tv(`color.data.severity.${e.severity}`)} label={<span className="font-semibold capitalize">{e.severity}</span>} />
              <div className="text-sm">
                <p className="font-semibold">{fmtDateTime(e.t)} · {stream.name}: {fmtNum(e.value, decimalsFor(e.value))} {stream.unit}</p>
                <p className="text-content-subtle">{e.reason}</p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => onZoom(e)}>Zoom to this day</Button>
            </li>
          );
        })}
      </ul>
    </dialog>
  );
});
EventsDialog.displayName = 'EventsDialog';
