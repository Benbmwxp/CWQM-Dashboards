import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, EllipsisVertical } from 'lucide-react';

export interface ServerColumn<T> {
  key: string;
  header: string;
  /** Set to let the server sort by this column. */
  sortKey?: string;
  render: (row: T) => ReactNode;
  align?: 'left' | 'right' | 'center';
  highlight?: boolean;
  rowHeader?: boolean;
}

interface Props<T> {
  caption: string;
  columns: ServerColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  sort?: string;
  dir?: 'asc' | 'desc';
  onSort?: (key: string, dir: 'asc' | 'desc') => void;
  onRowAction?: (row: T) => void;
  rowActionLabel?: (row: T) => string;
  maxHeight?: number;
  empty?: string;
}

/**
 * Table whose sorting is done by the server (the design-system DataTable sorts
 * only the rows it has, which is wrong once results are paged).
 */
export function ServerTable<T>({ caption, columns, rows, getRowKey, sort, dir, onSort, onRowAction, rowActionLabel, maxHeight, empty = 'No results match the current filters.' }: Props<T>) {
  const align = (a?: string) => (a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left');
  return (
    <div className="overflow-auto rounded-md border border-line-default" style={{ maxHeight }}>
      <table className="w-full border-collapse">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 z-10">
          <tr>
            {columns.map((c) => {
              const active = c.sortKey && c.sortKey === sort;
              return (
                <th key={c.key} scope="col" aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : c.sortKey ? 'none' : undefined}
                  className={`whitespace-nowrap bg-surface-subtle px-sm py-xs text-sm font-semibold text-content-accent ${align(c.align)}`}>
                  {c.sortKey && onSort ? (
                    <button type="button" className="inline-flex items-center gap-2xs" onClick={() => onSort(c.sortKey!, active && dir === 'desc' ? 'asc' : 'desc')}>
                      {c.header}
                      {active ? (dir === 'asc' ? <ArrowUp aria-hidden className="size-4" /> : <ArrowDown aria-hidden className="size-4" />) : <ArrowUpDown aria-hidden className="size-4 opacity-60" />}
                    </button>
                  ) : c.header}
                </th>
              );
            })}
            {onRowAction && <th scope="col" className="bg-surface-subtle"><span className="sr-only">Actions</span></th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={getRowKey(r)} className={`border-t border-line-default ${i % 2 ? 'bg-surface-subtle' : 'bg-surface-default'}`}>
              {columns.map((c) => {
                const Cell = c.rowHeader ? 'th' : 'td';
                return (
                  <Cell key={c.key} scope={c.rowHeader ? 'row' : undefined}
                    className={`tabular whitespace-nowrap px-sm py-xs text-sm text-content-default ${c.rowHeader ? 'font-semibold' : ''} ${c.highlight ? 'bg-surface-highlight text-content-subtle' : ''} ${align(c.align)}`}>
                    {c.render(r)}
                  </Cell>
                );
              })}
              {onRowAction && (
                <td className="px-xs text-center">
                  <button type="button" aria-label={rowActionLabel?.(r) ?? 'Row details'} onClick={() => onRowAction(r)} className="rounded-sm p-2xs text-content-accent hover:bg-surface-subtle">
                    <EllipsisVertical aria-hidden className="size-5 rotate-90" />
                  </button>
                </td>
              )}
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={columns.length + (onRowAction ? 1 : 0)} className="px-md py-xl text-center text-content-muted">{empty}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
