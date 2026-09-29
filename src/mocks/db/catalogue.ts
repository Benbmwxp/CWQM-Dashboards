import type { Site, Stream, StreamPair } from '../../api/contract';

export const SITES: Site[] = [
  { id: 'littleaston', name: 'LittleAston' }, { id: 'buxton', name: 'Buxton' }, { id: 'goscote', name: 'Goscote' },
  { id: 'trescott', name: 'Trescott' }, { id: 'shenstone', name: 'Shenstone' }, { id: 'alfreton', name: 'Alfreton' },
  { id: 'tideswell', name: 'Tideswell' }, { id: 'sperna', name: 'Sperna' },
];

/** Signal shape per stream: base level, swing, noise and phase (streams with similar phase move together). */
export interface StreamModel extends Stream { base: number; swing: number; noise: number; phase: number; decimals: number }

export const STREAMS: StreamModel[] = [
  { id: 'spconductivity', name: 'SpConductivity_us', unit: 'µS/cm', scaleMax: 50, base: 20, swing: 6.5, noise: 1.1, phase: 0, decimals: 1 },
  { id: 'index-value', name: 'Index Value', unit: '', scaleMax: 2, base: 0.52, swing: 0.24, noise: 0.045, phase: -0.35, decimals: 2 },
  { id: 'temperature', name: 'Temperature', unit: '°C', scaleMax: 25, base: 14, swing: 2.4, noise: 0.35, phase: 1.3, decimals: 1 },
  { id: 'odo-mgl', name: 'ODO_mgL', unit: 'mg/L', scaleMax: 15, base: 9.6, swing: 1.1, noise: 0.25, phase: 1.3 + Math.PI, decimals: 2 },
  { id: 'ph', name: 'pH', unit: '', scaleMax: 14, base: 7.4, swing: 0.25, noise: 0.06, phase: 2.2, decimals: 2 },
  { id: 'ammonia-nh3', name: 'Ammonia_NH3', unit: 'mg/L', scaleMax: 0.01, base: 0.0028, swing: 0.0006, noise: 0.00015, phase: 2.5, decimals: 4 },
  { id: 'ammonium-nh4', name: 'Ammonium_NH4', unit: 'mg/L', scaleMax: 1, base: 0.12, swing: 0.03, noise: 0.008, phase: 2.6, decimals: 3 },
  { id: 'odo-sat', name: 'ODO_Sat', unit: '%', scaleMax: 120, base: 92, swing: 5, noise: 1.2, phase: 1.3 + Math.PI, decimals: 1 },
  { id: 'turbidity', name: 'Turbidity', unit: 'NTU', scaleMax: 10, base: 2.2, swing: 0.9, noise: 0.3, phase: 0.2, decimals: 2 },
];

const PAIRS: [string, string][] = [
  ['spconductivity', 'index-value'], ['temperature', 'odo-mgl'], ['turbidity', 'index-value'], ['ph', 'ammonia-nh3'], ['spconductivity', 'turbidity'],
];

export const toStream = ({ id, name, unit, scaleMax }: StreamModel): Stream => ({ id, name, unit, scaleMax });
export const streamModel = (id: string) => STREAMS.find((s) => s.id === id);

export const PAIR_LIST: StreamPair[] = PAIRS.map(([a, b]) => ({ id: `${a}~${b}`, primary: toStream(streamModel(a)!), secondary: toStream(streamModel(b)!) }));
export const findPair = (id: string) => PAIR_LIST.find((p) => p.id === id);
