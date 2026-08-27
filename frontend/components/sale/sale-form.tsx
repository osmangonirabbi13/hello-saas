'use client';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { Plus, Save, ScanBarcode, Trash2 } from 'lucide-react';
import { Button, ConfirmDialog, FormSection, PageHeader, Sheet } from '@/components/ui/primitives';
import type { SaleCustomer, SaleMode, SaleProduct, SaleSummary } from '@/lib/api/sales';
import { useBarcodeScanner } from '@/hooks/use-barcode-scanner';
import { lookupProductBarcode, lookupSellableSerial } from '@/lib/api/scanner-lookups';
import { appendUniqueSerial, applyProductScan } from '@/lib/transaction-scanner';

type Line = {
  productId: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  tax: number;
  serials: string;
};
type Values = {
  customerId: string;
  warehouseId: string;
  saleDate: string;
  dueDate: string;
  reference: string;
  discount: number;
  additionalCost: number;
  tax: number;
  paid: number;
  lines: Line[];
};
const inputClass = 'h-10 w-full rounded-lg border border-slate-200 px-3 text-sm';

export function SaleForm({
  mode = 'REGULAR',
  products,
  customers,
  sale,
}: {
  mode?: SaleMode;
  products: SaleProduct[];
  customers: SaleCustomer[];
  sale?: SaleSummary;
}) {
  const [message, setMessage] = useState('');
  const scannerInput = useRef<HTMLInputElement>(null);
  const {
    register,
    control,
    watch,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    defaultValues: {
      customerId: '',
      warehouseId: 'warehouse-main',
      saleDate: new Date().toISOString().slice(0, 10),
      dueDate: '',
      reference: '',
      discount: 0,
      additionalCost: 0,
      tax: mode === 'VAT' ? 0 : 0,
      paid: sale?.paid ?? 0,
      lines: [
        {
          productId: products[0]?.id ?? '',
          quantity: 1,
          unitPrice: products[0]?.salePrice ?? 0,
          discount: 0,
          tax: 0,
          serials: '',
        },
      ],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });
  const values = watch();
  const lineTotal = (line: Line) =>
    Math.max(0, line.quantity * line.unitPrice - line.discount + line.tax);
  const subtotal = values.lines.reduce((sum, line) => sum + lineTotal(line), 0);
  const grand = Math.max(0, subtotal - values.discount + values.additionalCost + values.tax);
  const due = Math.max(0, grand - values.paid);
  const addProduct = (product: SaleProduct) => {
    const current = getValues('lines');
    const scan = applyProductScan(current, product);
    if (scan.lineIndex === current.length) {
      append({
        productId: product.id,
        quantity: 1,
        unitPrice: Number(product.salePrice),
        discount: 0,
        tax: 0,
        serials: '',
      });
    } else if (scan.outcome === 'incremented') {
      setValue(`lines.${scan.lineIndex}.quantity`, scan.lines[scan.lineIndex]!.quantity, {
        shouldDirty: true,
      });
    }
    setMessage(
      scan.outcome === 'serial-required'
        ? `${product.name}: select or scan an IN_STOCK Serial / IMEI.`
        : scan.outcome === 'incremented'
          ? `${product.name} quantity increased.`
          : `${product.name} added.`,
    );
  };
  const scanner = useBarcodeScanner({
    onScan: (value) => {
      void (async () => {
        try {
          const localProduct = products.find((item) => item.barcode === value);
          addProduct(localProduct ?? (await lookupProductBarcode<SaleProduct>(value)));
        } catch {
          try {
          const localOwner = products.find((item) => item.serials.some((serial) => serial === value));
            const resolved = localOwner
              ? { serialNumber: value, product: localOwner }
              : await lookupSellableSerial<{ serialNumber: string; product: SaleProduct }>(value);
            const current = getValues('lines');
          const index = current.findIndex((line) => line.productId === resolved.product.id);
            if (index === -1) {
              append({
                productId: resolved.product.id,
                quantity: 1,
                unitPrice: Number(resolved.product.salePrice),
                discount: 0,
                tax: 0,
                serials: resolved.serialNumber,
              });
              setMessage(`${resolved.product.name}: serial attached.`);
            } else {
              const next = appendUniqueSerial(current[index]!.serials, resolved.serialNumber);
              if (!next.added) setMessage('This Serial / IMEI is already selected.');
              else {
                setValue(`lines.${index}.serials`, next.value, { shouldDirty: true });
                setValue(`lines.${index}.quantity`, next.value.split('\n').length, {
                  shouldDirty: true,
                });
                setMessage(`${resolved.product.name}: serial attached.`);
              }
            }
          } catch (reason) {
            setMessage(
              reason instanceof Error ? reason.message : 'Product or sellable serial not found.',
            );
          }
        } finally {
          if (scannerInput.current) scannerInput.current.value = '';
          scannerInput.current?.focus();
        }
      })();
    },
  });
  const save = handleSubmit(() =>
    setMessage('Draft validated. The authenticated API recalculates and persists all totals.'),
  );
  const title = sale ? 'Edit Draft Sale' : mode === 'VAT' ? 'VAT Sale' : 'Create Sale';
  return (
    <form className="space-y-5" onSubmit={(event) => void save(event)}>
      <PageHeader
        title={title}
        description={
          sale?.saleNumber ?? 'Sale and invoice numbers are generated by BusinessSequence.'
        }
        actions={
          <>
            <Link className="rounded-lg border px-4 py-2 text-sm font-semibold" href="/sales">
              Cancel
            </Link>
            <Button disabled={isSubmitting} type="submit">
              <Save size={16} />
              Save Draft
            </Button>
            <ConfirmDialog
              title="Post this sale?"
              description="Posting will deduct inventory and finalize the invoice."
              trigger={<Button type="button">Post Sale</Button>}
              onConfirm={() =>
                setMessage('Posting is available through the authenticated Sale API.')
              }
            />
          </>
        }
      />
      {message && (
        <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>
      )}
      <FormSection
        title="Sale information"
        description={
          mode === 'VAT'
            ? 'VAT mode uses the same SaleService and exposes tax controls.'
            : 'Walk-in sales do not require a customer record.'
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label>
            Customer
            <select className={inputClass} {...register('customerId')}>
              {customers.map((customer) => (
                <option key={customer.id || 'walk-in'} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Warehouse
            <select className={inputClass} {...register('warehouseId', { required: true })}>
              <option value="warehouse-main">Main Warehouse</option>
            </select>
          </label>
          <label>
            Sale Date
            <input
              className={inputClass}
              type="date"
              {...register('saleDate', { required: true })}
            />
          </label>
          <label>
            Due Date
            <input className={inputClass} type="date" {...register('dueDate')} />
          </label>
          <label>
            Reference
            <input className={inputClass} {...register('reference')} />
          </label>
          <label>
            Sale Type
            <input className={inputClass} readOnly value={mode} />
          </label>
        </div>
      </FormSection>
      <FormSection
        title="Products"
        description="Searchable by product name, SKU, or barcode; available stock is warehouse-specific."
      >
        <label className="mb-4 block max-w-xl text-sm font-semibold text-slate-700">
          Scan product barcode or Serial / IMEI
          <span className="relative mt-1.5 block">
            <ScanBarcode
              className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-700"
              size={18}
            />
            <input
              ref={scannerInput}
              className="h-11 w-full rounded-lg border border-slate-300 pl-10 pr-3 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              placeholder="Barcode or IMEI + Enter"
              onKeyDown={scanner.onKeyDown}
            />
          </span>
        </label>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-slate-500">
                <th>Product / SKU</th>
                <th>Available</th>
                <th>Qty</th>
                <th>Unit</th>
                <th>Sale Price</th>
                <th>Discount</th>
                <th>VAT / Tax</th>
                <th>Warranty</th>
                <th>Serial / IMEI</th>
                <th>Total</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {fields.map((field, index) => {
                const product =
                  products.find((item) => item.id === values.lines[index]?.productId) ??
                  products[0];
                const serials =
                  values.lines[index]?.serials
                    .split(/[\n,]+/)
                    .map((item) => item.trim())
                    .filter(Boolean) ?? [];
                const required = product?.serialized ? (values.lines[index]?.quantity ?? 0) : 0;
                return (
                  <tr className="border-b align-top" key={field.id}>
                    <td className="py-3">
                      <select className={inputClass} {...register(`lines.${index}.productId`)}>
                        {products.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name} · {item.sku}
                          </option>
                        ))}
                      </select>
                      <span className="text-xs text-slate-400">Barcode: {product?.barcode}</span>
                    </td>
                    <td>{product?.available}</td>
                    <td>
                      <input
                        className={inputClass}
                        min="0.001"
                        step="0.001"
                        type="number"
                        {...register(`lines.${index}.quantity`, {
                          valueAsNumber: true,
                          min: 0.001,
                        })}
                      />
                    </td>
                    <td>{product?.unit}</td>
                    <td>
                      <input
                        className={inputClass}
                        min="0"
                        step="0.01"
                        type="number"
                        {...register(`lines.${index}.unitPrice`, { valueAsNumber: true, min: 0 })}
                      />
                    </td>
                    <td>
                      <input
                        className={inputClass}
                        min="0"
                        step="0.01"
                        type="number"
                        {...register(`lines.${index}.discount`, { valueAsNumber: true, min: 0 })}
                      />
                    </td>
                    <td>
                      <input
                        className={inputClass}
                        min="0"
                        step="0.01"
                        type="number"
                        {...register(`lines.${index}.tax`, { valueAsNumber: true, min: 0 })}
                      />
                    </td>
                    <td>Product default</td>
                    <td>
                      {product?.serialized ? (
                        <Sheet
                          title="Select sellable Serial / IMEI"
                          trigger={
                            <Button type="button" variant="secondary">
                              {serials.length} / {required}
                            </Button>
                          }
                        >
                          <input className={inputClass} placeholder="Search serial" />
                          <div className="mt-3 space-y-2">
                            {product.serials.map((serial) => (
                              <label className="flex gap-2" key={serial}>
                                <input
                                  type="checkbox"
                                  readOnly
                                  checked={serials.includes(serial)}
                                />
                                {serial}
                              </label>
                            ))}
                          </div>
                          <textarea
                            className="mt-4 min-h-36 w-full rounded-lg border p-3"
                            placeholder="Paste selected serials"
                            {...register(`lines.${index}.serials`)}
                          />
                          <p
                            className={
                              serials.length === required
                                ? 'mt-2 text-emerald-700'
                                : 'mt-2 text-amber-700'
                            }
                          >
                            Required: {required} · Selected: {serials.length}
                          </p>
                        </Sheet>
                      ) : (
                        <span className="text-slate-400">Not serialized</span>
                      )}
                    </td>
                    <td className="font-semibold">
                      ৳{lineTotal(values.lines[index]!).toLocaleString()}
                    </td>
                    <td>
                      <Button
                        aria-label="Remove line"
                        type="button"
                        variant="ghost"
                        onClick={() => remove(index)}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Button
          className="mt-4"
          type="button"
          variant="secondary"
          onClick={() =>
            append({
              productId: products[0]?.id ?? '',
              quantity: 1,
              unitPrice: products[0]?.salePrice ?? 0,
              discount: 0,
              tax: 0,
              serials: '',
            })
          }
        >
          <Plus size={16} />
          Add Product
        </Button>
        {errors.lines && <p className="text-rose-600">At least one valid product is required.</p>}
      </FormSection>
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <FormSection title="Notes">
          <textarea className="min-h-32 w-full rounded-lg border p-3" placeholder="Invoice note" />
        </FormSection>
        <aside className="sticky bottom-4 rounded-xl border bg-white p-5 shadow-lg">
          <h2 className="font-semibold">Sale Totals</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <dt>Subtotal</dt>
              <dd>৳{subtotal.toLocaleString()}</dd>
            </div>
            <label className="flex items-center justify-between">
              Discount
              <input
                className="w-28 rounded border p-2 text-right"
                type="number"
                {...register('discount', { valueAsNumber: true, min: 0 })}
              />
            </label>
            <label className="flex items-center justify-between">
              Additional Cost
              <input
                className="w-28 rounded border p-2 text-right"
                type="number"
                {...register('additionalCost', { valueAsNumber: true, min: 0 })}
              />
            </label>
            <label className="flex items-center justify-between">
              VAT / Tax
              <input
                className="w-28 rounded border p-2 text-right"
                type="number"
                {...register('tax', { valueAsNumber: true, min: 0 })}
              />
            </label>
            <div className="flex justify-between border-t pt-3 font-bold">
              <dt>Grand Total</dt>
              <dd>৳{grand.toLocaleString()}</dd>
            </div>
            <label className="flex items-center justify-between">
              Paid
              <input
                className="w-28 rounded border p-2 text-right"
                max={grand}
                type="number"
                {...register('paid', { valueAsNumber: true, min: 0, max: grand })}
              />
            </label>
            <div className="flex justify-between font-bold text-rose-700">
              <dt>Due</dt>
              <dd>৳{due.toLocaleString()}</dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-slate-400">
            Preview only. The API uses integer minor-unit calculations.
          </p>
        </aside>
      </div>
    </form>
  );
}
