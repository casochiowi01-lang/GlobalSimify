'use client';

import { useEffect, useState } from 'react';
import {
  Loader2,
  ShieldCheck,
  Smartphone,
  CreditCard,
  Tag,
  Mail,
} from 'lucide-react';
import { api, type Product } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { useCheckoutQuote } from '@/lib/use-checkout-quote';
import { readReferralCode } from '@/lib/referral';
import { PaymentCharge } from './PaymentCharge';

export function CheckoutForm({ planId }: { planId: string }) {
  const { user, authFetch } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [attested, setAttested] = useState(false);
  const [promo, setPromo] = useState('');
  const [appliedPromo, setAppliedPromo] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [busy, setBusy] = useState<'mpesa' | 'card' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .product(planId)
      .then(setProduct)
      .catch(() => setProduct(null));
  }, [planId]);

  // Pre-fill whenever a new user object loads (adjusting state during render, not in an effect).
  const [prefilledFrom, setPrefilledFrom] = useState<typeof user>(null);
  if (user && user !== prefilledFrom) {
    setPrefilledFrom(user);
    if (user.email) setEmail(user.email);
    if (user.phone) setPhone(user.phone);
  }

  const phoneOk = phone.replace(/\D/g, '').length >= 7;
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const unlimited = !!product?.unlimited;
  const { quote, quoteError, quoting, idempotencyKey } = useCheckoutQuote(
    product?.id,
    startDate,
    endDate,
    1,
    appliedPromo,
  );
  const subtotal = quote?.subtotal ?? 0,
    total = quote?.total ?? 0,
    discount = quote?.discount ?? 0;
  const promoMsg = appliedPromo
    ? quoteError ||
      (quote ? `${formatMoney(discount)} off applied` : 'Checking promo…')
    : null;
  const partnerCode = readReferralCode();
  function applyPromo() {
    setAppliedPromo(promo.trim().toUpperCase());
  }

  async function pay(method: 'mpesa' | 'card') {
    if (!quote) return;
    setBusy(method);
    setError(null);
    const body = {
      productId: planId,
      email,
      phone,
      compatAttested: attested,
      firstName,
      lastName,
      startDate: quote.startDate,
      endDate: quote.endDate,
      expectedTotal: quote.total,
      expectedChargeAmount: quote.chargeAmount ?? undefined,
      idempotencyKey,
      ...(discount > 0 ? { promoCode: appliedPromo } : {}),
      ...(partnerCode ? { partnerCode } : {}),
    };
    try {
      // Both M-Pesa and card go through Paystack's hosted checkout; the API
      // returns the URL to redirect to (in mock mode this is the order page).
      const endpoint =
        method === 'mpesa' ? '/payments/mpesa' : '/payments/card';
      const { checkoutUrl } = await authFetch<{
        orderId: string;
        checkoutUrl: string;
      }>(endpoint, { method: 'POST', body: JSON.stringify(body) });
      window.location.assign(checkoutUrl);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Could not start payment. Please try again.',
      );
      setBusy(null);
    }
  }

  if (!product) {
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-zinc-200 bg-white p-5">
        <h2 className="font-semibold text-zinc-900">{product.title}</h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label>
            Start date
            <input
              aria-label="Start date"
              type="date"
              min={new Date().toISOString().slice(0, 10)}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded border p-2"
            />
          </label>
          <label>
            End date
            <input
              aria-label="End date"
              type="date"
              min={startDate}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded border p-2"
            />
          </label>
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          Both travel dates are included. This plan supports{' '}
          {product.minDays ?? 1}–{product.validityDays} days.
          {unlimited
            ? ' Unlimited includes 1 GB/day at high speed, then up to 200 kbps.'
            : ''}
        </p>
        {quoting && <p className="mt-2 text-sm">Confirming price…</p>}
        {quoteError && (
          <p role="alert" className="mt-2 text-sm text-red-700">
            {quoteError}
          </p>
        )}
        {quote?.checkoutNotice && (
          <p
            role="status"
            className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"
          >
            {quote.checkoutNotice}
          </p>
        )}
        <PaymentCharge quote={quote} />
        <div className="mt-3 space-y-1 border-t border-zinc-100 pt-3 text-sm">
          <div className="flex justify-between text-zinc-500">
            <span>Subtotal{quote ? ` (${quote.days} days)` : ''}</span>
            <span>{formatMoney(subtotal)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-teal-700">
              <span>Discount</span>
              <span>-{formatMoney(discount)}</span>
            </div>
          )}
          <div className="flex justify-between pt-1 text-lg font-bold text-zinc-900">
            <span>Total</span>
            <span>{formatMoney(total)}</span>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5">
        <label className="text-sm font-medium text-zinc-700">Promo code</label>
        <div className="mt-1 flex gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2.5 focus-within:border-teal-500">
            <Tag className="h-4 w-4 text-zinc-400" />
            <input
              value={promo}
              onChange={(e) => setPromo(e.target.value.toUpperCase())}
              placeholder="SAVE10"
              className="w-full uppercase outline-none"
            />
          </div>
          <button
            onClick={applyPromo}
            className="rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700"
          >
            Apply
          </button>
        </div>
        {promoMsg && (
          <p
            className={`mt-1.5 text-xs ${discount > 0 ? 'text-teal-700' : 'text-red-600'}`}
          >
            {promoMsg}
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <label>
            First name
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full rounded border p-2"
              autoComplete="given-name"
            />
          </label>
          <label>
            Last name
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full rounded border p-2"
              autoComplete="family-name"
            />
          </label>
        </div>
        <div>
          <label className="text-sm font-medium text-zinc-700">
            Email (eSIM is sent here)
          </label>
          <div className="mt-1 flex items-center gap-2 rounded-xl border border-zinc-200 px-3 py-3 focus-within:border-teal-500">
            <Mail className="h-5 w-5 text-zinc-400" />
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              inputMode="email"
              placeholder="you@example.com"
              className="w-full outline-none"
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-zinc-700">
            Phone (mobile money &amp; WhatsApp)
          </label>
          <div className="mt-1 flex items-center gap-2 rounded-xl border border-zinc-200 px-3 py-3 focus-within:border-teal-500">
            <Smartphone className="h-5 w-5 text-zinc-400" />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              placeholder="+254 7XX XXX XXX"
              className="w-full outline-none"
            />
          </div>
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          <input
            type="checkbox"
            checked={attested}
            onChange={(e) => setAttested(e.target.checked)}
            className="mt-0.5 h-4 w-4"
          />
          <span>
            I confirm my device is{' '}
            <strong>eSIM-capable and carrier-unlocked</strong>. (Dial{' '}
            <code>*#06#</code> - if you see an EID, you are good.)
          </span>
        </label>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          onClick={() => pay('mpesa')}
          disabled={
            !quote?.checkoutEnabled ||
            !startDate ||
            !endDate ||
            !firstName.trim() ||
            !phoneOk ||
            !attested ||
            !emailOk ||
            busy !== null
          }
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 py-3.5 font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy === 'mpesa' ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <ShieldCheck className="h-5 w-5" />
          )}
          Pay {formatMoney(total)} via mobile money
        </button>
        <button
          onClick={() => pay('card')}
          disabled={
            !quote?.checkoutEnabled ||
            !startDate ||
            !endDate ||
            !firstName.trim() ||
            !phoneOk ||
            !attested ||
            !emailOk ||
            busy !== null
          }
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-300 py-3 font-medium text-zinc-700 transition hover:border-zinc-400 disabled:opacity-50"
        >
          {busy === 'card' ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <CreditCard className="h-5 w-5" />
          )}
          Pay by card
        </button>
        <p className="text-center text-xs text-zinc-400">
          Prices in USD. Secured by Paystack; the exact KES charge is shown
          above.
        </p>
      </div>
    </div>
  );
}
