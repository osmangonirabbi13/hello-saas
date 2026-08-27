import { EmptyState, PageHeader } from '@/components/ui/primitives';
export default function Page() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Sale Return List"
        description="Reserved for the future audited Sale Return workflow."
      />
      <EmptyState
        title="Sale Returns are not enabled"
        description="No return API, inventory reversal, refund, or credit-note logic has been implemented."
      />
    </div>
  );
}
