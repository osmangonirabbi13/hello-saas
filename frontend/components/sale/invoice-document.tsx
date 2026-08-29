'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Printer } from 'lucide-react';
import { fetchPersistedInvoice, type PersistedInvoice } from '@/lib/api/invoices';

type Layout = 'a4' | '58mm' | '80mm';
export const invoiceMoney = (value: string) =>
  `৳${Number(value).toLocaleString('en-BD', { minimumFractionDigits: 2 })}`;

export function InvoiceDocument({ saleId }: { saleId: string }) {
  const [invoice, setInvoice] = useState<PersistedInvoice | null>(null);
  const [layout, setLayout] = useState<Layout>('a4');
  const [error, setError] = useState('');
  useEffect(() => {
    void fetchPersistedInvoice(saleId)
      .then(setInvoice)
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : 'Unable to load invoice.'),
      );
  }, [saleId]);
  if (error)
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6">
        <h1 className="font-bold">Invoice unavailable</h1>
        <p>{error}</p>
        <p>Draft sales cannot be printed as final invoices.</p>
      </div>
    );
  if (!invoice)
    return (
      <p className="rounded-xl border bg-white p-8 text-sm text-slate-500">
        Loading authoritative invoice…
      </p>
    );
  return (
    <div className={`invoice-print invoice-${layout}`}>
      <div className="no-print mb-4 flex flex-wrap items-center gap-2 rounded-xl border bg-white p-3">
        <CheckCircle2 className="text-emerald-600" size={20} />
        <strong className="mr-auto">Sale Completed ✓ · {invoice.invoice.invoiceNumber}</strong>
        {(['58mm', '80mm', 'a4'] as const).map((option) => (
          <button
            className={`rounded-lg border px-3 py-2 text-sm font-semibold ${layout === option ? 'border-emerald-600 bg-emerald-50' : ''}`}
            key={option}
            onClick={() => setLayout(option)}
            type="button"
          >
            {option === 'a4' ? 'A4 Invoice' : `${option} Receipt`}
          </button>
        ))}
        <button
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white"
          onClick={() => window.print()}
          type="button"
        >
          <Printer size={16} />
          Print
        </button>
        <Link className="rounded-lg border px-3 py-2 text-sm font-semibold" href="/sales/pos">
          New Sale
        </Link>
      </div>
      <article className="invoice-sheet bg-white text-slate-950">
        <header className="border-b border-slate-900 pb-4 text-center">
          <h1 className="text-2xl font-black">{invoice.business.name}</h1>
          <p className="text-sm font-bold">
            {layout === 'a4'
              ? invoice.type === 'VAT'
                ? 'VAT INVOICE'
                : 'CUSTOMER INVOICE'
              : 'SALES RECEIPT'}
          </p>
        </header>
        <dl className="invoice-meta grid grid-cols-2 gap-x-6 gap-y-1 border-b py-4 text-sm">
          <div>
            <dt>Invoice</dt>
            <dd>{invoice.invoice.invoiceNumber}</dd>
          </div>
          <div>
            <dt>Sale</dt>
            <dd>{invoice.saleNumber}</dd>
          </div>
          <div>
            <dt>Date</dt>
            <dd>{new Date(invoice.invoice.issuedAt).toLocaleString('en-BD')}</dd>
          </div>
          <div>
            <dt>Cashier</dt>
            <dd>{invoice.postedBy?.displayName ?? invoice.createdBy.displayName}</dd>
          </div>
          <div>
            <dt>Customer</dt>
            <dd>{invoice.customer?.name ?? 'Walk-in Customer'}</dd>
          </div>
          {invoice.customer?.phone && (
            <div>
              <dt>Phone</dt>
              <dd>{invoice.customer.phone}</dd>
            </div>
          )}
        </dl>
        <table className="invoice-items mt-4 w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th>Product</th>
              <th>Qty</th>
              <th>Price</th>
              <th>Discount</th>
              <th>VAT</th>
              <th className="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line) => (
              <tr className="border-b align-top" key={line.id}>
                <td>
                  <strong>{line.product.name}</strong>
                  <span className="block text-xs">SKU: {line.product.sku}</span>
                  {line.serialNumbers.map((serial) => (
                    <span className="block font-mono text-xs" key={serial}>
                      IMEI/Serial: {serial}
                    </span>
                  ))}
                </td>
                <td>{line.quantity}</td>
                <td>{invoiceMoney(line.unitPrice)}</td>
                <td>{invoiceMoney(line.discountAmount)}</td>
                <td>{invoiceMoney(line.taxAmount)}</td>
                <td className="text-right">{invoiceMoney(line.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="invoice-totals ml-auto mt-5 max-w-xs space-y-1 text-sm">
          {(
            [
              ['Subtotal', invoice.subtotal],
              ['Discount', invoice.discountAmount],
              ['VAT / Tax', invoice.taxAmount],
              ['Additional cost', invoice.additionalCost],
              ['Grand total', invoice.grandTotal],
              ['Paid', invoice.paidAmount],
              ['Due', invoice.dueAmount],
            ] as const
          ).map(([label, value]) => (
            <div
              className={`flex justify-between ${label === 'Grand total' ? 'border-t pt-2 font-black' : ''}`}
              key={label}
            >
              <dt>{label}</dt>
              <dd>{invoiceMoney(value)}</dd>
            </div>
          ))}
        </dl>
        {invoice.note && (
          <p className="mt-5 border-t pt-3 text-sm">
            <strong>Note:</strong> {invoice.note}
          </p>
        )}
      </article>
    </div>
  );
}
