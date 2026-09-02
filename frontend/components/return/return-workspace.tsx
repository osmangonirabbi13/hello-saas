'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ScanBarcode, Printer } from 'lucide-react';
import { Button, PageHeader, StatusBadge } from '@/components/ui/primitives';
import { SerialEntry } from '@/components/scanner/serial-entry';
import { ApprovalRequiredNotice } from '@/components/team-security/approval-required-notice';
import { ApprovalRequiredError } from '@/lib/api/api-error';
import {
  createReturn,
  getReturn,
  getReturnable,
  listReturns,
  postReturn,
  updateReturn,
  type ReturnKind,
} from '@/lib/api/returns';

type Line = {
  id: string;
  product: { name: string; sku: string; serialized: boolean };
  quantity: string;
  returnedQuantity: number;
  returnableQuantity: number;
  eligibleSerials: string[];
  unitCost?: string;
  unitPrice?: string;
};
type Source = {
  id: string;
  purchaseNumber?: string;
  saleNumber?: string;
  invoiceNumber?: string;
  supplier?: { name: string };
  customer?: { name: string } | null;
  lines: Line[];
};
type Item = {
  id: string;
  returnNumber: string;
  status: 'DRAFT' | 'POSTED';
  returnDate: string;
  grandTotal: string;
  reason: string;
  purchaseId?: string;
  saleId?: string;
  purchase?: { purchaseNumber: string };
  sale?: { saleNumber: string; invoiceNumber: string };
  supplier?: { name: string };
  customer?: { name: string } | null;
  business?: { name: string };
  lines?: Array<{
    id: string;
    quantity: string;
    lineTotal: string;
    serialNumbers: string[];
    product: { name: string; sku: string };
    purchaseLineId?: string;
    saleLineId?: string;
  }>;
  createdBy?: { displayName: string };
};
const label = (kind: ReturnKind) => (kind === 'purchase' ? 'Purchase Return' : 'Sale Return');
export function ReturnList({ kind }: { kind: ReturnKind }) {
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    void listReturns<Item>(kind)
      .then(setItems)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Unable to load returns.'));
  }, [kind]);
  return (
    <div className="space-y-5">
      <PageHeader
        title={label(kind) + ' List'}
        description="Independent, auditable return documents."
        actions={
          <Link
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white"
            href={`/${kind}s/returns/new`}
          >
            New {label(kind)}
          </Link>
        }
      />
      {error && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-slate-500">
              <th className="p-3">Return No</th>
              <th>Original</th>
              <th>Party</th>
              <th>Date</th>
              <th>Status</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr className="border-b" key={item.id}>
                <td className="p-3 font-bold">
                  <Link href={`/${kind}s/returns/${item.id}`}>{item.returnNumber}</Link>
                </td>
                <td>{item.purchase?.purchaseNumber ?? item.sale?.invoiceNumber}</td>
                <td>{item.supplier?.name ?? item.customer?.name ?? 'Walk-in Customer'}</td>
                <td>{new Date(item.returnDate).toLocaleDateString('en-BD')}</td>
                <td>
                  <StatusBadge tone={item.status === 'POSTED' ? 'success' : 'info'}>
                    {item.status}
                  </StatusBadge>
                </td>
                <td>৳{Number(item.grandTotal).toLocaleString('en-BD')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!items.length && !error && (
          <p className="p-8 text-center text-sm text-slate-500">No return documents yet.</p>
        )}
      </div>
    </div>
  );
}
export function ReturnForm({ kind, id }: { kind: ReturnKind; id?: string }) {
  const [sourceId, setSourceId] = useState('');
  const [source, setSource] = useState<Source | null>(null);
  const [qty, setQty] = useState<Record<string, string>>({});
  const [serials, setSerials] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (!id) return;
    void getReturn<Item>(kind, id)
      .then(async (draft) => {
        if (draft.status !== 'DRAFT') throw new Error('Only a draft return can be edited.');
        const sourceKey = kind === 'purchase' ? draft.purchaseId : draft.saleId;
        if (!sourceKey) throw new Error('Original document was not found.');
        const loaded = await getReturnable<Source>(kind, sourceKey);
        setSourceId(sourceKey);
        setSource(loaded);
        setQty(
          Object.fromEntries(
            (draft.lines ?? []).map((line) => [
              line.purchaseLineId ?? line.saleLineId ?? '',
              line.quantity,
            ]),
          ),
        );
        setSerials(
          Object.fromEntries(
            (draft.lines ?? []).map((line) => [
              line.purchaseLineId ?? line.saleLineId ?? '',
              line.serialNumbers.join('\n'),
            ]),
          ),
        );
      })
      .catch((e: unknown) =>
        setMessage(e instanceof Error ? e.message : 'Unable to load draft return.'),
      );
  }, [id, kind]);
  const load = () => {
    if (!navigator.onLine) return setMessage('Internet connection required for returns.');
    void getReturnable<Source>(kind, sourceId)
      .then(setSource)
      .catch((e: unknown) =>
        setMessage(e instanceof Error ? e.message : 'Original document not found.'),
      );
  };
  const save = () => {
    if (!source) return;
    const lines = source.lines
      .filter((l) => Number(qty[l.id] ?? 0) > 0)
      .map((l) => ({
        sourceLineId: l.id,
        quantity: qty[l.id],
        serialNumbers: (serials[l.id] ?? '')
          .split(/[\n,]+/)
          .map((s) => s.trim())
          .filter(Boolean),
      }));
    const payload = {
      sourceId: source.id,
      returnDate: new Date().toISOString(),
      reason: kind === 'purchase' ? 'OTHER' : 'CUSTOMER_RETURN',
      note: null,
      lines,
    };
    void (id ? updateReturn<Item>(kind, id, payload) : createReturn<Item>(kind, payload))
      .then((item) => location.assign(`/${kind}s/returns/${item.id}`))
      .catch((e: unknown) => setMessage(e instanceof Error ? e.message : 'Unable to save return.'));
  };
  return (
    <div className="space-y-5">
      <PageHeader
        title={(id ? 'Edit ' : 'New ') + label(kind)}
        description="Select a posted source document. Remaining quantities are verified by the server."
      />
      <section className="rounded-xl border bg-white p-5">
        <label className="text-sm font-bold">
          Original {kind === 'purchase' ? 'Purchase ID' : 'Sale ID'}
          <div className="mt-2 flex gap-2">
            <input
              className="h-11 flex-1 rounded-lg border px-3"
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
            />
            <Button onClick={load}>Load returnable items</Button>
          </div>
        </label>
      </section>
      {message && (
        <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          {message}
        </p>
      )}
      {source && (
        <section className="rounded-xl border bg-white p-5">
          <h2 className="font-bold">{source.purchaseNumber ?? source.invoiceNumber}</h2>
          <p className="text-sm text-slate-500">
            {source.supplier?.name ?? source.customer?.name ?? 'Walk-in Customer'}
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[780px] text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th>Product</th>
                  <th>Original</th>
                  <th>Returned</th>
                  <th>Returnable</th>
                  <th>Return Qty</th>
                  <th>Serial / IMEI</th>
                </tr>
              </thead>
              <tbody>
                {source.lines.map((line) => (
                  <tr className="border-b align-top" key={line.id}>
                    <td className="py-3">
                      <strong>{line.product.name}</strong>
                      <span className="block text-xs">{line.product.sku}</span>
                    </td>
                    <td>{line.quantity}</td>
                    <td>{line.returnedQuantity}</td>
                    <td>{line.returnableQuantity}</td>
                    <td>
                      <input
                        aria-label={'Return quantity for ' + line.product.name}
                        className="h-10 w-24 rounded border px-2"
                        min="0"
                        max={line.returnableQuantity}
                        type="number"
                        value={qty[line.id] ?? ''}
                        onChange={(e) => setQty((v) => ({ ...v, [line.id]: e.target.value }))}
                      />
                    </td>
                    <td>
                      {line.product.serialized ? (
                        <label className="block">
                          <span className="inline-flex items-center gap-1 text-xs font-bold">
                            <ScanBarcode size={14} />
                            Scan or select Serial / IMEI
                          </span>
                          <div className="mt-1 w-72 max-w-full">
                            <SerialEntry
                              mode="select"
                              productName={line.product.name}
                              required={Number(qty[line.id] ?? 0)}
                              available={line.eligibleSerials}
                              value={serials[line.id] ?? ''}
                              onChange={(value) => setSerials((v) => ({ ...v, [line.id]: value }))}
                            />
                          </div>
                        </label>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-5 flex justify-end">
            <Button onClick={save}>Save Draft</Button>
          </div>
        </section>
      )}
    </div>
  );
}
export function ReturnDetail({ kind, id }: { kind: ReturnKind; id: string }) {
  const [item, setItem] = useState<Item | null>(null);
  const [error, setError] = useState('');
  const [approval, setApproval] = useState<ApprovalRequiredError | null>(null);
  useEffect(() => {
    void getReturn<Item>(kind, id)
      .then(setItem)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Unable to load return.'));
  }, [kind, id]);
  if (error) return <p className="rounded-lg bg-rose-50 p-4">{error}</p>;
  if (!item) return <p>Loading return…</p>;
  const post = () =>
    void postReturn<Item>(kind, id)
      .then(setItem)
      .catch((e: unknown) => {
        if (e instanceof ApprovalRequiredError) setApproval(e);
        else setError(e instanceof Error ? e.message : 'Unable to post return.');
      });
  return (
    <div className="return-print space-y-5">
      {approval ? <ApprovalRequiredNotice error={approval} /> : null}
      <PageHeader
        title={item.returnNumber}
        description={label(kind)}
        actions={
          <div className="no-print flex gap-2">
            {item.status === 'DRAFT' && (
              <>
                <Link
                  className="rounded-lg border px-4 py-2 text-sm font-semibold"
                  href={`/${kind}s/returns/${id}/edit`}
                >
                  Edit Draft
                </Link>
                <Button onClick={post}>Post Return</Button>
              </>
            )}
            {item.status === 'POSTED' && (
              <Button variant="secondary" onClick={() => window.print()}>
                <Printer size={16} />
                Print
              </Button>
            )}
          </div>
        }
      />
      <article className="return-sheet rounded-xl border bg-white p-6">
        <header className="border-b pb-4">
          <h2 className="text-xl font-black">{item.business?.name}</h2>
          <p>{kind === 'sale' ? 'Sale Return Receipt' : 'Purchase Return Document'}</p>
        </header>
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt>Return</dt>
            <dd>{item.returnNumber}</dd>
          </div>
          <div>
            <dt>Original</dt>
            <dd>{item.purchase?.purchaseNumber ?? item.sale?.invoiceNumber}</dd>
          </div>
          <div>
            <dt>Party</dt>
            <dd>{item.supplier?.name ?? item.customer?.name ?? 'Walk-in Customer'}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{item.status}</dd>
          </div>
        </dl>
        <table className="mt-5 w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th>Product</th>
              <th>Qty</th>
              <th className="text-right">Value</th>
            </tr>
          </thead>
          <tbody>
            {item.lines?.map((line) => (
              <tr className="border-b align-top" key={line.id}>
                <td className="py-2">
                  {line.product.name}
                  <span className="block text-xs">{line.product.sku}</span>
                  {line.serialNumbers.map((s) => (
                    <span className="block font-mono text-xs" key={s}>
                      IMEI/Serial: {s}
                    </span>
                  ))}
                </td>
                <td>{line.quantity}</td>
                <td className="text-right">৳{Number(line.lineTotal).toLocaleString('en-BD')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-5 text-right text-lg font-black">
          Return value: ৳{Number(item.grandTotal).toLocaleString('en-BD')}
        </p>
        {kind === 'sale' && (
          <p className="mt-2 text-right text-xs text-slate-500">
            Refund settlement will be handled separately.
          </p>
        )}
        {item.status === 'DRAFT' && (
          <p className="mt-4 font-bold text-amber-700">DRAFT — NOT A FINAL RETURN DOCUMENT</p>
        )}
      </article>
    </div>
  );
}
