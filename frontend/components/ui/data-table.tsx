import type { ReactNode } from 'react';
import { Pagination } from './primitives';
export type Column<Row> = {
  key: keyof Row;
  label: string;
  render?: (row: Row) => ReactNode;
  align?: 'left' | 'right';
};
export function DataTable<Row extends object>({
  rows,
  columns,
  rowKey,
}: {
  rows: Row[];
  columns: Column<Row>[];
  rowKey: (row: Row) => string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              {columns.map((column) => (
                <th
                  className={column.align === 'right' ? 'px-4 py-3 text-right' : 'px-4 py-3'}
                  key={String(column.key)}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr className="transition-colors hover:bg-slate-50/70" key={rowKey(row)}>
                {columns.map((column) => (
                  <td
                    className={column.align === 'right' ? 'px-4 py-3.5 text-right' : 'px-4 py-3.5'}
                    key={String(column.key)}
                  >
                    {column.render ? column.render(row) : String(row[column.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination total={rows.length} />
    </div>
  );
}
