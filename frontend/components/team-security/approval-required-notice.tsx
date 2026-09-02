import Link from 'next/link';
import type { ApprovalRequiredError } from '@/lib/api/api-error';

export function ApprovalRequiredNotice({ error }: { error: ApprovalRequiredError }) {
  return (
    <section
      aria-live="polite"
      className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950"
    >
      <p className="font-semibold">Approval required</p>
      <p className="mt-1 text-sm">{error.approvalNumber}</p>
      <Link
        className="mt-3 inline-flex min-h-11 items-center rounded-lg border border-amber-700 px-4 text-sm font-semibold"
        href={`/approvals/${error.approvalId}`}
      >
        View Approval Request
      </Link>
    </section>
  );
}
