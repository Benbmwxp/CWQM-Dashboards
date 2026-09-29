import type { CSSProperties } from 'react';
import { operabilityColours, tv } from '@severn-trent/cwqm-design-system';

/** Cell colouring for data-quality percentages: higher is worse, tinted from the feedback tokens. */
export function qualityCell(v: number): CSSProperties {
  if (v <= 0) return {};
  const token = v >= 5 ? 'color.feedback.negative' : 'color.feedback.warning';
  return { background: `color-mix(in oklab, ${tv(token)} ${v >= 5 ? 26 : 18}%, ${tv('color.surface.default')})`, color: tv(token), fontWeight: 600 };
}

export const operabilityCell = (v: number): CSSProperties => ({ ...operabilityColours(v), fontWeight: 600 });

export const fmtPct = (v: number | null | undefined, d = 2) => (v === null || v === undefined ? '–' : `${v.toFixed(d)}%`);
