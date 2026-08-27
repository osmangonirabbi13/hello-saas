'use client';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { useFieldArray, useForm, type FieldPath } from 'react-hook-form';
import { Plus, Save, ScanBarcode, Trash2 } from 'lucide-react';
import { Button, ConfirmDialog, FormSection, PageHeader, Sheet } from '@/components/ui/primitives';
import type { PurchaseProduct, PurchaseSummary } from '@/lib/api/purchases';
import { useBarcodeScanner } from '@/hooks/use-barcode-scanner';
import { lookupProductBarcode } from '@/lib/api/scanner-lookups';
import { applyProductScan } from '@/lib/transaction-scanner';
import { SerialEntry } from '@/components/scanner/serial-entry';
type Line = {
  productId: string;
  quantity: number;
  unitCost: number;
  discount: number;
  tax: number;
  serials: string;
};
type Values = {
  supplierId: string;
  warehouseId: string;
  purchaseDate: string;
  dueDate: string;
  supplierInvoice: string;
  reference: string;
  discount: number;
  additionalCost: number;
  tax: number;
  paid: number;
  lines: Line[];
};
const input = 'h-10 w-full rounded-lg border border-slate-200 px-3 text-sm';
export function PurchaseForm({
  products,
  purchase,
}: {
  products: PurchaseProduct[];
  purchase?: PurchaseSummary;
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
      supplierId: 'supplier-1',
      warehouseId: 'warehouse-main',
      purchaseDate: new Date().toISOString().slice(0, 10),
      dueDate: '',
      supplierInvoice: purchase?.supplierInvoice ?? '',
      reference: '',
      discount: 0,
      additionalCost: 0,
      tax: 0,
      paid: purchase?.paid ?? 0,
      lines: [
        {
          productId: products[0]?.id ?? '',
          quantity: 1,
          unitCost: products[0]?.purchasePrice ?? 0,
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
    Math.max(0, line.quantity * line.unitCost - line.discount + line.tax);
  const subtotal = values.lines.reduce((sum, line) => sum + lineTotal(line), 0);
  const grand = Math.max(0, subtotal - values.discount + values.additionalCost + values.tax);
  const due = Math.max(0, grand - values.paid);
  const scanner = useBarcodeScanner({
    onScan: (barcode) => {
      void (async () => {
        try {
          const product =
            products.find((item) => item.barcode === barcode) ??
            (await lookupProductBarcode<PurchaseProduct>(barcode));
          const current = getValues('lines');
          const scan = applyProductScan(current, product);
          if (scan.lineIndex === current.length) {
            append({
              productId: product.id,
              quantity: 1,
              unitCost: Number(product.purchasePrice),
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
              ? `${product.name}: scan or enter the Serial / IMEI for receiving.`
              : scan.outcome === 'incremented'
                ? `${product.name} quantity increased.`
                : `${product.name} added.`,
          );
        } catch (reason) {
          setMessage(reason instanceof Error ? reason.message : 'Product not found.');
        } finally {
          if (scannerInput.current) scannerInput.current.value = '';
          scannerInput.current?.focus();
        }
      })();
    },
  });
  const validate = handleSubmit(() => {
    setMessage(
      'Validated in the frontend adapter. The API remains authoritative for persistence and totals.',
    );
  });
  return (
    <form className="space-y-5" onSubmit={(event) => void validate(event)}>
      <PageHeader
        title={purchase ? 'Edit Draft Purchase' : 'Create Purchase'}
        description={purchase?.purchaseNumber ?? 'Purchase number is generated after draft save.'}
        actions={
          <>
            <Link
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold"
              href="/purchases"
            >
              Cancel
            </Link>
            <Button disabled={isSubmitting} type="submit">
              <Save size={16} />
              Save Draft
            </Button>
            <ConfirmDialog
              title="Post this purchase?"
              description="Posting will add inventory and cannot be freely edited afterward."
              trigger={<Button type="button">Post Purchase</Button>}
              onConfirm={() =>
                setMessage('Posting is available through the authenticated Purchase API.')
              }
            />
          </>
        }
      />
      {message && (
        <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>
      )}
      <FormSection title="Purchase information">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label>
            Supplier
            <select className={input} {...register('supplierId', { required: true })}>
              <option value="supplier-1">Tech Distribution Ltd</option>
              <option value="supplier-2">Mobile Source BD</option>
            </select>
          </label>
          <label>
            Warehouse
            <select className={input} {...register('warehouseId', { required: true })}>
              <option value="warehouse-main">Main Warehouse</option>
            </select>
          </label>
          <label>
            Purchase Date
            <input
              className={input}
              type="date"
              {...register('purchaseDate', { required: true })}
            />
          </label>
          <label>
            Due Date
            <input className={input} type="date" {...register('dueDate')} />
          </label>
          <label>
            Supplier Invoice
            <input className={input} {...register('supplierInvoice')} />
          </label>
          <label>
            Reference
            <input className={input} {...register('reference')} />
          </label>
        </div>
      </FormSection>
      <FormSection title="Products" description="Search by product name, SKU, or barcode.">
        <label className="mb-4 block max-w-xl text-sm font-semibold text-slate-700">
          Scan or enter product barcode
          <span className="relative mt-1.5 block">
            <ScanBarcode
              className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-700"
              size={18}
            />
            <input
              ref={scannerInput}
              className="h-11 w-full rounded-lg border border-slate-300 pl-10 pr-3 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              placeholder="Barcode + Enter"
              onKeyDown={scanner.onKeyDown}
            />
          </span>
        </label>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-slate-500">
                <th>Product / SKU</th>
                <th>Qty</th>
                <th>Unit</th>
                <th>Purchase Price</th>
                <th>Sale Preview</th>
                <th>Warranty</th>
                <th>Serial / IMEI</th>
                <th>Discount</th>
                <th>Tax</th>
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
                      <select className={input} {...register(`lines.${index}.productId`)}>
                        {products.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name} · {item.sku}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        className={input}
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
                        className={input}
                        min="0"
                        step="0.01"
                        type="number"
                        {...register(`lines.${index}.unitCost`, { valueAsNumber: true, min: 0 })}
                      />
                    </td>
                    <td>{product?.salePrice.toLocaleString()}</td>
                    <td>Product default</td>
                    <td>
                      {product?.serialized ? (
                        <Sheet
                          title="Add Serial / IMEI"
                          trigger={
                            <Button type="button" variant="secondary">
                              {serials.length} / {required}
                            </Button>
                          }
                        >
                          <p className="mb-3 text-sm text-slate-500">
                            Paste one serial per line or comma-separated. Duplicates are rejected by
                            the API.
                          </p>
                          <SerialEntry
                            mode="receive"
                            productName={product.name}
                            required={required}
                            value={values.lines[index]?.serials ?? ''}
                            onChange={(serialValue) =>
                              setValue(
                                ('lines.' + index + '.serials') as FieldPath<Values>,
                                serialValue,
                                { shouldDirty: true, shouldValidate: true },
                              )
                            }
                          />
                          <p className="mb-1 mt-4 text-xs font-semibold text-slate-500">
                            Bulk paste fallback
                          </p>
                          <textarea
                            className="min-h-56 w-full rounded-lg border p-3"
                            {...register(`lines.${index}.serials`)}
                          />
                          <p
                            className={
                              serials.length === required
                                ? 'mt-2 text-emerald-700'
                                : 'mt-2 text-amber-700'
                            }
                          >
                            Required: {required} · Entered: {serials.length}
                          </p>
                        </Sheet>
                      ) : (
                        <span className="text-slate-400">Not serialized</span>
                      )}
                    </td>
                    <td>
                      <input
                        className={input}
                        min="0"
                        type="number"
                        {...register(`lines.${index}.discount`, { valueAsNumber: true, min: 0 })}
                      />
                    </td>
                    <td>
                      <input
                        className={input}
                        min="0"
                        type="number"
                        {...register(`lines.${index}.tax`, { valueAsNumber: true, min: 0 })}
                      />
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
              unitCost: products[0]?.purchasePrice ?? 0,
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
          <textarea
            className="min-h-32 w-full rounded-lg border border-slate-200 p-3"
            placeholder="Purchase notes"
          />
        </FormSection>
        <aside className="sticky bottom-4 rounded-xl border border-slate-200 bg-white p-5 shadow-lg">
          <h2 className="font-semibold">Purchase Totals</h2>
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
              Tax
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
            Preview only. The API recalculates every total.
          </p>
        </aside>
      </div>
    </form>
  );
}
