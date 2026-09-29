import type { MonitoringPoint } from '../../api/contract';
import { SITES } from './catalogue';

/** Every site has an upstream (US) and downstream (DS) monitoring point. */
export const POINTS: MonitoringPoint[] = SITES.flatMap((s) => [
  { id: `${s.id}-us`, name: `${s.name}US`, site: s.id, flow: 'upstream' as const },
  { id: `${s.id}-ds`, name: `${s.name}DS`, site: s.id, flow: 'downstream' as const },
]);

/** The eight quality parameters, in display order, with the stream model used for their values. */
export const QUALITY_PARAMETERS = [
  { name: 'Ammonia_NH3', stream: 'ammonia-nh3' },
  { name: 'Ammonium_NH4', stream: 'ammonium-nh4' },
  { name: 'ODO_mgL', stream: 'odo-mgl' },
  { name: 'ODO_Sat', stream: 'odo-sat' },
  { name: 'pH', stream: 'ph' },
  { name: 'SpConductivity_us', stream: 'spconductivity' },
  { name: 'Temperature', stream: 'temperature' },
  { name: 'Turbidity', stream: 'turbidity' },
] as const;

export const PARAMETER_NAMES = QUALITY_PARAMETERS.map((p) => p.name);
