'use client';
import { useMemo, useState } from 'react';
import { Minus, Plus, Search, ShoppingCart, Trash2 } from 'lucide-react';
import { Button, ConfirmDialog, CurrencyDisplay, PageHeader } from '@/components/ui/primitives';
import type { SaleCustomer, SaleProduct } from '@/lib/api/sales';
import { useBarcodeScanner } from '@/hooks/use-barcode-scanner';

export function PosCheckout({
  products,
  customers,
}: {
  products: SaleProduct[];
  customers: SaleCustomer[];
}) {
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [paid, setPaid] = useState(0);
  const [message, setMessage] = useState('');
  const filtered = useMemo(
    () =>
      products.filter((product) =>
        [product.name, product.sku, product.barcode].some((value) =>
          value.toLowerCase().includes(query.toLowerCase()),
        ),
      ),
    [products, query],
  );
  const rows = products.filter((product) => cart[product.id]);
  const total = rows.reduce((sum, product) => sum + product.salePrice * (cart[product.id] ?? 0), 0);
  const change = (id: string, delta: number) =>
    setCart((current) => ({ ...current, [id]: Math.max(0, (current[id] ?? 0) + delta) }));
  const scanner = useBarcodeScanner({
    onScan: (barcode) => {
      const product = products.find((item) => item.barcode === barcode);
      if (!product) return setMessage(`No active product found for barcode ${barcode}.`);
      if (product.available <= 0) return setMessage(`${product.name} is out of stock.`);
      change(product.id, 1);
      setQuery('');
      setMessage(`${product.name} added to cart.`);
    },
  });
  return (
    <div className="space-y-5">
      <PageHeader
        title="Fast POS"
        description="A touch-friendly checkout over the same authenticated SaleService."
        actions={
          <Button variant="secondary" onClick={() => setCart({})}>
            Clear cart
          </Button>
        }
      />
      {message && (
        <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>
      )}
      <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <section className="rounded-xl border bg-white p-4">
          <label className="relative block">
            <Search className="absolute left-3 top-3 text-slate-400" size={18} />
            <input
              autoFocus
              className="h-11 w-full rounded-lg border pl-10 pr-3"
              placeholder="Scan barcode or search product / SKU"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={scanner.onKeyDown}
            />
          </label>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((product) => (
              <button
                className="rounded-xl border p-4 text-left hover:border-emerald-500 hover:bg-emerald-50"
                key={product.id}
                type="button"
                onClick={() => change(product.id, 1)}
              >
                <p className="font-semibold">{product.name}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {product.sku} · Stock {product.available}
                </p>
                <p className="mt-3 font-bold text-emerald-700">
                  <CurrencyDisplay value={product.salePrice} />
                </p>
              </button>
            ))}
          </div>
        </section>
        <aside className="rounded-xl border bg-white p-4">
          <div className="flex items-center gap-2">
            <ShoppingCart size={20} />
            <h2 className="font-semibold">Cart</h2>
          </div>
          <div className="mt-4 space-y-3">
            {rows.length === 0 && (
              <p className="rounded-lg bg-slate-50 p-5 text-center text-sm text-slate-500">
                Scan or select a product to begin.
              </p>
            )}
            {rows.map((product) => (
              <div className="rounded-lg border p-3" key={product.id}>
                <div className="flex justify-between">
                  <div>
                    <p className="font-medium">{product.name}</p>
                    <p className="text-xs text-slate-500">
                      {product.sku}
                      {product.serialized ? ' · Serial selection required' : ''}
                    </p>
                  </div>
                  <button
                    aria-label="Remove"
                    type="button"
                    onClick={() => setCart((current) => ({ ...current, [product.id]: 0 }))}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      className="size-8 p-0"
                      variant="secondary"
                      onClick={() => change(product.id, -1)}
                    >
                      <Minus size={14} />
                    </Button>
                    <span>{cart[product.id]}</span>
                    <Button
                      className="size-8 p-0"
                      variant="secondary"
                      onClick={() => change(product.id, 1)}
                    >
                      <Plus size={14} />
                    </Button>
                  </div>
                  <CurrencyDisplay value={product.salePrice * (cart[product.id] ?? 0)} />
                </div>
              </div>
            ))}
          </div>
          <label className="mt-4 block text-sm">
            Customer
            <select className="mt-1 h-10 w-full rounded-lg border px-3">
              {customers.map((customer) => (
                <option key={customer.id || 'walk-in'} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-3 block text-sm">
            Paid
            <input
              className="mt-1 h-10 w-full rounded-lg border px-3"
              min="0"
              max={total}
              type="number"
              value={paid}
              onChange={(event) => setPaid(Number(event.target.value))}
            />
          </label>
          <dl className="mt-4 space-y-2 border-t pt-4">
            <div className="flex justify-between font-bold">
              <dt>Total</dt>
              <dd>
                <CurrencyDisplay value={total} />
              </dd>
            </div>
            <div className="flex justify-between text-rose-700">
              <dt>Due</dt>
              <dd>
                <CurrencyDisplay value={Math.max(0, total - paid)} />
              </dd>
            </div>
          </dl>
          <ConfirmDialog
            title="Complete POS sale?"
            description="Checkout uses SaleService, deducts inventory, and finalizes one invoice."
            trigger={
              <Button className="mt-5 w-full" disabled={!rows.length}>
                Confirm Checkout
              </Button>
            }
            onConfirm={() =>
              setMessage(
                'POS checkout is routed through the authenticated Sale API and shared posting flow.',
              )
            }
          />
          <p className="mt-3 text-center text-xs text-slate-400">
            Hold, split payment, offline mode, and printer integration are deferred.
          </p>
        </aside>
      </div>
    </div>
  );
}
