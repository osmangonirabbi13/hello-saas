'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  Button,
  controlClass,
  EmptyState,
  FilterBar,
  FieldLabel,
  FormActions,
  PageHeader,
  StatusBadge,
  TableSkeleton,
  textAreaClass,
} from '@/components/ui/primitives';
import { damageApi, damageOptions, type Damage } from '@/lib/api/damage-expense';
import { ApprovalRequiredNotice } from '@/components/team-security/approval-required-notice';
import { ApprovalRequiredError } from '@/lib/api/api-error';
import { parseSerials } from '@/lib/transaction-scanner';
const label = (x: string) =>
  x
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
export function DamageList() {
  const [data, setData] = useState<Damage[] | null>(null),
    [options, setOptions] = useState<Awaited<ReturnType<typeof damageOptions>> | null>(null),
    [error, setError] = useState('');
  const load = (query = '') =>
    void damageApi
      .list(query)
      .then((x) => setData(x.rows))
      .catch((e) => setError(e instanceof Error ? e.message : 'Unable to load damage records.'));
  useEffect(() => {
    load();
    void damageOptions().then(setOptions);
  }, []);
  return (
    <>
      <PageHeader
        title="Damage Stock"
        description="Record non-sellable inventory while preserving stock and serial history."
        actions={
          <Link href="/damages/new">
            <Button>Record Damage</Button>
          </Link>
        }
      />
      <FilterBar>
        <form
          className="grid w-full gap-2 sm:grid-cols-2 lg:grid-cols-6"
          action={(f) => {
            const p = new URLSearchParams();
            for (const key of ['search', 'status', 'warehouseId', 'reason', 'dateFrom', 'dateTo']) {
              const value = f.get(key);
              if (typeof value === 'string' && value) p.set(key, value);
            }
            load(`?${p}`);
          }}
        >
          <input
            name="search"
            aria-label="Search damage"
            placeholder="Damage, product or IMEI"
            className={controlClass}
          />
          <select name="status" aria-label="Damage status" className={controlClass}>
            <option value="">All statuses</option>
            <option>DRAFT</option>
            <option>POSTED</option>
            <option>CANCELLED</option>
          </select>
          <select name="warehouseId" aria-label="Warehouse" className={controlClass}>
            <option value="">All warehouses</option>
            {options?.warehouses.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
          <select name="reason" aria-label="Damage reason" className={controlClass}>
            <option value="">All reasons</option>
            {[
              'BROKEN',
              'WATER_DAMAGE',
              'FIRE_DAMAGE',
              'ELECTRICAL_DAMAGE',
              'SHIPPING_DAMAGE',
              'HANDLING_DAMAGE',
              'EXPIRED',
              'UNUSABLE',
              'MISSING_PARTS',
              'OTHER',
            ].map((x) => (
              <option key={x}>{label(x)}</option>
            ))}
          </select>
          <input name="dateFrom" type="date" aria-label="From date" className={controlClass} />
          <div className="flex gap-2">
            <input name="dateTo" type="date" aria-label="To date" className={controlClass} />
            <Button size="small">Filter</Button>
            <Button size="small" type="reset" variant="ghost" onClick={() => load()}>
              Reset
            </Button>
          </div>
        </form>
      </FilterBar>
      {error && (
        <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </p>
      )}
      {!data ? (
        <TableSkeleton />
      ) : data.length ? (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full min-w-[850px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-slate-500">
                <th className="p-3">Damage No</th>
                <th>Date</th>
                <th>Warehouse</th>
                <th>Reason</th>
                <th className="text-right">Loss</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.map((x) => (
                <tr key={x.id} className="border-b hover:bg-slate-50">
                  <td className="p-3 font-semibold">
                    <Link href={`/damages/${x.id}`}>{x.damageNumber}</Link>
                  </td>
                  <td>{new Date(x.damageDate).toLocaleDateString()}</td>
                  <td>{x.warehouse.name}</td>
                  <td>{label(x.reason)}</td>
                  <td className="text-right">
                    ৳{Number(x.totalDamageValue).toLocaleString('en-BD')}
                  </td>
                  <td>
                    <StatusBadge tone={x.status === 'POSTED' ? 'success' : 'warning'}>
                      {x.status}
                    </StatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="No damage records"
          description="Recorded inventory damage will appear here."
        />
      )}
    </>
  );
}
export function DamageForm({ id }: { id?: string }) {
  const [o, setO] = useState<Awaited<ReturnType<typeof damageOptions>> | null>(null),
    [item, setItem] = useState<Damage | null>(null),
    [msg, setMsg] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    void damageOptions()
      .then(setO)
      .catch(() => setMsg('Unable to load inventory options.'));
    if (id)
      void damageApi
        .find(id)
        .then(setItem)
        .catch(() => setMsg('Unable to load damage record.'));
  }, [id]);
  const submit = (f: FormData) => {
    const v = (n: string) => {
      const value = f.get(n);
      return typeof value === 'string' ? value : '';
    };
    const product = o?.products.find((x) => x.id === v('productId'));
    const serials = parseSerials(v('serials'));
    const serialItemIds = serials
      .map(
        (n) =>
          o?.serials.find(
            (x) =>
              x.serialNumber === n &&
              x.productId === product?.id &&
              x.warehouseId === v('warehouseId'),
          )?.id,
      )
      .filter((x): x is string => Boolean(x));
    if (serialItemIds.length !== new Set(serials).size) {
      setMsg(
        'Every Serial/IMEI must exactly match unique in-stock inventory for this product and warehouse.',
      );
      return;
    }
    const payload = {
      warehouseId: v('warehouseId'),
      damageDate: new Date(v('damageDate')).toISOString(),
      reason: v('reason'),
      notes: v('notes') || null,
      lines: [{ productId: v('productId'), quantity: v('quantity'), serialItemIds }],
    };
    setBusy(true);
    void (id ? damageApi.update(id, payload) : damageApi.create(payload))
      .then((x) => (location.href = `/damages/${x.id}`))
      .catch((e) => setMsg(e instanceof Error ? e.message : 'Unable to save damage.'))
      .finally(() => setBusy(false));
  };
  return (
    <>
      <PageHeader
        title={id ? 'Edit Damage' : 'Record Damage'}
        description="Inventory damage is online-only and uses current sellable stock."
      />
      <form action={submit} className="space-y-4">
        <section className="grid gap-4 rounded-lg border bg-white p-4 sm:grid-cols-2 lg:grid-cols-3">
          <FieldLabel label="Warehouse">
            <select
              name="warehouseId"
              required
              defaultValue={
                item?.warehouse ? o?.warehouses.find((x) => x.name === item.warehouse.name)?.id : ''
              }
              className={'mt-1.5 ' + controlClass}
            >
              {o?.warehouses.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </FieldLabel>
          <FieldLabel label="Date">
            <input
              name="damageDate"
              type="date"
              required
              defaultValue={item?.damageDate.slice(0, 10) ?? new Date().toISOString().slice(0, 10)}
              className={'mt-1.5 ' + controlClass}
            />
          </FieldLabel>
          <FieldLabel label="Reason">
            <select
              name="reason"
              defaultValue={item?.reason ?? 'BROKEN'}
              className={'mt-1.5 ' + controlClass}
            >
              {[
                'BROKEN',
                'WATER_DAMAGE',
                'FIRE_DAMAGE',
                'ELECTRICAL_DAMAGE',
                'SHIPPING_DAMAGE',
                'HANDLING_DAMAGE',
                'EXPIRED',
                'UNUSABLE',
                'MISSING_PARTS',
                'OTHER',
              ].map((x) => (
                <option key={x}>{label(x)}</option>
              ))}
            </select>
          </FieldLabel>
          <FieldLabel label="Product">
            <select name="productId" required className={'mt-1.5 ' + controlClass}>
              {o?.products.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name} · {x.sku}
                </option>
              ))}
            </select>
          </FieldLabel>
          <FieldLabel label="Quantity">
            <input
              name="quantity"
              inputMode="decimal"
              required
              defaultValue={item?.lines[0]?.quantity ?? '1'}
              className={'mt-1.5 text-right ' + controlClass}
            />
          </FieldLabel>
          <FieldLabel label="Serial / IMEI">
            <textarea
              name="serials"
              aria-describedby="serial-help"
              defaultValue={
                item?.lines[0]?.serials.map((x) => x.serialItem.serialNumber).join('\n') ?? ''
              }
              className={'mt-1.5 ' + textAreaClass}
            />
            <span id="serial-help" className="text-xs text-slate-500">
              One exact in-stock serial per line. Scan and press Enter.
            </span>
          </FieldLabel>
          <FieldLabel label="Notes">
            <textarea
              name="notes"
              defaultValue={item?.notes ?? ''}
              className={'mt-1.5 ' + textAreaClass}
            />
          </FieldLabel>
        </section>
        {msg && (
          <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
            {msg}
          </p>
        )}
        <FormActions>
          <Link href={id ? `/damages/${id}` : '/damages'}>
            <Button variant="secondary">Cancel</Button>
          </Link>
          <Button busy={busy}>Save Draft</Button>
        </FormActions>
      </form>
    </>
  );
}
export function DamageDetail({ id }: { id: string }) {
  const [x, setX] = useState<Damage | null>(null),
    [approval, setApproval] = useState<ApprovalRequiredError | null>(null),
    [msg, setMsg] = useState('');
  const load = () =>
    void damageApi
      .find(id)
      .then(setX)
      .catch((e) => setMsg(e instanceof Error ? e.message : 'Unable to load damage.'));
  useEffect(load, [id]);
  if (!x) return <>{msg ? <p role="alert">{msg}</p> : <TableSkeleton />}</>;
  return (
    <>
      {approval ? <ApprovalRequiredNotice error={approval} /> : null}
      <PageHeader
        title={x.damageNumber}
        description={`${label(x.reason)} · ${x.warehouse.name}`}
        actions={
          <>
            <Button variant="secondary" onClick={() => window.print()}>
              Print
            </Button>
            {x.status === 'DRAFT' && (
              <>
                <Link href={`/damages/${id}/edit`}>
                  <Button variant="secondary">Edit</Button>
                </Link>
                <Button
                  onClick={() =>
                    void damageApi
                      .post(id)
                      .then(setX)
                      .catch((e: unknown) => {
                        if (e instanceof ApprovalRequiredError) setApproval(e);
                        else setMsg(e instanceof Error ? e.message : 'Unable to post damage.');
                      })
                  }
                >
                  Post Damage
                </Button>
              </>
            )}
          </>
        }
      />
      <section className="print-only hidden">
        <h1>{x.business.name}</h1>
        <h2>Damage Stock Report · {x.damageNumber}</h2>
      </section>
      <div className="rounded-lg border bg-white p-4">
        <StatusBadge tone={x.status === 'POSTED' ? 'success' : 'warning'}>{x.status}</StatusBadge>
        {x.status === 'POSTED' && (
          <p className="mt-3 text-sm font-medium text-emerald-700">Stock updated</p>
        )}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <tbody>
              {x.lines.map((l) => (
                <tr key={l.id} className="border-b">
                  <td className="py-3">{l.product.name}</td>
                  <td>{l.quantity}</td>
                  <td>{l.serials.map((s) => s.serialItem.serialNumber).join(', ') || '—'}</td>
                  <td className="text-right">
                    ৳{Number(l.totalDamageValue).toLocaleString('en-BD')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
