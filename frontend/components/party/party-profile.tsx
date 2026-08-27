import Link from 'next/link';
import { FormSection, PageHeader, StatusBadge } from '@/components/ui/primitives';
import type { PartyKind, PartySummary } from '@/lib/api/parties';
export function PartyProfile({ kind, party }: { kind: PartyKind; party: PartySummary }) {
  const future =
    kind === 'customer'
      ? ['Sales', 'Payments', 'Receivable', 'Returns', 'Warranty', 'Activity']
      : ['Purchases', 'Payments', 'Payable', 'Purchase Returns', 'Warranty / RMA'];
  return (
    <div className="space-y-5">
      <PageHeader
        title={party.name}
        description={party.code}
        actions={
          <>
            <StatusBadge tone={party.isActive ? 'success' : 'neutral'}>
              {party.isActive ? 'Active' : 'Inactive'}
            </StatusBadge>
            <Link
              className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"
              href={'/' + kind + 's/' + party.id + '/edit'}
            >
              Edit profile
            </Link>
          </>
        }
      />
      <div className="grid gap-5 lg:grid-cols-2">
        <FormSection title="Contact">
          <dl className="grid gap-3 text-sm">
            <div>
              <dt className="text-slate-500">Phone</dt>
              <dd className="font-semibold">{party.phone}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Company</dt>
              <dd>{party.company}</dd>
            </div>
          </dl>
        </FormSection>
        <FormSection title="Address">
          <p className="text-sm">{party.district}, Bangladesh</p>
        </FormSection>
      </div>
      <FormSection
        title="Future integrations"
        description="These sections remain empty until their transaction and ledger modules exist."
      >
        <div className="flex flex-wrap gap-2">
          {future.map((item) => (
            <StatusBadge key={item}>{item} — Not available yet</StatusBadge>
          ))}
        </div>
      </FormSection>
    </div>
  );
}
