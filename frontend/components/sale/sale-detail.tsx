import Link from 'next/link';
import { CurrencyDisplay, FormSection, PageHeader, StatusBadge } from '@/components/ui/primitives';
import type { SaleSummary } from '@/lib/api/sales';

export function SaleDetail({ sale }: { sale: SaleSummary }) {
  return (
    <div className="space-y-5">
      <PageHeader
        title={sale.saleNumber}
        description={`Invoice ${sale.invoiceNumber}`}
        actions={
          <>
            {sale.status === 'DRAFT' && (
              <Link
                className="rounded-lg border px-4 py-2 text-sm font-semibold"
                href={`/sales/${sale.id}/edit`}
              >
                Edit Draft
              </Link>
            )}
            <button className="rounded-lg border px-4 py-2 text-sm font-semibold" type="button">
              Print placeholder
            </button>
          </>
        }
      />
      <div className="grid gap-5 lg:grid-cols-3">
        <FormSection title="Sale information">
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-slate-500">Type / Status</dt>
              <dd className="mt-1 flex gap-2">
                <StatusBadge tone="info">{sale.type}</StatusBadge>
                <StatusBadge tone={sale.status === 'POSTED' ? 'success' : 'info'}>
                  {sale.status}
                </StatusBadge>
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Customer</dt>
              <dd className="font-semibold">{sale.customer}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Warehouse</dt>
              <dd>{sale.warehouse}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Date</dt>
              <dd>{sale.date}</dd>
            </div>
          </dl>
        </FormSection>
        <FormSection title="Items">
          <div className="rounded-lg border p-4 text-sm">
            <p className="font-semibold">Product lines and selected serial counts</p>
            <p className="mt-1 text-slate-500">
              Loaded from the authenticated Sale detail adapter.
            </p>
          </div>
        </FormSection>
        <FormSection title="Financial summary">
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt>Grand total</dt>
              <dd>
                <CurrencyDisplay value={sale.total} />
              </dd>
            </div>
            <div className="flex justify-between">
              <dt>Paid</dt>
              <dd>
                <CurrencyDisplay value={sale.paid} />
              </dd>
            </div>
            <div className="flex justify-between font-bold text-rose-700">
              <dt>Due</dt>
              <dd>
                <CurrencyDisplay value={sale.due} />
              </dd>
            </div>
          </dl>
        </FormSection>
      </div>
      <FormSection title="Activity">
        <p className="text-sm">Created by {sale.createdBy}.</p>
        {sale.status === 'POSTED' && (
          <p className="mt-2 text-sm text-emerald-700">
            Posted, inventory deducted, and invoice finalized atomically.
          </p>
        )}
      </FormSection>
    </div>
  );
}
