'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Info } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { formatMoney } from '@/lib/format';
import { AdminShell, Kpi, Panel } from '@/components/admin/AdminShell';
import type { PricingConfig } from '@/lib/admin';

interface PricingForm {
  marginPct: string; // percent, e.g. "35"
  fxBufferPct: string;
  processorFeePct: string;
  roundTo: string;
}

export default function AdminPricing() {
  const { status, user, authFetch } = useAuth();
  const [config, setConfig] = useState<PricingConfig | null>(null);
  const [err, setErr] = useState(false);
  const [form, setForm] = useState<PricingForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  // Live-preview sample cost (wholesale, USD)
  const [sampleBase, setSampleBase] = useState('2.00');

  // Re-price catalogue
  const [repricing, setRepricing] = useState(false);
  const [repriceMsg, setRepriceMsg] = useState<string | null>(null);

  // Testing: zero out all knobs so displayed prices equal the exact sheet.
  const [zeroing, setZeroing] = useState(false);

  const load = useCallback(() => {
    authFetch<PricingConfig>('/admin/pricing')
      .then((c) => {
        setConfig(c);
        setForm({
          marginPct: String(+(c.marginPct * 100).toFixed(2)),
          fxBufferPct: String(+(c.fxBufferPct * 100).toFixed(2)),
          processorFeePct: String(+(c.processorFeePct * 100).toFixed(2)),
          roundTo: String(c.roundTo),
        });
        setErr(false);
      })
      .catch(() => setErr(true));
  }, [authFetch]);

  useEffect(() => {
    if (status !== 'authed' || user?.role !== 'ADMIN') return;
    load();
  }, [status, user, authFetch, load]);

  // Live preview mirrors the backend formula.
  const preview = useMemo(() => {
    if (!form) return null;
    const base = Number(sampleBase) || 0;
    const margin = (Number(form.marginPct) || 0) / 100;
    const fxBuffer = (Number(form.fxBufferPct) || 0) / 100;
    const fee = (Number(form.processorFeePct) || 0) / 100;
    const roundTo = Number(form.roundTo) || 0;
    if (base <= 0 || fee >= 1) return null;
    const raw = (base * (1 + fxBuffer) * (1 + margin)) / (1 - fee);
    // roundTo <= 0 => no rounding (exact), matching the backend.
    const retail =
      roundTo > 0
        ? Math.round(Math.ceil(raw / roundTo) * roundTo * 100) / 100
        : Math.round(raw * 100) / 100;
    const profit = retail - base;
    const marginOnCost = base > 0 ? (profit / base) * 100 : 0;
    return { base, retail, profit, marginOnCost };
  }, [form, sampleBase]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setSaved(false);
    setSaveErr(null);
    try {
      const updated = await authFetch<PricingConfig>('/admin/pricing', {
        method: 'POST',
        body: JSON.stringify({
          marginPct: (Number(form.marginPct) || 0) / 100,
          fxBufferPct: (Number(form.fxBufferPct) || 0) / 100,
          processorFeePct: (Number(form.processorFeePct) || 0) / 100,
          roundTo: Number(form.roundTo) || 0,
        }),
      });
      setConfig(updated);
      setSaved(true);
    } catch {
      setSaveErr('Could not save pricing.');
    } finally {
      setSaving(false);
    }
  };

  const resetToZero = async () => {
    if (
      !window.confirm(
        'This changes actual store prices, not just the preview. All profit markup, FX buffer, processor allowance and rounding will be removed. Continue for testing?',
      )
    )
      return;
    setZeroing(true);
    setSaved(false);
    setSaveErr(null);
    try {
      const updated = await authFetch<PricingConfig>('/admin/pricing', {
        method: 'POST',
        body: JSON.stringify({
          marginPct: 0,
          fxBufferPct: 0,
          processorFeePct: 0,
          roundTo: 0,
        }),
      });
      setConfig(updated);
      setForm({
        marginPct: '0',
        fxBufferPct: '0',
        processorFeePct: '0',
        roundTo: '0',
      });
      setSaved(true);
    } catch {
      setSaveErr('Could not reset pricing.');
    } finally {
      setZeroing(false);
    }
  };

  const reprice = async () => {
    setRepricing(true);
    setRepriceMsg(null);
    try {
      const res = await authFetch<{ products: number }>(
        '/admin/catalog/refresh',
        {
          method: 'POST',
        },
      );
      setRepriceMsg(`Re-priced ${res.products} products.`);
    } catch {
      setRepriceMsg('Could not re-price the catalogue.');
    } finally {
      setRepricing(false);
    }
  };

  const inputCls =
    'w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500';
  const labelCls = 'block text-xs font-medium text-zinc-600 mb-1';

  return (
    <AdminShell title="Pricing & margin">
      {!config || !form ? (
        err ? (
          <p className="text-sm text-red-600">Could not load pricing.</p>
        ) : (
          <div className="grid place-items-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
          </div>
        )
      ) : (
        <div className="space-y-6">
          <div className="flex items-start gap-3 rounded-2xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-900">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-teal-600" />
            <p>
              <span className="font-semibold">
                Your markup is applied to CELITECH wholesale costs
              </span>
              , together with the FX buffer, processor allowance and rounding.
              New purchases and top-ups use these settings; existing paid orders
              are unchanged. Markup is not net profit.
            </p>
          </div>

          <Panel title="USD → KES checkout conversion">
            <div className="space-y-3">
              <p className="text-sm text-zinc-600">
                Prices are in USD and Paystack collects KES. Conversion uses an
                automatic daily reference rate, separate from your FX-buffer
                percentage. It is not a guaranteed bank settlement rate.
              </p>
              <p
                className={`text-sm ${config.fxApproved ? 'text-teal-700' : 'text-amber-800'}`}
              >
                {config.fxApproved
                  ? `US$1 = KES ${config.fxRate}. Reference updated ${new Date(config.fxConfirmedAt!).toLocaleString()}.`
                  : 'No fresh reference rate is available. New real payments are blocked until it refreshes.'}{' '}
                Rates refresh automatically each day. If the feed is
                unavailable, a confirmed rate can be used for at most 48 hours
                from its observation time; older data pauses new payments.
              </p>
              <a
                href="https://www.exchangerate-api.com"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-teal-700 underline"
              >
                Rates by Exchange Rate API
              </a>
            </div>
          </Panel>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Pricing settings">
              <form onSubmit={save} className="space-y-4">
                <div>
                  <label className={labelCls}>Profit markup on cost (%)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={form.marginPct}
                    onChange={(e) =>
                      setForm({ ...form, marginPct: e.target.value })
                    }
                    className={inputCls}
                  />
                  <p className="mt-1 text-xs text-zinc-400">
                    Applied to the FX-buffered wholesale cost; not a percentage
                    of the final selling price.
                  </p>
                </div>
                <div>
                  <label className={labelCls}>FX buffer (%)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={form.fxBufferPct}
                    onChange={(e) =>
                      setForm({ ...form, fxBufferPct: e.target.value })
                    }
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Processor fee (%)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={form.processorFeePct}
                    onChange={(e) =>
                      setForm({ ...form, processorFeePct: e.target.value })
                    }
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Round retail up to (USD)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={form.roundTo}
                    onChange={(e) =>
                      setForm({ ...form, roundTo: e.target.value })
                    }
                    className={inputCls}
                  />
                </div>
                <div className="text-xs text-zinc-400">
                  USD → KES reference rate:{' '}
                  <span className="font-medium text-zinc-600">
                    {config.fxApproved ? config.fxRate : 'unavailable'}
                  </span>
                  . Updated automatically; separate from the FX buffer.
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-700 disabled:opacity-60"
                  >
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={resetToZero}
                    disabled={zeroing || saving}
                    className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-60"
                    title="Set margin, FX buffer, fee and rounding all to 0 — prices then equal the exact wholesale sheet price."
                  >
                    {zeroing && <Loader2 className="h-4 w-4 animate-spin" />}
                    Set all to 0 (testing)
                  </button>
                  {saved && (
                    <span className="text-sm font-medium text-teal-700">
                      Saved — catalogue re-priced
                    </span>
                  )}
                  {saveErr && (
                    <span className="text-sm text-red-600">{saveErr}</span>
                  )}
                </div>
                <p className="text-xs text-zinc-400">
                  “Set all to 0” makes every plan show its exact wholesale
                  (sheet) price — use it to verify prices, then set your margin.
                </p>
              </form>
            </Panel>

            <Panel title="Live price preview">
              <div className="space-y-4">
                <div>
                  <label className={labelCls}>
                    Sample wholesale cost (USD)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={sampleBase}
                    onChange={(e) => setSampleBase(e.target.value)}
                    className={inputCls}
                  />
                </div>
                {preview ? (
                  <div className="grid grid-cols-2 gap-4">
                    <Kpi
                      label="Retail price"
                      value={formatMoney(preview.retail)}
                      tone="good"
                    />
                    <Kpi
                      label="Retail less wholesale"
                      value={formatMoney(preview.profit)}
                      tone="good"
                    />
                    <Kpi
                      label="Wholesale cost"
                      value={formatMoney(preview.base)}
                    />
                    <Kpi
                      label="Total uplift on cost"
                      value={`${preview.marginOnCost.toFixed(1)}%`}
                    />
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500">
                    Enter a positive cost and a processor allowance below 100%
                    to preview a price.
                  </p>
                )}
                <p className="text-xs text-zinc-400">
                  Formula: retail = ceil(cost × (1 + FX buffer) × (1 + margin) ÷
                  (1 − fee) ÷ round) × round. With rounding set to zero, only
                  cents are rounded. Retail less wholesale is before actual
                  processing costs, refunds, partner commissions and operating
                  expenses.
                </p>
              </div>
            </Panel>
          </div>

          <Panel title="Re-price catalogue">
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={reprice}
                disabled={repricing}
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 disabled:opacity-60"
              >
                {repricing && <Loader2 className="h-4 w-4 animate-spin" />}
                Re-price catalogue now
              </button>
              {repriceMsg && (
                <span className="text-sm text-zinc-600">{repriceMsg}</span>
              )}
            </div>
            <p className="mt-2 text-xs text-zinc-400">
              Saving settings above already re-prices automatically. Use this to
              force a refresh.
            </p>
          </Panel>
        </div>
      )}
    </AdminShell>
  );
}
