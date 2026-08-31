'use client';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScanBarcode, Trash2 } from 'lucide-react';
import {
  Button,
  controlClass,
  FieldLabel,
  FormActions,
  PageHeader,
  textAreaClass,
} from '@/components/ui/primitives';
import { damageApi, damageOptions, type Damage } from '@/lib/api/damage-expense';
import { applyProductScan } from '@/lib/transaction-scanner';
type Options = Awaited<ReturnType<typeof damageOptions>>;
type Line = {
  productId: string;
  quantity: number;
  serialIds: string[];
  scan: string;
  message: string;
};
const blank = (): Line => ({ productId: '', quantity: 1, serialIds: [], scan: '', message: '' });
export function DamageEditor({ id }: { id?: string }) {
  const [o, setO] = useState<Options | null>(null),
    [item, setItem] = useState<Damage | null>(null),
    [lines, setLines] = useState<Line[]>([blank()]),
    [warehouse, setWarehouse] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const refs = useRef<Record<number, HTMLInputElement | null>>({});
  useEffect(() => {
    void damageOptions()
      .then((x) => {
        setO(x);
        setWarehouse(x.warehouses[0]?.id ?? '');
      })
      .catch(() => setError('Unable to load inventory options.'));
    if (id)
      void damageApi.find(id).then((x) => {
        setItem(x);
        setLines(
          x.lines.map((l) => ({
            productId: l.product.id,
            quantity: Number(l.quantity),
            serialIds: l.serials.map((s) => s.serialItem.id),
            scan: '',
            message: '',
          })),
        );
      });
  }, [id]);
  const products = new Map(o?.products.map((x) => [x.id, x]) ?? []),
    serials = new Map(o?.serials.map((x) => [x.id, x]) ?? []);
  const totals = useMemo(
    () =>
      lines.reduce(
        (a, l) => ({
          qty: a.qty + l.quantity,
          value: a.value + Number(products.get(l.productId)?.purchasePrice ?? 0) * l.quantity,
        }),
        { qty: 0, value: 0 },
      ),
    [lines, products],
  );
  const update = (n: number, p: Partial<Line>) =>
    setLines((v) => v.map((x, i) => (i === n ? { ...x, ...p } : x)));
  const scanSerial = (n: number) => {
    const l = lines[n],
      value = l?.scan.trim();
    if (!l || !value) return;
    const exact = o?.serials.find((s) => s.serialNumber.toLowerCase() === value.toLowerCase());
    let message = '';
    if (!exact) message = 'Unknown or unavailable Serial / IMEI.';
    else if (exact.productId !== l.productId)
      message = 'This Serial / IMEI belongs to another product.';
    else if (exact.warehouseId !== warehouse)
      message = 'This Serial / IMEI belongs to another warehouse.';
    else if (l.serialIds.includes(exact.id)) message = 'This Serial / IMEI is already selected.';
    if (message) {
      update(n, { message });
      return;
    }
    update(n, {
      serialIds: [...l.serialIds, exact!.id],
      scan: '',
      message: 'Serial / IMEI selected.',
    });
    queueMicrotask(() => refs.current[n]?.focus());
  };
  const chooseProduct = (n: number, productId: string) => {
    const p = products.get(productId);
    if (!p) return;
    const scanned = applyProductScan([], {
      id: p.id,
      name: p.name,
      barcode: '',
      serialized: p.serialized,
    });
    update(n, {
      productId,
      quantity: scanned.lines[0]?.quantity ?? 1,
      serialIds: [],
      message: p.serialized ? 'Scan each Serial / IMEI below.' : '',
    });
  };
  const submit = (f: FormData, post = false) => {
    const v = (n: string) => {
      const x = f.get(n);
      return typeof x === 'string' ? x : '';
    };
    if (
      lines.some(
        (l) =>
          !l.productId ||
          l.quantity <= 0 ||
          ((products.get(l.productId)?.serialized ?? false) && l.serialIds.length !== l.quantity),
      )
    ) {
      setError('Complete every product, quantity, and required Serial / IMEI selection.');
      return;
    }
    const payload = {
      warehouseId: warehouse,
      damageDate: new Date(v('damageDate')).toISOString(),
      reason: v('reason'),
      notes: v('notes') || null,
      lines: lines.map((l) => ({
        productId: l.productId,
        quantity: String(l.quantity),
        serialItemIds: l.serialIds,
      })),
    };
    setBusy(true);
    void (id ? damageApi.update(id, payload) : damageApi.create(payload))
      .then(async (x) => {
        if (post) await damageApi.post(x.id);
        location.href = `/damages/${x.id}`;
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Unable to save damage.'))
      .finally(() => setBusy(false));
  };
  return (
    <>
      <PageHeader
        title={id ? 'Edit Damage' : 'Record Damage'}
        description="Record multiple damaged products in one inventory document."
      />
      <form
        action={(f) => submit(f)}
        className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_280px]"
      >
        <div className="space-y-4">
          <section className="grid gap-4 rounded-lg border bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
            <FieldLabel label="Warehouse">
              <select
                value={warehouse}
                onChange={(e) => setWarehouse(e.target.value)}
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
                defaultValue={
                  item?.damageDate.slice(0, 10) ?? new Date().toISOString().slice(0, 10)
                }
                className={'mt-1.5 ' + controlClass}
              />
            </FieldLabel>
            <FieldLabel label="Default reason">
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
                  <option key={x}>{x.replaceAll('_', ' ')}</option>
                ))}
              </select>
            </FieldLabel>
            <FieldLabel label="Notes">
              <textarea
                name="notes"
                defaultValue={item?.notes ?? ''}
                className={'mt-1.5 ' + textAreaClass}
              />
            </FieldLabel>
          </section>
          <section className="space-y-3 rounded-lg border bg-white p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Damage Items</h2>
              <Button
                type="button"
                size="small"
                variant="secondary"
                onClick={() => setLines((x) => [...x, blank()])}
              >
                Add Product
              </Button>
            </div>
            {lines.map((l, n) => (
              <div
                key={n}
                className="grid gap-3 border-t pt-3 md:grid-cols-[minmax(220px,1fr)_100px_minmax(240px,1fr)_44px]"
              >
                <FieldLabel label={`Product ${n + 1}`}>
                  <select
                    value={l.productId}
                    onChange={(e) => chooseProduct(n, e.target.value)}
                    className={'mt-1.5 ' + controlClass}
                  >
                    <option value="">Search or select product</option>
                    {o?.products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} · {p.sku}
                      </option>
                    ))}
                  </select>
                </FieldLabel>
                <FieldLabel label="Quantity">
                  <input
                    value={l.quantity}
                    onChange={(e) => update(n, { quantity: Number(e.target.value) })}
                    inputMode="decimal"
                    className={'mt-1.5 text-right ' + controlClass}
                  />
                </FieldLabel>
                <FieldLabel label="Scan Serial / IMEI">
                  <div className="relative mt-1.5">
                    <ScanBarcode
                      aria-hidden
                      className="absolute left-3 top-2.5 size-4 text-emerald-600"
                    />
                    <input
                      ref={(x) => {
                        refs.current[n] = x;
                      }}
                      value={l.scan}
                      onChange={(e) => update(n, { scan: e.target.value, message: '' })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          scanSerial(n);
                        }
                      }}
                      placeholder="Scan or type Serial / IMEI and press Enter"
                      className={'pl-9 ' + controlClass}
                    />
                  </div>
                  <span className="text-xs text-slate-500">
                    Scanner Ready ·{' '}
                    {l.serialIds
                      .map((x) => serials.get(x)?.serialNumber)
                      .filter(Boolean)
                      .join(', ') || 'No serial selected'}
                  </span>
                  {l.message && (
                    <span
                      role="status"
                      className={
                        l.message.includes('selected')
                          ? 'text-xs text-emerald-700'
                          : 'text-xs text-rose-700'
                      }
                    >
                      {l.message}
                    </span>
                  )}
                </FieldLabel>
                <Button
                  type="button"
                  size="small"
                  variant="ghost"
                  aria-label={`Remove product ${n + 1}`}
                  onClick={() => setLines((x) => x.filter((_, i) => i !== n))}
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            ))}
          </section>
          {error && (
            <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
              {error}
            </p>
          )}
        </div>
        <aside className="sticky top-20 rounded-lg border bg-white p-4">
          <h2 className="font-semibold">Damage Summary</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt>Total items</dt>
              <dd>{lines.filter((x) => x.productId).length}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Total quantity</dt>
              <dd>{totals.qty}</dd>
            </div>
            <div className="flex justify-between font-semibold">
              <dt>Estimated value</dt>
              <dd>৳{totals.value.toLocaleString('en-BD')}</dd>
            </div>
          </dl>
          <div className="mt-4">
            <FormActions>
              <Link className="w-full" href={id ? `/damages/${id}` : '/damages'}>
                <Button className="w-full" variant="secondary">
                  Cancel
                </Button>
              </Link>
              <Button className="w-full" busy={busy}>
                Save Draft
              </Button>
              <Button
                className="w-full"
                type="button"
                busy={busy}
                onClick={(e) => {
                  const form = e.currentTarget.form;
                  if (form) submit(new FormData(form), true);
                }}
              >
                Post Damage
              </Button>
            </FormActions>
          </div>
        </aside>
      </form>
    </>
  );
}
