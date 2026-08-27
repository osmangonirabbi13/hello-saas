'use client';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button, FormSection, PageHeader } from '@/components/ui/primitives';
import type { ProductSummary } from '@/lib/api/product-master';

const schema = z
  .object({
    name: z.string().trim().min(2),
    sku: z.string().trim().min(1),
    categoryId: z.string().min(1),
    unitId: z.string().min(1),
    purchasePrice: z.coerce.number().min(0),
    salePrice: z.coerce.number().min(0),
    minimumSalePrice: z.coerce.number().min(0),
    trackStock: z.boolean(),
    serialized: z.boolean(),
    warrantyEnabled: z.boolean(),
  })
  .refine((value) => value.minimumSalePrice <= value.salePrice, {
    path: ['minimumSalePrice'],
    message: 'Cannot exceed sale price.',
  })
  .refine((value) => !value.serialized || value.trackStock, {
    path: ['trackStock'],
    message: 'Serialized products must track stock.',
  });
type Values = z.infer<typeof schema>;
const input = 'mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm';

export function ProductForm({ product }: { product?: ProductSummary }) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<Values>({
    defaultValues: {
      name: product?.name ?? '',
      sku: product?.sku ?? '',
      categoryId: '',
      unitId: '',
      purchasePrice: 0,
      salePrice: product?.salePrice ?? 0,
      minimumSalePrice: 0,
      trackStock: true,
      serialized: false,
      warrantyEnabled: false,
    },
  });
  const submit = handleSubmit((values) => {
    const result = schema.safeParse(values);
    if (!result.success)
      for (const issue of result.error.issues)
        setError(issue.path[0] as keyof Values, { message: issue.message });
  });
  const field = (name: keyof Values, label: string, type = 'text') => (
    <label className="text-sm font-semibold text-slate-700">
      {label}
      <input
        className={input}
        type={type}
        {...register(name, type === 'number' ? { valueAsNumber: true } : undefined)}
      />
      {errors[name] && <small className="block text-rose-600">{errors[name]?.message}</small>}
    </label>
  );
  return (
    <form className="space-y-5" onSubmit={(event) => void submit(event)}>
      <PageHeader
        title={product ? 'Edit product' : 'New product'}
        description="Product identity, pricing, inventory rules, and warranty defaults."
        actions={
          <>
            <Link
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold"
              href="/products"
            >
              Cancel
            </Link>
            <Button type="submit">Validate product</Button>
          </>
        }
      />
      <FormSection title="Product information">
        <div className="grid gap-4 sm:grid-cols-2">
          {field('name', 'Product name')}
          {field('sku', 'SKU')}
          {field('categoryId', 'Category ID')}
          {field('unitId', 'Unit ID')}
        </div>
      </FormSection>
      <FormSection title="Pricing">
        <div className="grid gap-4 sm:grid-cols-3">
          {field('purchasePrice', 'Purchase price', 'number')}
          {field('salePrice', 'Sale price', 'number')}
          {field('minimumSalePrice', 'Minimum sale price', 'number')}
        </div>
      </FormSection>
      <FormSection title="Inventory and warranty">
        <div className="grid gap-3 sm:grid-cols-3">
          <label>
            <input type="checkbox" {...register('trackStock')} /> Track stock
          </label>
          <label>
            <input type="checkbox" {...register('serialized')} /> Serialized / IMEI
          </label>
          <label>
            <input type="checkbox" {...register('warrantyEnabled')} /> Warranty enabled
          </label>
        </div>
      </FormSection>
    </form>
  );
}
