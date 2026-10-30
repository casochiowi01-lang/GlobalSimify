'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { formatMoney } from '@/lib/format';
import { AdminShell, Panel } from '@/components/admin/AdminShell';
import type { Promo } from '@/lib/admin';

interface PromoForm {
  code: string;
  kind: 'PERCENT' | 'FIXED';
  value: string;
  minSpendKes: string;
  maxUses: string;
  validTo: string;
}

const EMPTY_FORM: PromoForm = {
  code: '',
  kind: 'PERCENT',
  value: '',
  minSpendKes: '',
  maxUses: '',
  validTo: '',
};

function promoValue(p: Promo): string {
  const v = Number(p.value);
  return p.kind === 'PERCENT' ? `${v}%` : formatMoney(v);
}

export default function AdminPromos() {
  const { status, user, authFetch } = useAuth();
  const [promos, setPromos] = useState<Promo[] | null>(null);
  const [err, setErr] = useState(false);
  const [form, setForm] = useState<PromoForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const load = useCallback(() => {
    authFetch<Promo[]>('/admin/promotions')
      .then((list) => {
        setPromos(list);
        setErr(false);
      })
      .catch(() => setErr(true));
  }, [authFetch]);

  useEffect(() => {
    if (status !== 'authed' || user?.role !== 'ADMIN') return;
    load();
  }, [status, user, authFetch, load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveErr(null);
    try {
      const body: Record<string, unknown> = {
        code: form.code.trim().toUpperCase(),
        kind: form.kind,
        value: Number(form.value),
      };
      if (form.minSpendKes.trim() !== '')
        body.minSpendKes = Number(form.minSpendKes);
      if (form.maxUses.trim() !== '') body.maxUses = Number(form.maxUses);
      if (form.validTo.trim() !== '') body.validTo = form.validTo;

      await authFetch<Promo>('/admin/promotions', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setForm(EMPTY_FORM);
      load();
    } catch {
      setSaveErr('Could not create the promo code.');
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    'w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500';
  const labelCls = 'block text-xs font-medium text-zinc-600 mb-1';

  return (
    <AdminShell title="Promo codes">
      <div className="space-y-6">
        <Panel title="Create promo">
          <form
            onSubmit={submit}
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            <div>
              <label className={labelCls}>Code</label>
              <input
                required
                value={form.code}
                onChange={(e) =>
                  setForm({ ...form, code: e.target.value.toUpperCase() })
                }
                placeholder="SUMMER10"
                className={`${inputCls} uppercase`}
              />
            </div>
            <div>
              <label className={labelCls}>Type</label>
              <select
                value={form.kind}
                onChange={(e) =>
                  setForm({
                    ...form,
                    kind: e.target.value as 'PERCENT' | 'FIXED',
                  })
                }
                className={inputCls}
              >
                <option value="PERCENT">Percent off (%)</option>
                <option value="FIXED">Fixed amount (USD)</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>
                Value {form.kind === 'PERCENT' ? '(%)' : '(USD)'}
              </label>
              <input
                required
                type="number"
                min="0"
                step="any"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Min spend (USD, optional)</label>
              <input
                type="number"
                min="0"
                step="any"
                value={form.minSpendKes}
                onChange={(e) =>
                  setForm({ ...form, minSpendKes: e.target.value })
                }
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Max uses (optional)</label>
              <input
                type="number"
                min="0"
                step="1"
                value={form.maxUses}
                onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Expires (optional)</label>
              <input
                type="date"
                value={form.validTo}
                onChange={(e) => setForm({ ...form, validTo: e.target.value })}
                className={inputCls}
              />
            </div>
            <div className="flex items-end gap-3 sm:col-span-2 lg:col-span-3">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-700 disabled:opacity-60"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Create promo
              </button>
              {saveErr && (
                <span className="text-sm text-red-600">{saveErr}</span>
              )}
              <span className="ml-auto text-xs text-zinc-400">
                Money values are in USD.
              </span>
            </div>
          </form>
        </Panel>

        <Panel title="Active promo codes">
          {!promos ? (
            err ? (
              <p className="text-sm text-red-600">
                Could not load promo codes.
              </p>
            ) : (
              <div className="grid place-items-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
              </div>
            )
          ) : promos.length === 0 ? (
            <p className="text-sm text-zinc-500">No promo codes yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500">
                    <th className="py-2 pr-4 font-medium">Code</th>
                    <th className="py-2 pr-4 font-medium">Type</th>
                    <th className="py-2 pr-4 font-medium">Value</th>
                    <th className="py-2 pr-4 font-medium">Min spend</th>
                    <th className="py-2 pr-4 font-medium">Uses</th>
                    <th className="py-2 pr-4 font-medium">Active</th>
                    <th className="py-2 pr-4 font-medium">Expires</th>
                  </tr>
                </thead>
                <tbody>
                  {promos.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b border-zinc-100 last:border-0"
                    >
                      <td className="py-2.5 pr-4 font-medium text-zinc-900">
                        {p.code}
                      </td>
                      <td className="py-2.5 pr-4 text-zinc-600">{p.kind}</td>
                      <td className="py-2.5 pr-4 text-zinc-900">
                        {promoValue(p)}
                      </td>
                      <td className="py-2.5 pr-4 text-zinc-600">
                        {p.minSpendKes != null
                          ? formatMoney(Number(p.minSpendKes))
                          : '—'}
                      </td>
                      <td className="py-2.5 pr-4 text-zinc-600">
                        {`${p.usedCount}${p.maxUses ? '/' + p.maxUses : ''}`}
                      </td>
                      <td className="py-2.5 pr-4">
                        <span
                          className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                            p.active
                              ? 'bg-teal-100 text-teal-800'
                              : 'bg-zinc-100 text-zinc-600'
                          }`}
                        >
                          {p.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-zinc-600">
                        {p.validTo
                          ? new Date(p.validTo).toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })
                          : '—'}
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
