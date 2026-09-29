import type { ReactNode } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { Button, Card } from '@severn-trent/cwqm-design-system';

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-lg bg-surface-subtle ${className}`} />;
}

/** Loading, error and "refreshing" states shared by every widget. */
export function WidgetState({ query, height, children }: { query: UseQueryResult<unknown, Error>; height: string; children: () => ReactNode }) {
  if (query.isPending) return <><span className="sr-only" role="status">Loading…</span><Skeleton className={height} /></>;
  if (query.isError) {
    return (
      <Card className={`flex flex-col items-center justify-center gap-sm p-xl text-center ${height}`} role="alert">
        <p className="font-semibold text-content-accent">Couldn't load this section</p>
        <p className="text-sm text-content-subtle">{query.error.message}</p>
        <Button variant="secondary" size="sm" onClick={() => query.refetch()}>Try again</Button>
      </Card>
    );
  }
  return <div className={query.isFetching ? 'opacity-70 transition-opacity' : 'transition-opacity'} aria-busy={query.isFetching}>{children()}</div>;
}
