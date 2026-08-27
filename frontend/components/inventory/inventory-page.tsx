import { FilterBar, PageHeader, SearchInput, EmptyState } from '@/components/ui/primitives';
import { StockTable } from './stock-table';
import type { StockRow } from '@/lib/api/inventory';
export function InventoryPage({
  title,
  description,
  rows,
  compact = false,
  empty,
}: {
  title: string;
  description: string;
  rows: StockRow[];
  compact?: boolean;
  empty: string;
}) {
  return (
    <div className="space-y-5">
      <PageHeader title={title} description={description} />
      <FilterBar>
        <SearchInput placeholder="Search product or SKU" />
        <select className="h-10 rounded-lg border border-slate-200 px-3">
          <option>All categories</option>
        </select>
        <select className="h-10 rounded-lg border border-slate-200 px-3">
          <option>All brands</option>
        </select>
        <select className="h-10 rounded-lg border border-slate-200 px-3">
          <option>All statuses</option>
        </select>
      </FilterBar>
      {rows.length ? (
        <StockTable rows={rows} compact={compact} />
      ) : (
        <EmptyState title={empty} description="No inventory action is required." />
      )}
    </div>
  );
}
