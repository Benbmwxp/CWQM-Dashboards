import { ChevronLeft, ChevronRight } from 'lucide-react';
import { SelectField } from '@severn-trent/cwqm-design-system';

interface Props {
  page: number; pageSize: number; total: number; pageSizes?: number[];
  onPageChange: (p: number) => void; onPageSizeChange: (s: number) => void; className?: string;
}

/** Page numbers with gaps ("1 … 4 5 6 … 80"), so thousands of results still fit on one line. */
export function CompactPagination({ page, pageSize, total, pageSizes = [25, 50, 100], onPageChange, onPageSizeChange, className = '' }: Props) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const nums = [...new Set([1, page - 1, page, page + 1, pages].filter((n) => n >= 1 && n <= pages))].sort((a, b) => a - b);
  const items: (number | 'gap')[] = [];
  nums.forEach((n, i) => { if (i && n - nums[i - 1] > 1) items.push('gap'); items.push(n); });
  const btn = 'inline-flex h-10 min-w-10 items-center justify-center rounded-md border border-line-default bg-surface-default px-xs text-md font-semibold text-content-accent hover:bg-action-secondary-hover disabled:opacity-40';
  const start = total ? (page - 1) * pageSize + 1 : 0;
  return (
    <div className={`flex flex-wrap items-center justify-between gap-md ${className}`}>
      <label className="flex items-center gap-sm text-sm text-content-subtle">
        Rows per page
        <SelectField size="sm" className="w-20" value={String(pageSize)} onChange={(e) => onPageSizeChange(Number(e.target.value))} options={pageSizes.map(String)} />
      </label>
      <nav aria-label="Pagination" className="flex items-center gap-2xs">
        <button type="button" aria-label="Previous page" className={btn} disabled={page <= 1} onClick={() => onPageChange(page - 1)}><ChevronLeft aria-hidden className="size-5" /></button>
        {items.map((it, i) => it === 'gap'
          ? <span key={`g${i}`} aria-hidden className="px-2xs text-content-muted">…</span>
          : <button key={it} type="button" aria-label={`Page ${it}`} aria-current={it === page ? 'page' : undefined} onClick={() => onPageChange(it)}
              className={`${btn} ${it === page ? 'border-transparent bg-action-primary text-content-on-action hover:bg-action-primary-hover' : ''}`}>{it}</button>)}
        <button type="button" aria-label="Next page" className={btn} disabled={page >= pages} onClick={() => onPageChange(page + 1)}><ChevronRight aria-hidden className="size-5" /></button>
      </nav>
      <span className="tabular text-sm text-content-subtle" aria-live="polite">{start.toLocaleString('en-GB')}–{Math.min(page * pageSize, total).toLocaleString('en-GB')} of {total.toLocaleString('en-GB')}</span>
    </div>
  );
}
