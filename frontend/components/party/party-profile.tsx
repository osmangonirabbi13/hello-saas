import Link from 'next/link';
import { FormSection, PageHeader, StatusBadge } from '@/components/ui/primitives';
import type { PartyKind, PartySummary } from '@/lib/api/parties';
export function PartyProfile({ kind, party }: { kind: PartyKind; party: PartySummary }) {
  return (
    <div className="space-y-5">
      <PageHeader
        title={party.name}
        description={party.code}
        actions={
          <>
            <Link
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
              href={'/' + kind + 's'}
            >
              Back to {kind === 'customer' ? 'Customers' : 'Suppliers'}
            </Link>
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
              <dt className="text-slate-500">
                {kind === 'supplier' ? 'Contact person' : 'Customer type'}
              </dt>
              <dd>
                {kind === 'supplier'
                  ? party.contactPerson || 'Not specified'
                  : party.type || 'Not specified'}
              </dd>
            </div>
          </dl>
        </FormSection>
        <FormSection title="Address">
          <p className="text-sm">{party.district}, Bangladesh</p>
        </FormSection>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <FormSection title="Business details">
          <dl className="grid gap-3 text-sm">
            <div>
              <dt className="text-slate-500">
                {kind === 'customer' ? 'Customer type' : 'Contact person'}
              </dt>
              <dd className="font-semibold">
                {kind === 'customer'
                  ? party.type || 'Not specified'
                  : party.contactPerson || 'Not specified'}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Company</dt>
              <dd className="font-semibold">{party.company}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Last updated</dt>
              <dd>{party.updatedAt}</dd>
            </div>
          </dl>
        </FormSection>
        <FormSection
          title="Activity"
          description="Transaction activity will appear here when supported records are available."
        >
          <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
            No supported activity is available for this profile yet.
          </p>
        </FormSection>
      </div>
    </div>
  );
}
