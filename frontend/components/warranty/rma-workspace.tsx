'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  Printer,
  Search,
  ShieldCheck,
} from 'lucide-react';
import {
  Button,
  EmptyState,
  PageHeader,
  StatusBadge,
  TableSkeleton,
} from '@/components/ui/primitives';
import {
  checkWarranty,
  createRma,
  getRma,
  getSerialHistory,
  listRmas,
  listWarrantySerials,
  transitionRma,
  updateRma,
  type RmaItem,
  type SerialDetail,
} from '@/lib/api/rma';
import QRCode from 'qrcode';
const label = (value: string) =>
  value
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
const tone = (status: string) =>
  status === 'DELIVERED'
    ? 'success'
    : status === 'CANCELLED' || status === 'REJECTED'
      ? 'danger'
      : status === 'READY_FOR_CUSTOMER'
        ? 'info'
        : 'warning';
function TrackingQr({ url }: { url: string }) {
  const [source, setSource] = useState('');
  useEffect(() => {
    void QRCode.toDataURL(url, { width: 176, margin: 1, errorCorrectionLevel: 'M' }).then(
      setSource,
    );
  }, [url]);
  return source ? (
    <img className="size-36" src={source} alt="QR code for public RMA tracking" />
  ) : (
    <span
      className="block size-36 animate-pulse rounded bg-slate-100"
      aria-label="Generating tracking QR code"
    />
  );
}
export function WarrantyCheck() {
  const [serial, setSerial] = useState(''),
    [result, setResult] = useState<Awaited<ReturnType<typeof checkWarranty>> | null>(null),
    [message, setMessage] = useState('');
  const submit = () => {
    setMessage('');
    void checkWarranty(serial)
      .then(setResult)
      .catch((e: unknown) =>
        setMessage(e instanceof Error ? e.message : 'Unable to check warranty.'),
      );
  };
  return (
    <div className="space-y-5">
      <PageHeader
        title="Warranty Check"
        description="Verify coverage from the posted sale and authoritative Serial/IMEI history."
      />
      <section className="rounded-xl border bg-white p-5">
        <label className="text-sm font-semibold" htmlFor="serial">
          Serial / IMEI
        </label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            id="serial"
            value={serial}
            onChange={(e) => setSerial(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
            }}
            className="h-11 flex-1 rounded-lg border px-3 font-mono"
            placeholder="Scan or enter exact Serial/IMEI"
          />
          <Button onClick={submit} disabled={!serial.trim()}>
            <Search size={17} />
            Check warranty
          </Button>
        </div>
        {message && (
          <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
            {message}
          </p>
        )}
        {result && (
          <div className="mt-5 grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
            <div>
              <StatusBadge tone={result.eligible ? 'success' : 'danger'}>
                {result.eligible ? 'Eligible' : 'Not eligible'}
              </StatusBadge>
              <h2 className="mt-2 font-bold">{result.serialItem.product.name}</h2>
              <p className="font-mono text-sm">{result.serialItem.serialNumber}</p>
            </div>
            <div className="text-sm">
              <p>
                Reason: <b>{label(result.reason)}</b>
              </p>
              <p>Invoice: {result.serialItem.sale.invoiceNumber}</p>
              <p>
                Coverage ends:{' '}
                {result.warrantyEnd
                  ? new Date(result.warrantyEnd).toLocaleDateString('en-BD')
                  : 'Not configured'}
              </p>
              {result.eligible && (
                <Link
                  className="mt-3 inline-block font-semibold text-emerald-700"
                  href={`/warranty/rma/new?serial=${encodeURIComponent(result.serialItem.serialNumber)}`}
                >
                  Open RMA →
                </Link>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
export function RmaList() {
  const [data, setData] = useState<{ items: RmaItem[]; total: number } | null>(null),
    [error, setError] = useState('');
  useEffect(() => {
    void listRmas()
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Unable to load RMAs.'));
  }, []);
  return (
    <div className="space-y-5">
      <PageHeader
        title="RMA Management"
        description="Customer warranty intake, supplier processing, and delivery history."
        actions={
          <Link
            href="/warranty/rma/new"
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white"
          >
            New RMA
          </Link>
        }
      />
      {error && (
        <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </p>
      )}{' '}
      {!data && !error ? (
        <div className="rounded-xl border bg-white">
          <TableSkeleton />
        </div>
      ) : data?.items.length ? (
        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-slate-500">
                <th className="p-3">RMA</th>
                <th>Product / Serial</th>
                <th>Customer</th>
                <th>Received</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((i) => (
                <tr key={i.id} className="border-b">
                  <td className="p-3 font-bold">
                    <Link href={`/warranty/rma/${i.id}`}>{i.rmaNumber}</Link>
                    <small className="block font-normal text-slate-500">
                      {i.sale.invoiceNumber}
                    </small>
                  </td>
                  <td>
                    {i.product.name}
                    <small className="block font-mono">
                      {i.serialItem?.serialNumber ?? 'Non-serialized'}
                    </small>
                  </td>
                  <td>{i.customer?.name ?? 'Walk-in Customer'}</td>
                  <td>{new Date(i.receivedAt).toLocaleDateString('en-BD')}</td>
                  <td>
                    <StatusBadge tone={tone(i.status)}>{label(i.status)}</StatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border bg-white">
          <EmptyState
            title="No RMA cases"
            description="Warranty claims will appear here after intake."
          />
        </div>
      )}
    </div>
  );
}
export function RmaForm() {
  const query = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search),
    [serial, setSerial] = useState(query?.get('serial') ?? ''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  const submit = (form: FormData) => {
    setBusy(true);
    setMessage('');
    const value = (name: string) => {
      const entry = form.get(name);
      return typeof entry === 'string' ? entry : '';
    };
    void createRma({
      serialNumber: serial,
      issue: value('issue'),
      issueDescription: value('description'),
      physicalCondition: value('condition'),
      accessories: form.getAll('accessories').filter((entry): entry is string => typeof entry === 'string'),
      conditionNote: value('conditionNote') || null,
      customerNotes: value('customerNotes') || null,
    })
      .then((item) => {
        window.location.href = `/warranty/rma/${item.id}`;
      })
      .catch((e: unknown) => setMessage(e instanceof Error ? e.message : 'Unable to create RMA.'))
      .finally(() => setBusy(false));
  };
  return (
    <div className="space-y-5">
      <PageHeader
        title="Receive Warranty Item"
        description="Capture the item condition and issue against its authoritative sale."
      />
      <form action={submit} className="grid gap-5 rounded-xl border bg-white p-5 lg:grid-cols-2">
        <label className="text-sm font-semibold">
          Serial / IMEI
          <input
            required
            value={serial}
            onChange={(e) => setSerial(e.target.value)}
            className="mt-2 h-11 w-full rounded-lg border px-3 font-mono"
            placeholder="Scan or enter exact value"
          />
        </label>
        <label className="text-sm font-semibold">
          Issue
          <select name="issue" className="mt-2 h-11 w-full rounded-lg border px-3">
            <option value="NOT_POWERING_ON">Not powering on</option>
            <option value="DISPLAY_ISSUE">Display issue</option>
            <option value="BATTERY_ISSUE">Battery issue</option>
            <option value="CHARGING_ISSUE">Charging issue</option>
            <option value="HARDWARE_FAILURE">Hardware failure</option>
            <option value="SOFTWARE_ISSUE">Software issue</option>
            <option value="PHYSICAL_DAMAGE">Physical damage</option>
            <option value="OTHER">Other</option>
          </select>
        </label>
        <label className="text-sm font-semibold">
          Physical condition
          <select name="condition" className="mt-2 h-11 w-full rounded-lg border px-3">
            <option>GOOD</option>
            <option>SCRATCHED</option>
            <option>DENTED</option>
            <option>BROKEN</option>
            <option>LIQUID_DAMAGE</option>
            <option>OTHER</option>
          </select>
        </label>
        <label className="text-sm font-semibold lg:col-span-2">
          Issue details
          <textarea
            required
            minLength={5}
            name="description"
            className="mt-2 min-h-28 w-full rounded-lg border p-3"
            placeholder="Describe the reported fault and intake observations."
          />
        </label>
        <label className="text-sm font-semibold lg:col-span-2">Condition notes<textarea name="conditionNote" className="mt-2 min-h-20 w-full rounded-lg border p-3" placeholder="Scratches, dents, seals, or liquid indicators."/></label>
        <fieldset className="lg:col-span-2"><legend className="text-sm font-semibold">Accessories received</legend><div className="mt-2 flex flex-wrap gap-3">{['CHARGER','BOX','CABLE','ADAPTER','BATTERY','BAG','OTHER'].map((entry)=><label key={entry} className="flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm"><input name="accessories" type="checkbox" value={entry}/>{label(entry)}</label>)}</div></fieldset>
        <label className="text-sm font-semibold lg:col-span-2">Customer notes<textarea name="customerNotes" className="mt-2 min-h-20 w-full rounded-lg border p-3" placeholder="Customer-visible intake notes."/></label>
        {message && (
          <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 lg:col-span-2">
            {message}
          </p>
        )}
        <div className="lg:col-span-2">
          <Button disabled={busy}>{busy ? 'Receiving…' : 'Receive RMA'}</Button>
        </div>
      </form>
    </div>
  );
}
const actionFor: Record<string, Array<[string, string]>> = {
  RECEIVED: [
    ['inspect', 'Start inspection'],
    ['cancel', 'Cancel'],
  ],
  INSPECTING: [
    ['approve', 'Approve'],
    ['reject', 'Reject'],
  ],
  APPROVED: [
    ['send-supplier', 'Send to supplier'],
    ['ready', 'Ready for customer'],
  ],
  REJECTED: [['ready', 'Ready for customer']],
  SENT_TO_SUPPLIER: [
    ['supplier-processing', 'Supplier processing'],
    ['receive-supplier', 'Receive from supplier'],
  ],
  SUPPLIER_PROCESSING: [['receive-supplier', 'Receive from supplier']],
  SUPPLIER_RETURNED: [['ready', 'Ready for customer']],
  READY_FOR_CUSTOMER: [['deliver', 'Deliver to customer']],
};
export function RmaDetail({ id }: { id: string }) {
  const [item, setItem] = useState<RmaItem | null>(null),
    [error, setError] = useState('');
  useEffect(() => {
    void getRma(id)
      .then(setItem)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Unable to load RMA.'));
  }, [id]);
  const move = (action: string) => {
    void transitionRma(id, action)
      .then(setItem)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Transition failed.'));
  };
  if (error && !item)
    return (
      <p role="alert" className="rounded-lg bg-rose-50 p-4 text-rose-700">
        {error}
      </p>
    );
  if (!item) return <TableSkeleton />;
  const tracking = `${window.location.origin}/track/rma/${item.publicToken}`;
  return (
    <div className="space-y-5">
      <PageHeader
        title={item.rmaNumber}
        description={`${item.product.name} · ${item.serialItem?.serialNumber ?? 'Non-serialized item'}`}
        actions={
          <>
            <Link className="inline-flex h-10 items-center rounded-lg border px-4 text-sm font-semibold" href={`/warranty/rma/${id}/edit`}>Edit case</Link>
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer size={17} />
              Print receipt
            </Button>
            <a
              className="inline-flex h-10 items-center gap-2 rounded-lg border px-4 text-sm font-semibold"
              target="_blank"
              rel="noreferrer"
              href={tracking}
            >
              <ExternalLink size={16} />
              Public tracking
            </a>
          </>
        }
      />
      {error && (
        <p role="alert" className="rounded-lg bg-rose-50 p-3 text-rose-700">
          {error}
        </p>
      )}
      <div className="grid gap-5 lg:grid-cols-[1.4fr_.8fr]">
        <section className="rounded-xl border bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">Case details</h2>
            <StatusBadge tone={tone(item.status)}>{label(item.status)}</StatusBadge>
          </div>
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Invoice</dt>
              <dd className="font-semibold">{item.sale.invoiceNumber}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Customer</dt>
              <dd className="font-semibold">{item.customer?.name ?? 'Walk-in Customer'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Reported issue</dt>
              <dd>
                {label(item.issue)} — {item.issueDescription}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Physical condition</dt>
              <dd>{label(item.physicalCondition)}</dd>
            </div>
          </dl>
          <div className="mt-5 flex flex-wrap gap-2">
            {(actionFor[item.status] ?? []).map(([a, l]) => (
              <Button
                key={a}
                variant={a === 'cancel' || a === 'reject' ? 'danger' : 'primary'}
                onClick={() => move(a)}
              >
                {l}
              </Button>
            ))}
          </div>
        </section>
        <section className="rounded-xl border bg-white p-5">
          <h2 className="flex items-center gap-2 font-bold">
            <ClipboardCheck size={18} />
            Timeline
          </h2>
          <ol className="mt-4 space-y-4">
            {item.history.map((h) => (
              <li key={h.id} className="border-l-2 border-emerald-200 pl-4">
                <b className="text-sm">{label(h.toStatus)}</b>
                <p className="text-xs text-slate-500">
                  {new Date(h.createdAt).toLocaleString('en-BD')} · {h.actor.displayName}
                </p>
                {h.note && <p className="mt-1 text-sm">{h.note}</p>}
              </li>
            ))}
          </ol>
        </section>
      </div>
      <section className="print-only hidden">
        <TrackingQr url={tracking} />
        <h1>{item.business?.name}</h1>
        <h2>RMA Receipt — {item.rmaNumber}</h2>
        <p>
          {item.product.name} / {item.serialItem?.serialNumber}
        </p>
        <p>Track: {tracking}</p>
      </section>
    </div>
  );
}
export function RmaEdit({id}:{id:string}){
 const [item,setItem]=useState<RmaItem|null>(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{void getRma(id).then(setItem).catch((e:unknown)=>setMessage(e instanceof Error?e.message:'Unable to load RMA.'))},[id]);
 if(!item&&!message)return <TableSkeleton/>;
 const submit=(form:FormData)=>{const text=(name:string)=>{const value=form.get(name);return typeof value==='string'?value:''};setBusy(true);void updateRma(id,{conditionNote:text('conditionNote')||null,accessoriesNote:text('accessoriesNote')||null,customerNotes:text('customerNotes')||null,internalNotes:text('internalNotes')||null,supplierReference:text('supplierReference')||null,courierReference:text('courierReference')||null}).then(updated=>{setItem(updated);setMessage('RMA details saved.')}).catch((e:unknown)=>setMessage(e instanceof Error?e.message:'Unable to save RMA.')).finally(()=>setBusy(false))};
 return <div className="space-y-5"><PageHeader title={item?`Edit ${item.rmaNumber}`:'Edit RMA'} description="Update operational notes and supplier references. Source sale and serial are immutable."/><form action={submit} className="grid gap-4 rounded-xl border bg-white p-5 sm:grid-cols-2"><label className="text-sm font-semibold">Condition notes<textarea name="conditionNote" defaultValue={item?.conditionNote??''} className="mt-2 min-h-24 w-full rounded-lg border p-3"/></label><label className="text-sm font-semibold">Accessories notes<textarea name="accessoriesNote" defaultValue={item?.accessoriesNote??''} className="mt-2 min-h-24 w-full rounded-lg border p-3"/></label><label className="text-sm font-semibold">Customer notes<textarea name="customerNotes" defaultValue={item?.customerNotes??''} className="mt-2 min-h-24 w-full rounded-lg border p-3"/></label><label className="text-sm font-semibold">Internal notes<textarea name="internalNotes" defaultValue={item?.internalNotes??''} className="mt-2 min-h-24 w-full rounded-lg border p-3"/></label><label className="text-sm font-semibold">Supplier reference<input name="supplierReference" className="mt-2 h-11 w-full rounded-lg border px-3"/></label><label className="text-sm font-semibold">Courier reference<input name="courierReference" className="mt-2 h-11 w-full rounded-lg border px-3"/></label>{message&&<p role="status" className="rounded-lg bg-slate-50 p-3 text-sm sm:col-span-2">{message}</p>}<div className="flex gap-2 sm:col-span-2"><Button disabled={busy}>{busy?'Saving…':'Save changes'}</Button><Link className="inline-flex h-10 items-center rounded-lg border px-4 text-sm font-semibold" href={`/warranty/rma/${id}`}>Cancel</Link></div></form></div>;
}
export function SerialList() {
  const [data, setData] = useState<{ rows: SerialDetail[]; total: number } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    void listWarrantySerials()
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Unable to load serials.'));
  }, []);
  return (
    <div className="space-y-5">
      <PageHeader title="Serial / IMEI Lifecycle" description="Tenant-scoped sale, warranty, and RMA status history." actions={<Link className="rounded-lg border bg-white px-4 py-2 text-sm font-semibold" href="/warranty/check">Check warranty</Link>} />
      {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-rose-700">{error}</p>}
      {!data && !error ? <TableSkeleton /> : (
        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="w-full min-w-[760px] text-sm"><thead><tr className="border-b text-left text-xs text-slate-500"><th className="p-3">Serial / IMEI</th><th>Product</th><th>Warehouse</th><th>Warranty end</th><th>Status</th></tr></thead>
            <tbody>{data?.rows.map((row) => <tr className="border-b" key={row.id}><td className="p-3 font-mono font-semibold"><Link href={`/warranty/serials/${row.id}`}>{row.serialNumber}</Link></td><td>{row.product.name}<small className="block text-slate-500">{row.product.sku}</small></td><td>{row.warehouse.name}</td><td>{row.warrantyEnd ? new Date(row.warrantyEnd).toLocaleDateString('en-BD') : 'Not configured'}</td><td><StatusBadge tone={row.status === 'SOLD' ? 'success' : row.status === 'IN_RMA' ? 'warning' : 'neutral'}>{label(row.status)}</StatusBadge></td></tr>)}</tbody>
          </table>
          {data && !data.rows.length && <EmptyState title="No serial records" description="Serialized inventory will appear here." />}
        </div>
      )}
    </div>
  );
}
export function SerialDetailView({ id }: { id: string }) {
  const [item, setItem] = useState<SerialDetail | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    void getSerialHistory(id).then(setItem).catch((e: unknown) => setError(e instanceof Error ? e.message : 'Unable to load serial history.'));
  }, [id]);
  if (error) return <p role="alert" className="rounded-lg bg-rose-50 p-4 text-rose-700">{error}</p>;
  if (!item) return <TableSkeleton />;
  return (
    <div className="space-y-5">
      <PageHeader title={item.serialNumber} description={`${item.product.name} · ${item.product.sku}`} actions={<Link className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white" href={`/warranty/check?serial=${encodeURIComponent(item.serialNumber)}`}>Check warranty</Link>} />
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-xl border bg-white p-5"><h2 className="font-bold">Lifecycle status</h2><div className="mt-3"><StatusBadge tone={item.status === 'IN_RMA' ? 'warning' : 'success'}>{label(item.status)}</StatusBadge></div><dl className="mt-4 grid gap-3 text-sm"><div><dt className="text-slate-500">Warranty start</dt><dd>{item.warrantyStart ? new Date(item.warrantyStart).toLocaleDateString('en-BD') : 'Not configured'}</dd></div><div><dt className="text-slate-500">Warranty end</dt><dd>{item.warrantyEnd ? new Date(item.warrantyEnd).toLocaleDateString('en-BD') : 'Not configured'}</dd></div></dl></section>
        <section className="rounded-xl border bg-white p-5"><h2 className="font-bold">Append-only history</h2><ol className="mt-4 space-y-3">{item.history.map((h) => <li key={h.id} className="border-l-2 border-emerald-200 pl-3"><b className="text-sm">{label(h.eventType)}</b><p className="text-xs text-slate-500">{new Date(h.occurredAt).toLocaleString('en-BD')} · {h.referenceType}</p></li>)}</ol>{!item.history.length && <p className="mt-4 text-sm text-slate-500">No lifecycle events recorded.</p>}</section>
      </div>
      {item.rmas.length > 0 && <section className="rounded-xl border bg-white p-5"><h2 className="font-bold">RMA cases</h2><div className="mt-3 flex flex-wrap gap-2">{item.rmas.map((r) => <Link key={r.id} className="rounded-lg border px-3 py-2 text-sm font-semibold" href={`/warranty/rma/${r.id}`}>{r.rmaNumber} · {label(r.status)}</Link>)}</div></section>}
    </div>
  );
}
export function PublicRmaTracking({ token }: { token: string }) {
  const [item, setItem] = useState<{
      rmaNumber: string;
      status: string;
      receivedAt: string;
      business: { name: string };
      product: { name: string };
      serialItem: { serialNumber: string } | null;
      history: Array<{ toStatus: string; createdAt: string }>;
    } | null>(null),
    [error, setError] = useState('');
  useEffect(() => {
    void fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'}/track/rma/${encodeURIComponent(token)}`,
    )
      .then(async (r) => {
        const p = (await r.json()) as { data?: typeof item; error?: { message?: string } };
        if (!r.ok || !p.data) throw new Error(p.error?.message ?? 'Tracking reference not found.');
        setItem(p.data);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Unable to load tracking.'));
  }, [token]);
  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-12">
      <div className="mb-8 flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-xl bg-emerald-700 text-white">
          <ShieldCheck />
        </span>
        <div>
          <b>Hello Shop Warranty</b>
          <p className="text-sm text-slate-500">Secure customer tracking</p>
        </div>
      </div>
      {error ? (
        <p role="alert" className="rounded-xl bg-rose-50 p-4 text-rose-700">
          {error}
        </p>
      ) : !item ? (
        <TableSkeleton />
      ) : (
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <StatusBadge tone={tone(item.status)}>{label(item.status)}</StatusBadge>
          <h1 className="mt-3 text-2xl font-bold">{item.rmaNumber}</h1>
          <p className="mt-1 text-slate-600">
            {item.business.name} · {item.product.name}
          </p>
          {item.serialItem && (
            <p className="mt-1 font-mono text-sm text-slate-500">{item.serialItem.serialNumber}</p>
          )}
          <ol className="mt-8 space-y-5">
            {item.history.map((h, index) => (
              <li key={h.createdAt} className="flex gap-3">
                <CheckCircle2
                  className={
                    index === item.history.length - 1 ? 'text-emerald-600' : 'text-slate-300'
                  }
                  size={20}
                />
                <div>
                  <b>{label(h.toStatus)}</b>
                  <p className="text-sm text-slate-500">
                    {new Date(h.createdAt).toLocaleString('en-BD')}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
    </main>
  );
}
