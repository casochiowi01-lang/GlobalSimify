'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  Loader2,
  ShieldCheck,
  ShieldPlus,
  Search,
  UserMinus,
  UserCog,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { AdminShell, Panel } from '@/components/admin/AdminShell';
import type { AdminUser } from '@/lib/admin';

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function AdminAdminsPage() {
  const { status, user, authFetch } = useAuth();

  const [all, setAll] = useState<AdminUser[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  // Create-admin form
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [formOk, setFormOk] = useState<string | null>(null);

  // Promote existing
  const [promoteTerm, setPromoteTerm] = useState('');
  const [matches, setMatches] = useState<AdminUser[] | null>(null);
  const [searching, setSearching] = useState(false);

  const load = useCallback(
    () =>
      authFetch<AdminUser[]>('/admin/users').then(
        (data) => {
          setAll(data);
          setLoadErr(null);
        },
        () => {
          setAll([]);
          setLoadErr('Could not load users.');
        },
      ),
    [authFetch],
  );

  useEffect(() => {
    if (status !== 'authed' || user?.role !== 'ADMIN') return;
    void load();
  }, [status, user, authFetch, load]);

  const admins = (all ?? []).filter((u) => u.role === 'ADMIN');

  const isSelf = (u: AdminUser) =>
    (!!user?.id && u.id === user.id) ||
    (!!user?.email && u.email === user.email);

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
          role: 'ADMIN',
        }),
      });
      setFormOk(`${email.trim()} is now an admin.`);
      setEmail('');
      setName('');
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      // Duplicate email → suggest promoting instead.
      if (/409|exist|duplicate|taken|already/i.test(msg)) {
        setFormErr(
          'That email already has an account. Use "Promote existing user" below to make them an admin.',
        );
      } else {
        setFormErr(msg || 'Could not create admin.');
      }
    } finally {
      setCreating(false);
    }
  }

  const runSearch = useCallback(
    async (term: string) => {
      if (!term.trim()) {
        setMatches(null);
        return;
      }
      setSearching(true);
      try {
        const data = await authFetch<AdminUser[]>(
          `/admin/users?search=${encodeURIComponent(term.trim())}`,
        );
        setMatches(data.filter((u) => u.role !== 'ADMIN'));
      } catch {
        setMatches([]);
      } finally {
        setSearching(false);
      }
    },
    [authFetch],
  );

  useEffect(() => {
    if (status !== 'authed' || user?.role !== 'ADMIN') return;
    const t = setTimeout(() => void runSearch(promoteTerm), 300);
    return () => clearTimeout(t);
  }, [promoteTerm, status, user, runSearch]);

  async function setRole(id: string, role: 'ADMIN' | 'CUSTOMER') {
    try {
      await authFetch<AdminUser>(`/admin/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      });
      await load();
      if (role === 'ADMIN') await runSearch(promoteTerm);
    } catch {
      setLoadErr('Could not update role.');
    }
  }

  function removeAdmin(u: AdminUser) {
    if (
      !window.confirm(
        `Remove admin access from ${u.email || u.name || 'this user'}?`,
      )
    )
      return;
    void setRole(u.id, 'CUSTOMER');
  }

  const input =
    'w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100';

  return (
    <AdminShell title="Admins & access">
      <div className="space-y-6">
        <div className="flex items-start gap-3 rounded-2xl border border-zinc-200 bg-white p-5">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-teal-600" />
          <p className="text-sm text-zinc-600">
            Admins have full access to the console — they can manage orders,
            pricing, promo codes and customers. Grant this role only to people
            you trust.
          </p>
        </div>

        {/* Current admins */}
        <Panel title="Current admins">
          {loadErr && <p className="mb-3 text-sm text-red-600">{loadErr}</p>}
          {all === null ? (
            <div className="grid place-items-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
            </div>
          ) : admins.length === 0 ? (
            <p className="py-10 text-center text-sm text-zinc-500">
              No admins yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                    <th className="pb-2 pr-4">Name</th>
                    <th className="pb-2 pr-4">Email</th>
                    <th className="pb-2 pr-4">Joined</th>
                    <th className="pb-2">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {admins.map((u) => (
                    <tr key={u.id} className="text-zinc-700">
                      <td className="py-3 pr-4 font-medium text-zinc-900">
                        {u.name || '—'}
                      </td>
                      <td className="py-3 pr-4">{u.email || '—'}</td>
                      <td className="py-3 pr-4 whitespace-nowrap text-zinc-500">
                        {fmtDate(u.createdAt)}
                      </td>
                      <td className="py-3">
                        {isSelf(u) ? (
                          <span className="text-xs text-zinc-400">You</span>
                        ) : (
                          <button
                            onClick={() => removeAdmin(u)}
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-red-700 transition hover:bg-red-50"
                          >
                            <UserMinus className="h-3.5 w-3.5" /> Remove admin
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        {/* Create admin */}
        <Panel title="Create admin">
          <form onSubmit={onCreate} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
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
                  <ShieldPlus className="h-4 w-4" />
                )}
                Create admin
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

        {/* Promote existing user */}
        <Panel title="Promote existing user">
          <div className="relative mb-4 max-w-md">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-zinc-400" />
            <input
              type="search"
              value={promoteTerm}
              onChange={(e) => setPromoteTerm(e.target.value)}
              placeholder="Search a user by email, name or phone"
              className="w-full rounded-lg border border-zinc-300 py-2 pl-8 pr-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            />
          </div>

          {searching ? (
            <div className="grid place-items-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
            </div>
          ) : matches === null ? (
            <p className="text-sm text-zinc-500">
              Search for a user to grant admin access.
            </p>
          ) : matches.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No matching non-admin users.
            </p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {matches.map((u) => (
                <li
                  key={u.id}
                  className="flex items-center justify-between py-3 text-sm"
                >
                  <div>
                    <p className="font-medium text-zinc-900">
                      {u.name || u.email || '—'}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {u.email || '—'} · {u.role}
                    </p>
                  </div>
                  <button
                    onClick={() => setRole(u.id, 'ADMIN')}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-teal-600 px-3 py-1.5 text-xs font-semibold text-teal-700 transition hover:bg-teal-50"
                  >
                    <UserCog className="h-3.5 w-3.5" /> Make admin
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </AdminShell>
  );
}
