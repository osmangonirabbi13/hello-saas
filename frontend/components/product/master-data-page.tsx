import { Plus } from 'lucide-react';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Button, PageHeader, SearchInput, StatusBadge } from '@/components/ui/primitives';
import type { MasterRecord } from '@/lib/api/product-master';

const columns: Column<MasterRecord>[] = [
  { key: 'name', label: 'Name' },
  { key: 'code', label: 'Slug / short name' },
  { key: 'parent', label: 'Parent', render: (row) => row.parent ?? '—' },
  {
    key: 'isActive',
    label: 'Status',
    render: (row) => (
      <StatusBadge tone={row.isActive ? 'success' : 'neutral'}>
        {row.isActive ? 'Active' : 'Inactive'}
      </StatusBadge>
    ),
  },
];
export function MasterDataPage({ title, rows }: { title: string; rows: MasterRecord[] }) {
  return (
    <div className="space-y-5">
      <PageHeader
        title={title}
        description={'Manage tenant-scoped ' + title.toLowerCase() + ' records.'}
        actions={
          <Button>
            <Plus size={16} />
            Add record
          </Button>
        }
      />
      <SearchInput placeholder={'Search ' + title.toLowerCase()} />
      <DataTable rows={rows} columns={columns} rowKey={(row) => row.id} />
    </div>
  );
}
