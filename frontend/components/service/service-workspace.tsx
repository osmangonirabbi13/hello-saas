'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Printer, Plus } from 'lucide-react';
import {
  Button,
  controlClass,
  EmptyState,
  FieldLabel,
  FilterBar,
  FormActions,
  PageHeader,
  SearchInput,
  StatusBadge,
  TableSkeleton,
  textAreaClass,
} from '@/components/ui/primitives';
import {
  createService,
  getService,
  listServiceAssignees,
  listServices,
  loadOptions,
  moveService,
  updateService,
  type ServiceItem,
} from '@/lib/api/service-quotation';
const label = (v: string) =>
  v
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
const tone = (s: string) =>
  s === 'DELIVERED'
    ? 'success'
    : s === 'CANCELLED'
      ? 'danger'
      : s === 'READY_FOR_DELIVERY'
        ? 'info'
        : 'warning';
const actions: Record<string, Array<[string, string]>> = {
  RECEIVED: [
    ['start-diagnosis', 'Start diagnosis'],
    ['cancel', 'Cancel'],
  ],
  DIAGNOSING: [
    ['request-approval', 'Request approval'],
    ['start', 'Start work'],
    ['cancel', 'Cancel'],
  ],
  WAITING_FOR_APPROVAL: [
    ['approve', 'Approve & start'],
    ['cancel', 'Cancel'],
  ],
  IN_PROGRESS: [
    ['waiting-parts', 'Waiting for parts'],
    ['ready', 'Ready for delivery'],
    ['cancel', 'Cancel'],
  ],
  WAITING_FOR_PARTS: [
    ['start', 'Resume work'],
    ['ready', 'Ready for delivery'],
    ['cancel', 'Cancel'],
  ],
  READY_FOR_DELIVERY: [
    ['deliver', 'Deliver'],
    ['cancel', 'Cancel'],
  ],
};
export function ServiceList() {
  const [d, setD] = useState<{ rows: ServiceItem[]; total: number } | null>(null),
    [e, setE] = useState('');
  const load = () => {
    setE('');
    void listServices()
      .then(setD)
      .catch((x: unknown) => setE(x instanceof Error ? x.message : 'Unable to load services.'));
  };
  useEffect(load, []);
  return (
    <div className="space-y-4">
      <PageHeader
        title="Services"
        description="Track device intake, diagnosis, repair progress and delivery."
        actions={
          <Link href="/services/new">
            <Button>
              <Plus size={16} />
              Create service
            </Button>
          </Link>
        }
      />
      <FilterBar>
        <SearchInput
          aria-label="Search services"
          placeholder="Service no, customer, phone, serial or device"
        />
        <select aria-label="Status" className={controlClass + ' sm:w-52'}>
          <option>All statuses</option>
        </select>
      </FilterBar>
      {e ? (
        <div className="rounded-lg border bg-white p-6 text-center">
          <p className="text-rose-700">{e}</p>
          <Button className="mt-3" variant="secondary" onClick={load}>
            Retry
          </Button>
        </div>
      ) : !d ? (
        <TableSkeleton />
      ) : d.rows.length ? (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-left text-xs uppercase text-slate-500">
                <th className="p-3">Service</th>
                <th>Customer</th>
                <th>Device / Serial</th>
                <th>Received</th>
                <th>Assigned</th>
                <th>Status</th>
                <th className="pr-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {d.rows.map((i) => (
                <tr className="border-b hover:bg-slate-50" key={i.id}>
                  <td className="p-3 font-bold">
                    <Link href={`/services/${i.id}`}>{i.serviceNumber}</Link>
                  </td>
                  <td>{i.customer?.name ?? 'Walk-in Customer'}</td>
                  <td>
                    {i.deviceName}
                    <small className="block font-mono text-slate-500">
                      {i.serialItem?.serialNumber ?? i.externalSerialNumber ?? 'No serial'}
                    </small>
                  </td>
                  <td>{new Date(i.receivedAt).toLocaleDateString('en-BD')}</td>
                  <td>{i.assignee?.displayName ?? 'Unassigned'}</td>
                  <td>
                    <StatusBadge tone={tone(i.status)}>{label(i.status)}</StatusBadge>
                  </td>
                  <td className="pr-3 text-right tabular-nums">
                    ৳{Number(i.grandTotal || i.estimatedServiceCharge).toLocaleString('en-BD')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="No services yet"
          description="Receive the first customer device to begin tracking work."
          action={
            <Link href="/services/new">
              <Button>Create service</Button>
            </Link>
          }
        />
      )}
    </div>
  );
}
export function ServiceForm({ id }: { id?: string }) {
  const [opts, setOpts] = useState<Awaited<ReturnType<typeof loadOptions>> | null>(null),
    [item, setItem] = useState<ServiceItem | null>(null),
    [msg, setMsg] = useState(''),
    [busy, setBusy] = useState(false),
    [assignees, setAssignees] = useState<Array<{ user: { id: string; displayName: string } }>>([]);
  useEffect(() => {
    void loadOptions()
      .then(setOpts)
      .catch(() => setMsg('Unable to load form options.'));
    void listServiceAssignees()
      .then(setAssignees)
      .catch(() => setAssignees([]));
    if (id)
      void getService(id)
        .then(setItem)
        .catch(() => setMsg('Unable to load service.'));
  }, [id]);
  const submit = (f: FormData) => {
    const v = (n: string) => {
      const x = f.get(n);
      return typeof x === 'string' ? x : '';
    };
    setBusy(true);
    const payload = id
      ? {
          assigneeId: v('assigneeId') || null,
          priority: v('priority'),
          diagnosis: v('diagnosis') || null,
          recommendedWork: v('recommendedWork') || null,
          workPerformed: v('workPerformed') || null,
          estimatedServiceCharge: v('estimatedServiceCharge') || '0',
          estimatedPartsCost: v('estimatedPartsCost') || '0',
          serviceCharge: v('serviceCharge') || '0',
          partsCharge: v('partsCharge') || '0',
          discountAmount: v('discountAmount') || '0',
          taxAmount: v('taxAmount') || '0',
        }
      : {
          customerId: v('customerId') || null,
          productId: v('productId') || null,
          serialItemId: v('serialItemId') || null,
          type: v('type'),
          priority: v('priority'),
          deviceName: v('deviceName'),
          deviceBrand: v('deviceBrand') || null,
          deviceModel: v('deviceModel') || null,
          externalSerialNumber: v('externalSerialNumber') || null,
          condition: v('condition'),
          conditionNote: v('conditionNote') || null,
          accessories: f.getAll('accessories'),
          customerComplaint: v('customerComplaint'),
          estimatedServiceCharge: v('estimatedServiceCharge') || '0',
          estimatedPartsCost: v('estimatedPartsCost') || '0',
          parts: [],
        };
    void (id ? updateService(id, payload) : createService(payload))
      .then((x) => {
        window.location.href = `/services/${x.id}`;
      })
      .catch((x: unknown) => setMsg(x instanceof Error ? x.message : 'Unable to save service.'))
      .finally(() => setBusy(false));
  };
  return (
    <div className="space-y-4">
      <PageHeader
        title={id ? 'Edit service' : 'Create service'}
        description="Record device condition, customer complaint and expected work."
        actions={
          <Link href={id ? `/services/${id}` : '/services'}>
            <Button variant="secondary">Back</Button>
          </Link>
        }
      />
      <form action={submit} className="space-y-4">
        <section className="grid gap-4 rounded-lg border bg-white p-4 md:grid-cols-2 xl:grid-cols-4">
          <FieldLabel label="Customer">
            <select
              name="customerId"
              defaultValue={item?.customer?.id ?? ''}
              className={'mt-1.5 ' + controlClass}
            >
              <option value="">Walk-in Customer</option>
              {opts?.customers.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name} · {x.phone}
                </option>
              ))}
            </select>
          </FieldLabel>
          <FieldLabel label="Service type">
            <select name="type" className={'mt-1.5 ' + controlClass}>
              {[
                'REPAIR',
                'DIAGNOSTIC',
                'INSTALLATION',
                'SOFTWARE',
                'HARDWARE',
                'MAINTENANCE',
                'OTHER',
              ].map((x) => (
                <option key={x}>{label(x)}</option>
              ))}
            </select>
          </FieldLabel>
          <FieldLabel label="Priority">
            <select
              name="priority"
              defaultValue={item?.priority ?? 'NORMAL'}
              className={'mt-1.5 ' + controlClass}
            >
              {['LOW', 'NORMAL', 'HIGH', 'URGENT'].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </FieldLabel>
          <FieldLabel label="Assigned team member">
            <select
              name="assigneeId"
              defaultValue={item?.assignee?.id ?? ''}
              className={'mt-1.5 ' + controlClass}
            >
              <option value="">Unassigned team member</option>
              {assignees.map(({ user }) => (
                <option key={user.id} value={user.id}>
                  {user.displayName}
                </option>
              ))}
            </select>
          </FieldLabel>
          <FieldLabel label="Product">
            <select name="productId" className={'mt-1.5 ' + controlClass}>
              <option value="">External/unregistered device</option>
              {opts?.products.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </FieldLabel>
          <FieldLabel label="Device name">
            <input
              name="deviceName"
              required
              defaultValue={item?.deviceName}
              className={'mt-1.5 ' + controlClass}
            />
          </FieldLabel>
          <FieldLabel label="Brand">
            <input
              name="deviceBrand"
              defaultValue={item?.deviceBrand ?? ''}
              className={'mt-1.5 ' + controlClass}
            />
          </FieldLabel>
          <FieldLabel label="Model">
            <input
              name="deviceModel"
              defaultValue={item?.deviceModel ?? ''}
              className={'mt-1.5 ' + controlClass}
            />
          </FieldLabel>
          <FieldLabel label="Linked Serial / IMEI">
            <select name="serialItemId" className={'mt-1.5 ' + controlClass}>
              <option value="">Not linked</option>
              {opts?.serials.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.serialNumber}
                </option>
              ))}
            </select>
          </FieldLabel>
          <FieldLabel label="External Serial / IMEI">
            <input
              name="externalSerialNumber"
              defaultValue={item?.externalSerialNumber ?? ''}
              className={'mt-1.5 ' + controlClass}
            />
          </FieldLabel>
          <FieldLabel label="Condition">
            <select
              name="condition"
              defaultValue={item?.condition ?? 'GOOD'}
              className={'mt-1.5 ' + controlClass}
            >
              {['GOOD', 'SCRATCHED', 'DENTED', 'BROKEN', 'LIQUID_DAMAGE', 'OTHER'].map((x) => (
                <option key={x}>{label(x)}</option>
              ))}
            </select>
          </FieldLabel>
          <FieldLabel label="Estimated service charge">
            <input
              name="estimatedServiceCharge"
              inputMode="decimal"
              defaultValue={item?.estimatedServiceCharge ?? '0'}
              className={'mt-1.5 ' + controlClass}
            />
          </FieldLabel>
          <FieldLabel label="Estimated parts cost">
            <input
              name="estimatedPartsCost"
              inputMode="decimal"
              defaultValue={item?.estimatedPartsCost ?? '0'}
              className={'mt-1.5 ' + controlClass}
            />
          </FieldLabel>
        </section>
        <section className="grid gap-4 rounded-lg border bg-white p-4 md:grid-cols-2">
          <FieldLabel label="Customer complaint">
            <textarea
              name="customerComplaint"
              required
              defaultValue={item?.customerComplaint}
              className={'mt-1.5 ' + textAreaClass}
            />
          </FieldLabel>
          <FieldLabel label="Condition notes">
            <textarea
              name="conditionNote"
              defaultValue={item?.conditionNote ?? ''}
              className={'mt-1.5 ' + textAreaClass}
            />
          </FieldLabel>
          {id && (
            <>
              <FieldLabel label="Diagnosis">
                <textarea
                  name="diagnosis"
                  defaultValue={item?.diagnosis ?? ''}
                  className={'mt-1.5 ' + textAreaClass}
                />
              </FieldLabel>
              <FieldLabel label="Recommended work">
                <textarea
                  name="recommendedWork"
                  defaultValue={item?.recommendedWork ?? ''}
                  className={'mt-1.5 ' + textAreaClass}
                />
              </FieldLabel>
            </>
          )}
        </section>
        {!id && (
          <fieldset className="rounded-lg border bg-white p-4">
            <legend className="px-1 text-sm font-semibold">Accessories received</legend>
            <div className="flex flex-wrap gap-2">
              {[
                'CHARGER',
                'CABLE',
                'ADAPTER',
                'BAG',
                'BOX',
                'BATTERY',
                'SIM',
                'MEMORY_CARD',
                'OTHER',
              ].map((x) => (
                <label
                  key={x}
                  className="flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm"
                >
                  <input name="accessories" type="checkbox" value={x} />
                  {label(x)}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {msg && (
          <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
            {msg}
          </p>
        )}
        <FormActions>
          <Link href={id ? `/services/${id}` : '/services'}>
            <Button variant="secondary">Cancel</Button>
          </Link>
          <Button busy={busy}>{id ? 'Save changes' : 'Create service'}</Button>
        </FormActions>
      </form>
    </div>
  );
}
export function ServiceDetail({ id }: { id: string }) {
  const [i, setI] = useState<ServiceItem | null>(null),
    [e, setE] = useState('');
  const load = () =>
    void getService(id)
      .then(setI)
      .catch((x: unknown) => setE(x instanceof Error ? x.message : 'Unable to load service.'));
  useEffect(load, [id]);
  const move = (a: string) =>
    void moveService(id, a)
      .then(setI)
      .catch((x: unknown) => setE(x instanceof Error ? x.message : 'Action failed.'));
  if (e && !i)
    return (
      <p role="alert" className="rounded-lg bg-rose-50 p-4 text-rose-700">
        {e}
      </p>
    );
  if (!i) return <TableSkeleton />;
  return (
    <div className="space-y-4">
      <PageHeader
        title={i.serviceNumber}
        description={label(i.status)}
        actions={
          <>
            <Link href={`/services/${id}/edit`}>
              <Button variant="secondary">Edit</Button>
            </Link>
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer size={16} />
              Print receipt
            </Button>
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[1.4fr_.8fr]">
        <section className="rounded-lg border bg-white p-4">
          <h2 className="font-bold">Service details</h2>
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Customer</dt>
              <dd className="font-semibold">{i.customer?.name ?? 'Walk-in Customer'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Device</dt>
              <dd>
                {i.deviceName} {i.deviceModel}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Serial / IMEI</dt>
              <dd className="font-mono">
                {i.serialItem?.serialNumber ?? i.externalSerialNumber ?? 'Not recorded'}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Condition</dt>
              <dd>{label(i.condition)}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Complaint</dt>
              <dd>{i.customerComplaint}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Diagnosis</dt>
              <dd>{i.diagnosis ?? 'Awaiting diagnosis'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Approval</dt>
              <dd>{label(i.approvalStatus)}</dd>
            </div>
          </dl>
          <div className="mt-5 flex flex-wrap gap-2">
            {(actions[i.status] ?? []).map(([a, l]) => (
              <Button
                key={a}
                variant={a === 'cancel' ? 'danger' : 'primary'}
                onClick={() => move(a)}
              >
                {l}
              </Button>
            ))}
          </div>
        </section>
        <section className="rounded-lg border bg-white p-4">
          <h2 className="font-bold">Timeline</h2>
          <ol className="mt-4 space-y-3">
            {i.history.map((h) => (
              <li key={h.id} className="border-l-2 border-emerald-200 pl-3">
                <b className="text-sm">{label(h.toStatus)}</b>
                <p className="text-xs text-slate-500">
                  {new Date(h.createdAt).toLocaleString('en-BD')} · {h.actor.displayName}
                </p>
              </li>
            ))}
          </ol>
        </section>
      </div>
      <section className="print-only hidden">
        <h1>{i.business.name}</h1>
        <h2>{i.deliveredAt ? 'Service Delivery Receipt' : 'Service Intake Receipt'}</h2>
        <p>{i.serviceNumber}</p>
        <p>
          {i.customer?.name ?? 'Walk-in Customer'} · {i.deviceName}
        </p>
        <p>Serial: {i.serialItem?.serialNumber ?? i.externalSerialNumber ?? 'Not recorded'}</p>
        <p>Condition: {label(i.condition)}</p>
        <p>Accessories: {i.accessories.map(label).join(', ') || 'None recorded'}</p>
        <p>Complaint: {i.customerComplaint}</p>
        {i.deliveredAt && (
          <>
            <p>Work: {i.workPerformed ?? i.recommendedWork ?? 'Completed service'}</p>
            <p>Total: ৳{Number(i.grandTotal).toLocaleString('en-BD')}</p>
            <p>Delivered: {new Date(i.deliveredAt).toLocaleDateString('en-BD')}</p>
          </>
        )}
      </section>
    </div>
  );
}
