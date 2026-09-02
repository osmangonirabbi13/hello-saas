'use client';
import { useEffect, useMemo, useState } from 'react';
import { securityApi, type Permission, type Role } from '@/lib/api/team-security';
import { button, control } from './team-workspace';
export function RolesWorkspace() {
  const [roles, setRoles] = useState<Role[]>([]),
    [permissions, setPermissions] = useState<Permission[]>([]),
    [editing, setEditing] = useState<Role | null>(null),
    [name, setName] = useState(''),
    [selected, setSelected] = useState<Set<string>>(new Set()),
    [error, setError] = useState('');
  const load = () =>
    Promise.all([securityApi.roles(), securityApi.permissions()])
      .then(([r, p]) => {
        setRoles(r);
        setPermissions(p);
      })
      .catch(() => setError('Unable to load roles.'));
  useEffect(() => {
    void load();
  }, []);
  const groups = useMemo(
    () =>
      permissions.reduce<Map<string, Permission[]>>(
        (map, item) => map.set(item.module, [...(map.get(item.module) ?? []), item]),
        new Map(),
      ),
    [permissions],
  );
  const edit = (r?: Role) => {
    setEditing(r ?? { id: '', name: '', isSystem: false, isActive: true, permissions: [] });
    setName(r?.name ?? '');
    setSelected(new Set(r?.permissions.map((x) => x.permission.key) ?? []));
  };
  return (
    <main className="space-y-4">
      <header className="flex justify-between">
        <div>
          <h1 className="text-2xl font-bold">Roles & permissions</h1>
          <p>Server-enforced access profiles.</p>
        </div>
        <button className={button} onClick={() => edit()}>
          Custom role
        </button>
      </header>
      {error ? <p role="alert">{error}</p> : null}
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full min-w-[620px] text-sm">
          <thead>
            <tr>
              {['Role', 'Members', 'Type', 'Status', 'Actions'].map((x) => (
                <th className="p-3 text-left" key={x}>
                  {x}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {roles.map((r) => (
              <tr className="border-t" key={r.id}>
                <td className="p-3 font-semibold">{r.name}</td>
                <td>{r._count?.memberships ?? 0}</td>
                <td>{r.isSystem ? 'System' : 'Custom'}</td>
                <td>{r.isActive ? 'ACTIVE' : 'INACTIVE'}</td>
                <td>
                  {r.isSystem ? (
                    'Protected'
                  ) : (
                    <button className={button} onClick={() => edit(r)}>
                      Edit
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing ? (
        <section className="rounded-xl border bg-white p-4">
          <h2 className="font-bold">{editing.id ? 'Edit custom role' : 'Create custom role'}</h2>
          <label>
            Role name
            <input className={control} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <div className="mt-4 space-y-3">
            {[...groups].map(([module, items]) => (
              <fieldset className="rounded-lg border p-3" key={module}>
                <legend className="px-2 font-semibold capitalize">{module}</legend>
                <div className="mb-2 flex gap-3">
                  <button
                    onClick={() => setSelected(new Set([...selected, ...items.map((x) => x.key)]))}
                  >
                    Select module
                  </button>
                  <button
                    onClick={() =>
                      setSelected(
                        new Set([...selected].filter((x) => !items.some((p) => p.key === x))),
                      )
                    }
                  >
                    Clear module
                  </button>
                </div>
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {items.map((p) => (
                    <label className="flex min-h-11 gap-2 rounded border p-2" key={p.key}>
                      <input
                        type="checkbox"
                        checked={selected.has(p.key)}
                        onChange={(e) => {
                          const n = new Set(selected);
                          if (e.target.checked) n.add(p.key);
                          else n.delete(p.key);
                          setSelected(n);
                        }}
                      />
                      <span>
                        <strong className="block text-sm">{p.label}</strong>
                        <small>{p.description}</small>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
          <div className="sticky bottom-0 flex justify-end gap-2 bg-white py-3">
            <button className={button} onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button
              className={`${button} bg-emerald-700 text-white`}
              onClick={() => {
                void securityApi
                  .saveRole(
                    { name, description: null, isActive: true, permissions: [...selected] },
                    editing.id || undefined,
                  )
                  .then(() => {
                    setEditing(null);
                    return load();
                  })
                  .catch(() => setError('Unable to save role.'));
              }}
            >
              Save role
            </button>
          </div>
        </section>
      ) : null}
    </main>
  );
}
