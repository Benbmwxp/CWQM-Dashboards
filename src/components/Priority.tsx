import { LegendItem, tv } from '@severn-trent/cwqm-design-system';
import type { Priority } from '../api/contract';

const TOKEN: Record<Priority, string> = { High: 'high', Medium: 'medium', Low: 'low' };

/** Priority shown as colour plus text, never colour alone. */
export const PriorityLabel = ({ priority }: { priority: Priority }) => <LegendItem colour={tv(`color.data.severity.${TOKEN[priority]}`)} label={priority} />;
