'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button, FormSection, PageHeader } from '@/components/ui/primitives';
import type { PartyKind, PartySummary } from '@/lib/api/parties';
import { saveOfflineCapable } from '@/lib/offline/save';
const schema = z.object({
  name: z.string().trim().min(2, 'Name is required.'),
  companyName: z.string(),
  contactPerson: z.string(),
  phone: z.string().trim().min(5, 'Phone is required.'),
  alternatePhone: z.string(),
  email: z.union([z.literal(''), z.string().email()]),
  customerType: z.string(),
  addressLine1: z.string(),
  area: z.string(),
  city: z.string(),
  district: z.string(),
  postalCode: z.string(),
  country: z.string().min(2),
  taxId: z.string(),
  binNumber: z.string(),
  creditLimit: z.coerce.number().min(0),
  notes: z.string(),
  isActive: z.boolean(),
});
type Values = z.infer<typeof schema>;
const control = 'mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm';
export function PartyForm({ kind, party }: { kind: PartyKind; party?: PartySummary }) {
  const [saveState, setSaveState] = useState('');
  const label = kind === 'customer' ? 'Customer' : 'Supplier';
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    defaultValues: {
      name: party?.name ?? '',
      companyName: party?.company ?? '',
      contactPerson: party?.contactPerson ?? '',
      phone: party?.phone ?? '',
      alternatePhone: '',
      email: '',
      customerType: party?.type ?? 'RETAIL',
      addressLine1: '',
      area: '',
      city: '',
      district: party?.district ?? '',
      postalCode: '',
      country: 'Bangladesh',
      taxId: '',
      binNumber: '',
      creditLimit: 0,
      notes: '',
      isActive: party?.isActive ?? true,
    },
  });
  const submit = handleSubmit(async (values) => {
    const result = schema.safeParse(values);
    if (!result.success) {
      result.error.issues.forEach((issue) =>
        setError(issue.path[0] as keyof Values, { message: issue.message }),
      );
      return;
    }
    setSaveState('Saving…');
    const clean: Record<string, unknown> = Object.fromEntries(
      Object.entries(result.data).map(([key, value]) => [
        key,
        value === '' ? null : key === 'creditLimit' ? String(value) : value,
      ]),
    );
    if (kind === 'supplier') {
      delete clean.customerType;
      delete clean.creditLimit;
    } else delete clean.contactPerson;
    setSaveState(
      await saveOfflineCapable({
        entityType: kind === 'customer' ? 'CUSTOMER' : 'SUPPLIER',
        ...(party ? { serverId: party.id, baseVersion: 1 } : {}),
        payload: clean,
      }),
    );
  });
  const field = (name: keyof Values, text: string, type = 'text') => (
    <label className="text-sm font-semibold text-slate-700">
      {text}
      <input
        aria-invalid={Boolean(errors[name])}
        className={control}
        type={type}
        {...register(name, type === 'number' ? { valueAsNumber: true } : undefined)}
      />
      {saveState && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800" role="status">{saveState}</p>}
      {errors[name] && <small className="block text-rose-600">{errors[name]?.message}</small>}
    </label>
  );
  return (
    <form className="space-y-5" onSubmit={(event) => void submit(event)}>
      <PageHeader
        title={(party ? 'Edit ' : 'New ') + label}
        description={party ? party.code : 'Code: Auto generated after save'}
        actions={
          <>
            <Link
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold"
              href={'/' + kind + 's'}
            >
              Cancel
            </Link>
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? 'Saving…' : 'Save ' + label}
            </Button>
            <Button disabled={isSubmitting} variant="secondary" type="submit">
              Save & Add Another
            </Button>
          </>
        }
      />
      <FormSection title="Basic Information">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {field('name', label + ' Name')}
          {field('companyName', 'Company Name')}
          {kind === 'supplier' && field('contactPerson', 'Contact Person')}
          {field('phone', 'Phone')}
          {field('alternatePhone', 'Alternate Phone')}
          {field('email', 'Email')}
          {kind === 'customer' && field('customerType', 'Customer Type')}
        </div>
      </FormSection>
      <FormSection title="Address">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {field('addressLine1', 'Address Line')}
          {field('area', 'Area')}
          {field('city', 'City')}
          {field('district', 'District')}
          {field('postalCode', 'Postal Code')}
          {field('country', 'Country')}
        </div>
      </FormSection>
      <FormSection title="Tax / Business Information">
        <div className="grid gap-4 sm:grid-cols-3">
          {field('taxId', 'Tax ID')}
          {field('binNumber', 'BIN')}
          {kind === 'customer' && field('creditLimit', 'Credit Limit', 'number')}
        </div>
      </FormSection>
      <FormSection title="Notes and Status">
        <textarea
          className="min-h-28 w-full rounded-lg border border-slate-200 p-3"
          {...register('notes')}
        />
        <label className="mt-4 block">
          <input type="checkbox" {...register('isActive')} /> Active
        </label>
      </FormSection>
    </form>
  );
}
