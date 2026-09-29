import type { UseQueryResult } from '@tanstack/react-query';
import type { SummaryResponse } from '../../../api/contract';

export { Skeleton, WidgetState } from '../../../components/WidgetState';
export type SummaryQuery = UseQueryResult<SummaryResponse, Error>;
