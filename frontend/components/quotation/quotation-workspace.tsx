'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Printer, ScanBarcode } from 'lucide-react';
import {
  Button,
  controlClass,
  EmptyState,
  FieldLabel,
  FilterBar,
  FormActions,
  PageHeader,
  SearchInput,
  StatusBadge,
  TableSkeleton,
  textAreaClass,
} from '@/components/ui/primitives';
import {
  convertQuotation,
  createQuotation,
  getQuotation,
  listQuotations,
  loadOptions,
  moveQuotation,
  updateQuotation,
  type QuotationItem,
} from '@/lib/api/service-quotation';
const label = (v: string) =>
    v
      .replaceAll('_', ' ')
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase()),
  tone = (s: string) =>
    s === 'ACCEPTED' || s === 'CONVERTED'
      ? 'success'
      : s === 'REJECTED' || s === 'CANCELLED' || s === 'EXPIRED'
        ? 'danger'
        : s === 'SENT'
          ? 'info'
          : 'warning';
type Line = {
  productId: string;
  description: string;
  quantity: string;
  unitPrice: string;
  discountAmount: string;
  taxAmount: string;
};
const empty = (): Line => ({
  productId: '',
  description: '',
  quantity: '1',
  unitPrice: '0',
  discountAmount: '0',
  taxAmount: '0',
});
const cents = (v: string) => Math.round(Number(v || 0) * 100);
export function QuotationList() {
  const [d, setD] = useState<{ rows: QuotationItem[]; total: number } | null>(null),
    [e, setE] = useState('');
  const load = () =>
    void listQuotations()
      .then(setD)
      .catch((x: unknown) => setE(x instanceof Error ? x.message : 'Unable to load quotations.'));
  useEffect(load, []);
  return (
    <div className="space-y-4">
      <PageHeader
        title="Quotations"
        description="Prepare, approve and convert customer offers without reserving stock."
        actions={
          <Link href="/quotations/new">
            <Button>
              <Plus size={16} />
              Create quotation
            </Button>
          </Link>
        }
      />
      <FilterBar>
        <SearchInput aria-label="Search quotations" placeholder="Quotation no or customer" />
        <select aria-label="Status" className={controlClass + ' sm:w-48'}>
          <option>All statuses</option>
        </select>
      </FilterBar>
      {e ? (
        <div className="rounded-lg border bg-white p-6 text-center">
          <p className="text-rose-700">{e}</p>
          <Button className="mt-3" variant="secondary" onClick={load}>
            Retry
          </Button>
        </div>
      ) : !d ? (
        <TableSkeleton />
      ) : d.rows.length ? (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-left text-xs uppercase text-slate-500">
                <th className="p-3">Quotation</th>
                <th>Customer</th>
                <th>Date</th>
                <th>Valid until</th>
                <th>Status</th>
                <th className="pr-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {d.rows.map((i) => (
                <tr className="border-b hover:bg-slate-50" key={i.id}>
                  <td className="p-3 font-bold">
                    <Link href={`/quotations/${i.id}`}>{i.quotationNumber}</Link>
                  </td>
                  <td>{i.customer?.name ?? i.prospectName ?? 'Walk-in Prospect'}</td>
                  <td>{new Date(i.quotationDate).toLocaleDateString('en-BD')}</td>
                  <td>{new Date(i.validUntil).toLocaleDateString('en-BD')}</td>
                  <td>
                    <StatusBadge tone={tone(i.status)}>{label(i.status)}</StatusBadge>
                  </td>
                  <td className="pr-3 text-right tabular-nums">
                    ৳{Number(i.grandTotal).toLocaleString('en-BD')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="No quotations yet"
          description="Create a professional customer offer."
          action={
            <Link href="/quotations/new">
              <Button>Create quotation</Button>
            </Link>
          }
        />
      )}
    </div>
  );
}
export function QuotationForm({ id }: { id?: string }) {
  const [opts, setOpts] = useState<Awaited<ReturnType<typeof loadOptions>> | null>(null),
    [item, setItem] = useState<QuotationItem | null>(null),
    [lines, setLines] = useState<Line[]>([empty()]),
    [scan, setScan] = useState(''),
    [msg, setMsg] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    void loadOptions()
      .then(setOpts)
      .catch(() => setMsg('Unable to load products and customers.'));
    if (id)
      void getQuotation(id)
        .then((x) => {
          setItem(x);
          setLines(
            x.lines.map((l) => ({
              productId: l.productId,
              description: l.description ?? '',
              quantity: String(l.quantity),
              unitPrice: String(l.unitPrice),
              discountAmount: String(l.discountAmount),
              taxAmount: String(l.taxAmount),
            })),
          );
        })
        .catch(() => setMsg('Unable to load quotation.'));
  }, [id]);
  const preview = useMemo(() => {
    const sub = lines.reduce(
      (s, l) =>
        s +
        Math.round(Number(l.quantity || 0) * cents(l.unitPrice)) -
        cents(l.discountAmount) +
        cents(l.taxAmount),
      0,
    );
    return sub / 100;
  }, [lines]);
  const change = (n: number, k: keyof Line, v: string) =>
    setLines((x) => x.map((l, i) => (i === n ? { ...l, [k]: v } : l)));
  const choose = (n: number, pid: string) => {
    const p = opts?.products.find((x) => x.id === pid);
    setLines((x) =>
      x.map((l, i) =>
        i === n ? { ...l, productId: pid, unitPrice: p?.salePrice ?? l.unitPrice } : l,
      ),
    );
  };
  const scanProduct = () => {
    const p = opts?.products.find(
      (x) =>
        x.barcode?.toLowerCase() === scan.trim().toLowerCase() ||
        x.sku.toLowerCase() === scan.trim().toLowerCase(),
    );
    if (!p) {
      setMsg('No exact product matched this barcode or SKU.');
      return;
    }
    setLines((x) => {
      const n = x.findIndex((l) => l.productId === p.id);
      return n >= 0
        ? x.map((l, i) => (i === n ? { ...l, quantity: String(Number(l.quantity) + 1) } : l))
        : [
            ...x.filter((l) => l.productId),
            { ...empty(), productId: p.id, unitPrice: p.salePrice },
          ];
    });
    setScan('');
    setMsg('');
  };
  const submit = (f: FormData) => {
    const v = (n: string) => {
      const x = f.get(n);
      return typeof x === 'string' ? x : '';
    };
    const payload = {
      customerId: v('customerId') || null,
      prospectName: v('prospectName') || null,
      prospectPhone: v('prospectPhone') || null,
      quotationDate: new Date(v('quotationDate')).toISOString(),
      validUntil: new Date(v('validUntil')).toISOString(),
      reference: v('reference') || null,
      discountAmount: v('discountAmount') || '0',
      taxAmount: v('taxAmount') || '0',
      customerNote: v('customerNote') || null,
      internalNote: v('internalNote') || null,
      terms: v('terms') || null,
      lines: lines.filter((l) => l.productId),
    };
    setBusy(true);
    void (id ? updateQuotation(id, payload) : createQuotation(payload))
      .then((x) => (window.location.href = `/quotations/${x.id}`))
      .catch((x: unknown) => setMsg(x instanceof Error ? x.message : 'Unable to save quotation.'))
      .finally(() => setBusy(false));
  };
  const today = new Date().toISOString().slice(0, 10),
    week = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  return (
    <div className="space-y-4">
      <PageHeader
        title={id ? 'Edit quotation' : 'Create quotation'}
        description="Prepare an offer with server-calculated pricing and validity."
        actions={
          <Link href={id ? `/quotations/${id}` : '/quotations'}>
            <Button variant="secondary">Back</Button>
          </Link>
        }
      />
      <form action={submit} className="space-y-4">
        <section className="grid gap-4 rounded-lg border bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
          <FieldLabel label="Customer">
            <select
              name="customerId"
              defaultValue={item?.customer?.id ?? ''}
              className={'mt-1.5 ' + controlClass}
            >
              <option value="">Walk-in / prospect</option>
              {opts?.customers.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </FieldLabel>
          <FieldLabel label="Prospect name">
            <input
              name="prospectName"
              defaultValue={item?.prospectName ?? ''}
              className={'mt-1.5 ' + controlClass}
            />
          </FieldLabel>
          <FieldLabel label="Quotation date">
            <input
              name="quotationDate"
              type="date"
              defaultValue={item?.quotationDate.slice(0, 10) ?? today}
              className={'mt-1.5 ' + controlClass}
            />
          </FieldLabel>
          <FieldLabel label="Valid until">
            <input
              name="validUntil"
              type="date"
              defaultValue={item?.validUntil.slice(0, 10) ?? week}
              className={'mt-1.5 ' + controlClass}
            />
          </FieldLabel>
        </section>
        <section className="rounded-lg border bg-white p-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <FieldLabel label="Scan product barcode / SKU">
              <input
                value={scan}
                onChange={(e) => setScan(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    scanProduct();
                  }
                }}
                className={'mt-1.5 ' + controlClass}
                placeholder="Scan and press Enter"
              />
            </FieldLabel>
            <Button className="mt-auto" type="button" variant="secondary" onClick={scanProduct}>
              <ScanBarcode size={17} />
              Add scanned product
            </Button>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-slate-500">
                  <th className="py-2">Product</th>
                  <th>Description</th>
                  <th>Qty</th>
                  <th>Unit price</th>
                  <th>Discount</th>
                  <th>VAT</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, n) => (
                  <tr className="border-b" key={n}>
                    <td className="py-2 pr-2">
                      <select
                        value={l.productId}
                        onChange={(e) => choose(n, e.target.value)}
                        className={controlClass}
                      >
                        <option value="">Select product</option>
                        {opts?.products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} · {p.sku}
                          </option>
                        ))}
                      </select>
                    </td>
                    {(
                      [
                        'description',
                        'quantity',
                        'unitPrice',
                        'discountAmount',
                        'taxAmount',
                      ] as const
                    ).map((k) => (
                      <td className="pr-2" key={k}>
                        <input
                          aria-label={label(k)}
                          value={l[k]}
                          onChange={(e) => change(n, k, e.target.value)}
                          className={controlClass}
                        />
                      </td>
                    ))}
                    <td>
                      <Button
                        size="small"
                        type="button"
                        variant="ghost"
                        onClick={() => setLines((x) => x.filter((_, i) => i !== n))}
                      >
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button
            className="mt-3"
            size="small"
            type="button"
            variant="secondary"
            onClick={() => setLines((x) => [...x, empty()])}
          >
            Add line
          </Button>
        </section>
        <section className="grid gap-4 rounded-lg border bg-white p-4 md:grid-cols-[1fr_280px]">
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldLabel label="Terms">
              <textarea
                name="terms"
                defaultValue={item?.terms ?? ''}
                className={'mt-1.5 ' + textAreaClass}
              />
            </FieldLabel>
            <FieldLabel label="Customer note">
              <textarea
                name="customerNote"
                defaultValue={item?.customerNote ?? ''}
                className={'mt-1.5 ' + textAreaClass}
              />
            </FieldLabel>
          </div>
          <div className="space-y-3 rounded-lg bg-slate-50 p-4">
            <div className="flex justify-between">
              <span>Line preview</span>
              <b>৳{preview.toLocaleString('en-BD')}</b>
            </div>
            <FieldLabel label="Document discount">
              <input
                name="discountAmount"
                defaultValue={item?.discountAmount ?? '0'}
                className={'mt-1.5 ' + controlClass}
              />
            </FieldLabel>
            <FieldLabel label="Document VAT">
              <input
                name="taxAmount"
                defaultValue={item?.taxAmount ?? '0'}
                className={'mt-1.5 ' + controlClass}
              />
            </FieldLabel>
            <p className="text-xs text-slate-500">Final totals are confirmed when saved.</p>
          </div>
        </section>
        {msg && (
          <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
            {msg}
          </p>
        )}
        <FormActions>
          <Link href={id ? `/quotations/${id}` : '/quotations'}>
            <Button variant="secondary">Cancel</Button>
          </Link>
          <Button busy={busy}>Save draft</Button>
        </FormActions>
      </form>
    </div>
  );
}
const valid: Record<string, Array<[string, string]>> = {
  DRAFT: [
    ['send', 'Mark sent'],
    ['cancel', 'Cancel'],
  ],
  SENT: [
    ['accept', 'Accept'],
    ['reject', 'Reject'],
    ['cancel', 'Cancel'],
  ],
};
export function QuotationDetail({ id }: { id: string }) {
  const [i, setI] = useState<QuotationItem | null>(null),
    [e, setE] = useState('');
  useEffect(() => {
    void getQuotation(id)
      .then(setI)
      .catch((x: unknown) => setE(x instanceof Error ? x.message : 'Unable to load quotation.'));
  }, [id]);
  const move = (a: string) =>
    void moveQuotation(id, a)
      .then(setI)
      .catch((x: unknown) => setE(x instanceof Error ? x.message : 'Action failed.'));
  const convert = () =>
    void convertQuotation(id)
      .then((x) => setI(x.quotation))
      .catch((x: unknown) => setE(x instanceof Error ? x.message : 'Conversion failed.'));
  if (e && !i)
    return (
      <p role="alert" className="rounded-lg bg-rose-50 p-4 text-rose-700">
        {e}
      </p>
    );
  if (!i) return <TableSkeleton />;
  return (
    <div className="space-y-4">
      <PageHeader
        title={i.quotationNumber}
        description={label(i.status)}
        actions={
          <>
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer size={16} />
              Print
            </Button>
            {i.status === 'DRAFT' && (
              <Link href={`/quotations/${id}/edit`}>
                <Button variant="secondary">Edit</Button>
              </Link>
            )}
          </>
        }
      />
      <section className="rounded-lg border bg-white p-4">
        <div className="grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <span className="text-slate-500">Customer</span>
            <b className="block">{i.customer?.name ?? i.prospectName ?? 'Walk-in Prospect'}</b>
          </div>
          <div>
            <span className="text-slate-500">Date</span>
            <b className="block">{new Date(i.quotationDate).toLocaleDateString('en-BD')}</b>
          </div>
          <div>
            <span className="text-slate-500">Valid until</span>
            <b className="block">{new Date(i.validUntil).toLocaleDateString('en-BD')}</b>
          </div>
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2">Item</th>
                <th>Qty</th>
                <th className="text-right">Price</th>
                <th className="text-right">VAT</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {i.lines.map((l) => (
                <tr className="border-b" key={l.id}>
                  <td className="py-2">
                    {l.product.name}
                    <small className="block text-slate-500">{l.description}</small>
                  </td>
                  <td>{l.quantity}</td>
                  <td className="text-right">{l.unitPrice}</td>
                  <td className="text-right">{l.taxAmount}</td>
                  <td className="text-right font-semibold">{l.lineTotal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="ml-auto mt-4 max-w-xs space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <b>৳{Number(i.subtotal).toLocaleString('en-BD')}</b>
          </div>
          <div className="flex justify-between">
            <span>Discount</span>
            <b>৳{Number(i.discountAmount).toLocaleString('en-BD')}</b>
          </div>
          <div className="flex justify-between">
            <span>VAT</span>
            <b>৳{Number(i.taxAmount).toLocaleString('en-BD')}</b>
          </div>
          <div className="flex justify-between border-t pt-2 text-base">
            <span>Total</span>
            <b>৳{Number(i.grandTotal).toLocaleString('en-BD')}</b>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {(valid[i.status] ?? []).map(([a, l]) => (
            <Button
              key={a}
              variant={a === 'cancel' || a === 'reject' ? 'danger' : 'primary'}
              onClick={() => move(a)}
            >
              {l}
            </Button>
          ))}
          {i.status === 'ACCEPTED' && <Button onClick={convert}>Convert to Sale</Button>}
          {i.convertedSale && (
            <Link href={`/sales/${i.convertedSale.id}`}>
              <Button variant="secondary">Open draft sale</Button>
            </Link>
          )}
        </div>
      </section>
      <section className="print-only hidden">
        <h1>{i.business.name}</h1>
        <h2>QUOTATION</h2>
        <p>{i.quotationNumber}</p>
        <p>
          Date: {new Date(i.quotationDate).toLocaleDateString('en-BD')} · Valid until:{' '}
          {new Date(i.validUntil).toLocaleDateString('en-BD')}
        </p>
        <p>Customer: {i.customer?.name ?? i.prospectName ?? 'Walk-in Prospect'}</p>
        <table>
          <tbody>
            {i.lines.map((l) => (
              <tr key={l.id}>
                <td>{l.product.name}</td>
                <td>{l.quantity}</td>
                <td>{l.lineTotal}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <h3>Total: ৳{Number(i.grandTotal).toLocaleString('en-BD')}</h3>
        {i.terms && <p>Terms: {i.terms}</p>}
      </section>
    </div>
  );
}
