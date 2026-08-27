import { ArrowLeft, Construction, Download, Plus, SlidersHorizontal } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Button,
  EmptyState,
  FilterBar,
  FormSection,
  PageHeader,
  SearchInput,
  StatusBadge,
} from '@/components/ui/primitives';
import { navigation } from '@/lib/navigation';

const destinations = navigation.flatMap((item) =>
  item.href
    ? [{ label: item.label, href: item.href }]
    : (item.children?.map((child) => ({ label: child.label, href: child.href })) ?? []),
);
const creationWords = ['new', 'create', 'add', 'transfer'];

export default async function RouteShellPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const route = '/' + slug.join('/');
  const destination = destinations.find((item) => item.href?.split('?')[0] === route);
  if (!destination) notFound();
  const isForm = creationWords.some(
    (word) => route.includes(word) || destination.label.toLowerCase().startsWith(word),
  );
  if (isForm) return <FormShell title={destination.label} />;
  return <ListShell title={destination.label} />;
}

function ListShell({ title }: { title: string }) {
  return (
    <div className="space-y-5">
      <PageHeader
        title={title}
        description={'Review and manage ' + title.toLowerCase() + ' records for Hello Shop.'}
        actions={
          <>
            <Button variant="secondary">
              <Download size={16} />
              Export
            </Button>
            <Button disabled>
              <Plus size={16} />
              Add new
            </Button>
          </>
        }
      />
      <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-700">
        <b>Module-ready page shell.</b> Business operations and persistence will be connected in the
        module’s planned phase.
      </div>
      <FilterBar>
        <SearchInput placeholder={'Search ' + title.toLowerCase() + '…'} />
        <Button variant="secondary">
          <SlidersHorizontal size={16} />
          Filters
        </Button>
      </FilterBar>
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="grid min-w-[680px] grid-cols-[1.4fr_1fr_1fr_120px] border-b border-slate-200 bg-slate-50 px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">
          <span>Reference</span>
          <span>Date</span>
          <span>Details</span>
          <span>Status</span>
        </div>
        <EmptyState
          title={'No persisted ' + title.toLowerCase() + ' yet'}
          description="This polished table shell includes the loading, filtering, empty, and pagination patterns needed by the future module."
          action={<StatusBadge tone="neutral">UI foundation</StatusBadge>}
        />
      </section>
    </div>
  );
}
function FormShell({ title }: { title: string }) {
  return (
    <div className="space-y-5">
      <PageHeader
        title={title}
        description="Complete the details below. Persistence will be enabled with this business module."
        actions={
          <Link
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            href="/dashboard"
          >
            <ArrowLeft size={16} />
            Back
          </Link>
        }
      />
      <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-700">
        <b>Form shell only.</b> No production data is submitted or stored from this screen.
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
        <FormSection
          title="Basic information"
          description="Shared accessible form layout for the upcoming module."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-semibold text-slate-600">
              Reference
              <input
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                placeholder="Auto-generated"
                disabled
              />
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Date
              <input
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                type="date"
              />
            </label>
            <label className="text-xs font-semibold text-slate-600 sm:col-span-2">
              Notes
              <textarea className="mt-1.5 min-h-28 w-full rounded-lg border border-slate-200 p-3 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
            </label>
          </div>
        </FormSection>
        <aside className="rounded-xl border border-slate-200 bg-white p-5">
          <span className="grid size-10 place-items-center rounded-xl bg-amber-50 text-amber-600">
            <Construction size={20} />
          </span>
          <h2 className="mt-4 font-semibold text-slate-900">Module pending</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Validation, permission checks, transactions, and audit behavior will be connected when
            this module is implemented.
          </p>
          <Button className="mt-5 w-full" disabled>
            Save record
          </Button>
        </aside>
      </div>
    </div>
  );
}
