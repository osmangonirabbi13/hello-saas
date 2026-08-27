import Link from 'next/link';
import { CurrencyDisplay, FormSection, PageHeader, StatusBadge } from '@/components/ui/primitives';
import type { PurchaseSummary } from '@/lib/api/purchases';
export function PurchaseDetail({ purchase }: { purchase: PurchaseSummary }) {
  return (
    <div className="space-y-5">
      <PageHeader
        title={purchase.purchaseNumber}
        description={'Supplier invoice: ' + purchase.supplierInvoice}
        actions={
          <>
            <StatusBadge tone={purchase.status === 'POSTED' ? 'success' : 'info'}>
              {purchase.status}
            </StatusBadge>
            {purchase.status === 'DRAFT' && (
              <Link
                className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"
                href={'/purchases/' + purchase.id + '/edit'}
              >
                Edit Draft
              </Link>
            )}
          </>
        }
      />
      <div className="grid gap-5 lg:grid-cols-2">
        <FormSection title="Supplier and warehouse">
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-slate-500">Supplier</dt>
              <dd className="font-semibold">{purchase.supplier}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Warehouse</dt>
              <dd>{purchase.warehouse}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Purchase date</dt>
              <dd>{purchase.date}</dd>
            </div>
          </dl>
        </FormSection>
        <FormSection title="Financial summary">
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt>Grand total</dt>
              <dd>
                <CurrencyDisplay value={purchase.total} />
              </dd>
            </div>
            <div className="flex justify-between">
              <dt>Paid</dt>
              <dd>
                <CurrencyDisplay value={purchase.paid} />
              </dd>
            </div>
            <div className="flex justify-between font-semibold text-rose-700">
              <dt>Due</dt>
              <dd>
                <CurrencyDisplay value={purchase.due} />
              </dd>
            </div>
          </dl>
        </FormSection>
      </div>
      <FormSection title="Items">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-slate-500">
              <th>Product</th>
              <th>SKU</th>
              <th>Qty</th>
              <th>Unit cost</th>
              <th>Discount</th>
              <th>Tax</th>
              <th>Total</th>
              <th>Serial count</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b">
              <td className="py-3">Demo purchase item</td>
              <td>SKU-DEMO</td>
              <td>1</td>
              <td>—</td>
              <td>—</td>
              <td>—</td>
              <td>
                <CurrencyDisplay value={purchase.total} />
              </td>
              <td>0</td>
            </tr>
          </tbody>
        </table>
      </FormSection>
      <FormSection title="Activity">
        <p className="text-sm">Created by {purchase.createdBy}.</p>
        {purchase.status === 'POSTED' && (
          <p className="mt-2 text-sm">Posted inventory transaction recorded.</p>
        )}
        <p className="mt-4 text-xs text-slate-400">
          Payments, returns, and supplier ledger integrations are not part of this module.
        </p>
      </FormSection>
    </div>
  );
}
