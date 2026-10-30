'use client';

import { useState } from 'react';
import { Plus, Loader2, Smartphone, CreditCard } from 'lucide-react';
import { api, type Product } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { useCheckoutQuote } from '@/lib/use-checkout-quote';
import { PaymentCharge } from './PaymentCharge';

export function TopUpSheet({
  esimId,
  destIso,
}: {
  esimId: string;
  destIso?: string;
}) {
  const { authFetch } = useAuth();
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState<Product[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState('');
  const { quote, quoteError, quoting, idempotencyKey } = useCheckoutQuote(
    selected ?? undefined,
    startDate,
    endDate,
  );

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !products) {
      try {
        // Unlimited (per-day) plans aren't offered as top-ups.
        setProducts((await api.products(destIso)).filter((p) => !p.unlimited));
      } catch {
        setProducts([]);
      }
    }
  }

  async function pay(productId: string, method: 'mpesa' | 'card') {
    if (!quote) return;
    setError('');
    setBusy(`${productId}:${method}`);
    try {
      const { checkoutUrl } = await authFetch<{
        orderId: string;
        checkoutUrl: string;
      }>('/payments/topup', {
        method: 'POST',
        body: JSON.stringify({
          esimId,
          productId,
          method,
          startDate: quote.startDate,
          endDate: quote.endDate,
          expectedTotal: quote.total,
          expectedChargeAmount: quote.chargeAmount ?? undefined,
          idempotencyKey,
        }),
      });
      window.location.assign(checkoutUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to start payment.');
      setBusy(null);
    }
  }

  return (
    <div className="mt-4 border-t border-zinc-100 pt-4">
      <button
        onClick={toggle}
        className="flex items-center gap-1.5 text-sm font-medium text-teal-700 hover:underline"
      >
        <Plus className="h-4 w-4" /> Top up / extend data
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          {products === null ? (
            <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
          ) : products.length === 0 ? (
            <p className="text-sm text-zinc-500">No add-ons available.</p>
          ) : (
            products.map((p) => {
              const isOpen = selected === p.id;
              return (
                <div
                  key={p.id}
                  className={`rounded-lg border ${
                    isOpen ? 'border-teal-300 bg-teal-50/40' : 'border-zinc-200'
                  }`}
                >
                  <button
                    onClick={() => setSelected(isOpen ? null : p.id)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-zinc-50"
                  >
                    <span>
                      {p.dataLabel} · {p.minDays ?? 1}–{p.validityDays} days ·{' '}
                      {p.destName}
                    </span>
                    <span className="font-medium text-teal-700">
                      {formatMoney(p.priceKes)}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="space-y-3 px-3 pb-3 pt-1">
                      <div className="grid grid-cols-2 gap-2">
                        <label className="text-xs">
                          Start date
                          <input
                            type="date"
                            value={startDate}
                            min={new Date().toISOString().slice(0, 10)}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full rounded border p-2"
                          />
                        </label>
                        <label className="text-xs">
                          End date
                          <input
                            type="date"
                            value={endDate}
                            min={startDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full rounded border p-2"
                          />
                        </label>
                      </div>
                      <p className="text-sm">
                        {quoting
                          ? 'Confirming price…'
                          : quote
                            ? `Total: ${formatMoney(quote.total)} for ${quote.days} days (inclusive)`
                            : ''}
                      </p>
                      {(quoteError || error) && (
                        <p role="alert" className="text-sm text-red-700">
                          {quoteError || error}
                        </p>
                      )}
                      {quote?.checkoutNotice && (
                        <p
                          role="status"
                          className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900"
                        >
                          {quote.checkoutNotice}
                        </p>
                      )}
                      <PaymentCharge quote={quote} />
                      <button
                        onClick={() => pay(p.id, 'mpesa')}
                        disabled={
                          !quote?.checkoutEnabled ||
                          !startDate ||
                          !endDate ||
                          busy !== null
                        }
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-green-600 py-2 text-sm font-medium text-white transition hover:bg-green-700 disabled:opacity-50"
                      >
                        {busy === `${p.id}:mpesa` ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Smartphone className="h-4 w-4" />
                        )}
                        Mobile money
                      </button>
                      <button
                        onClick={() => pay(p.id, 'card')}
                        disabled={
                          !quote?.checkoutEnabled ||
                          !startDate ||
                          !endDate ||
                          busy !== null
                        }
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-zinc-300 py-2 text-sm font-medium text-zinc-700 transition hover:border-zinc-400 disabled:opacity-50"
                      >
                        {busy === `${p.id}:card` ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CreditCard className="h-4 w-4" />
                        )}
                        Card
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
