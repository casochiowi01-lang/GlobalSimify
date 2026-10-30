'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  Loader2,
  Search,
  UserPlus,
  ShieldOff,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { AdminShell, Panel } from '@/components/admin/AdminShell';
import type { AdminUser, Role } from '@/lib/admin';

const ROLES: Role[] = ['CUSTOMER', 'PARTNER', 'ADMIN'];

function roleTone(role: Role): string {
  if (role === 'ADMIN') return 'bg-purple-100 text-purple-800';
  if (role === 'PARTNER') return 'bg-blue-100 text-blue-800';
  return 'bg-zinc-100 text-zinc-700';
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function AdminCustomersPage() {
  const { status, user, authFetch } = useAuth();

  const [rows, setRows] = useState<AdminUser[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Add-customer form
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<Role>('CUSTOMER');
  const [creating, setCreating] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [formOk, setFormOk] = useState<string | null>(null);

  const load = useCallback(
    (term: string) => {
      const qs = term.trim()
        ? `?search=${encodeURIComponent(term.trim())}`
        : '';
      return authFetch<AdminUser[]>(`/admin/users${qs}`).then(
        (data) => {
          setRows(data);
          setLoadErr(null);
        },
        () => {
          setRows([]);
          setLoadErr('Could not load customers.');
        },
      );
    },
    [authFetch],
  );

  useEffect(() => {
    if (status !== 'authed' || user?.role !== 'ADMIN') return;
    void load('');
  }, [status, user, authFetch, load]);

  // Debounced search on typing.
  useEffect(() => {
    if (status !== 'authed' || user?.role !== 'ADMIN') return;
    const t = setTimeout(() => void load(search), 300);
    return () => clearTimeout(t);
  }, [search, status, user, load]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setFormErr(null);
    setFormOk(null);
    if (!email.trim()) {
      setFormErr('Email is required.');
      return;
    }
    setCreating(true);
    try {
      await authFetch<AdminUser>('/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim() || undefined,
          phone: phone.trim() || undefined,
          role,
        }),
      });
      setFormOk(`Added ${email.trim()}.`);
      setEmail('');
      setName('');
      setPhone('');
      setRole('CUSTOMER');
      await load(search);
    } catch (err) {
      setFormErr(
        err instanceof Error ? err.message : 'Could not add customer.',
      );
    } finally {
      setCreating(false);
    }
  }

  async function patchUser(id: string, body: { role?: Role; status?: string }) {
    try {
      await authFetch<AdminUser>(`/admin/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      await load(search);
    } catch {
      setLoadErr('Could not update customer.');
    }
  }

  const input =
    'w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100';

  return (
    <AdminShell title="Customers">
      <div className="space-y-6">
        {/* Add customer */}
        <Panel title="Add customer">
          <form onSubmit={onCreate} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jane@example.com"
                  className={input}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">
                  Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Doe"
                  className={input}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">
                  Phone
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+254700000000"
                  className={input}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">
                  Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                  className={input}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={creating}
                className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:opacity-60"
              >
                {creating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
                Add customer
              </button>
              {formOk && (
                <span className="text-sm text-teal-700">{formOk}</span>
              )}
              {formErr && (
                <span className="text-sm text-red-600">{formErr}</span>
              )}
            </div>
          </form>
        </Panel>

        {/* Search + table */}
        <Panel
          title="All customers"
          action={
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-zinc-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search email, name, phone"
                className="w-56 rounded-lg border border-zinc-300 py-2 pl-8 pr-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              />
            </div>
          }
        >
          {loadErr && <p className="mb-3 text-sm text-red-600">{loadErr}</p>}
          {rows === null ? (
            <div className="grid place-items-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
            </div>
          ) : rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-zinc-500">
              No customers found.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                    <th className="pb-2 pr-4">Name</th>
                    <th className="pb-2 pr-4">Email</th>
                    <th className="pb-2 pr-4">Phone</th>
                    <th className="pb-2 pr-4">Role</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2 pr-4">Orders</th>
                    <th className="pb-2 pr-4">eSIMs</th>
                    <th className="pb-2 pr-4">Joined</th>
                    <th className="pb-2">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {rows.map((u) => (
                    <tr key={u.id} className="text-zinc-700">
                      <td className="py-3 pr-4 font-medium text-zinc-900">
                        {u.name || '—'}
                      </td>
                      <td className="py-3 pr-4">{u.email || '—'}</td>
                      <td className="py-3 pr-4">{u.phone || '—'}</td>
                      <td className="py-3 pr-4">
                        <span
                          className={`rounded px-1.5 py-0.5 text-xs font-medium ${roleTone(u.role)}`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                            u.status === 'ACTIVE'
                              ? 'bg-teal-100 text-teal-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {u.status}
                        </span>
                      </td>
                      <td className="py-3 pr-4">{u.orders}</td>
                      <td className="py-3 pr-4">{u.esims}</td>
                      <td className="py-3 pr-4 whitespace-nowrap text-zinc-500">
                        {fmtDate(u.createdAt)}
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <select
                            value={u.role}
                            onChange={(e) =>
                              patchUser(u.id, { role: e.target.value as Role })
                            }
                            className="rounded-lg border border-zinc-300 px-2 py-1 text-xs outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                            title="Change role"
                          >
                            {ROLES.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() =>
                              patchUser(u.id, {
                                status:
                                  u.status === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE',
                              })
                            }
                            className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition ${
                              u.status === 'ACTIVE'
                                ? 'text-red-700 hover:bg-red-50'
                                : 'text-teal-700 hover:bg-teal-50'
                            }`}
                          >
                            {u.status === 'ACTIVE' ? (
                              <>
                                <ShieldOff className="h-3.5 w-3.5" /> Block
                              </>
                            ) : (
                              <>
                                <ShieldCheck className="h-3.5 w-3.5" /> Unblock
                              </>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </AdminShell>
  );
}
