'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, CreditCard, Loader2, Smartphone } from 'lucide-react';
import { api, type Country, type Product, type OrderView } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { TopUpLogin } from './TopUpLogin';
import { useCheckoutQuote } from '@/lib/use-checkout-quote';
import { PaymentCharge } from './PaymentCharge';
import { DestinationPicker } from './purchase/DestinationPicker';
import { OrderSummary } from './purchase/OrderSummary';
import { PromoCodeField } from './purchase/PromoCodeField';
import {
  fitsTrip,
  planLabel,
  recommendProduct,
  tripDuration,
} from '@/lib/plans';
import { readReferralCode } from '@/lib/referral';

type Tab = 'buy' | 'topup';
type Step = 1 | 2;

const NO_PRODUCTS: Product[] = [];

export function PurchaseWidget() {
  const { user, authFetch, status } = useAuth();

  const [tab, setTab] = useState<Tab>('buy');
  const [step, setStep] = useState<Step>(1);

  // ── Step 1 ──────────────────────────────────────────────────────────────
  const [destination, setDestination] = useState<Country | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [catalog, setCatalog] = useState<{
    slug: string;
    products: Product[];
  } | null>(null);
  const [chosen, setChosen] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [attested, setAttested] = useState(false);

  const [appliedPromo, setAppliedPromo] = useState('');

  // Top-up
  const [iccid, setIccid] = useState('');
  type MyEsim = {
    esimId: string;
    iccid: string;
    title: string;
    destIso?: string;
  };
  const [myEsims, setMyEsims] = useState<MyEsim[] | null>(null);
  const [selectedEsimId, setSelectedEsimId] = useState('');

  // ── Step 2 ──────────────────────────────────────────────────────────────
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState<'mpesa' | 'card' | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill whenever a new user object loads (adjusting state during render, not in an effect).
  const [prefilledFrom, setPrefilledFrom] = useState<typeof user>(null);
  if (user && user !== prefilledFrom) {
    setPrefilledFrom(user);
    if (user.email) setEmail(user.email);
    if (user.phone) setPhone(user.phone);
    if (user.name) {
      const parts = user.name.trim().split(/\s+/);
      setFirstName(parts[0] ?? '');
      setLastName(parts.slice(1).join(' '));
    }
  }

  // When a logged-in user opens the top-up tab, load THEIR eSIMs so they can
  // pick one from a dropdown instead of typing an ICCID.
  useEffect(() => {
    if (tab !== 'topup' || status !== 'authed' || myEsims !== null) return;
    authFetch<OrderView[]>('/orders')
      .then((orders) =>
        setMyEsims(
          orders.flatMap((o) =>
            (o.esims ?? (o.esim ? [o.esim] : [])).map((e) => ({
              esimId: e.id,
              iccid: e.iccid,
              title: o.title,
              destIso: e.destIso,
            })),
          ),
        ),
      )
      .catch(() => setMyEsims([]));
  }, [tab, status, myEsims, authFetch]);

  // Load products when the destination changes. Results are keyed by destination,
  // so a slow response for a previous destination can never replace the current one.
  useEffect(() => {
    if (!destination) return;
    const slug = destination.seoSlug;
    let active = true;
    api
      .country(slug)
      .then((c) => {
        if (active) setCatalog({ slug, products: c.products });
      })
      .catch(() => {
        if (active) setCatalog({ slug, products: [] });
      });
    return () => {
      active = false;
    };
  }, [destination]);

  const days = tripDuration(startDate, endDate);
  const loadingProducts =
    !!destination && catalog?.slug !== destination.seoSlug;
  const products =
    destination && catalog?.slug === destination.seoSlug
      ? catalog.products
      : NO_PRODUCTS;
  // Keep the customer's pick while it is offered and fits the trip; otherwise recommend one.
  const product =
    chosen && products.some((p) => p.id === chosen.id) && fitsTrip(chosen, days)
      ? chosen
      : recommendProduct(products, days);
  const isRecommended = useCallback(
    (p: Product) => p.id === recommendProduct(products, days)?.id,
    [products, days],
  );

  const { quote, quoteError, quoting, idempotencyKey } = useCheckoutQuote(
    product?.id,
    startDate,
    endDate,
    tab === 'topup' ? 1 : quantity,
    tab === 'topup' ? '' : appliedPromo,
  );
  const unlimited = !!product?.unlimited;
  const discount = quote?.discount ?? 0;
  const promoMsg = appliedPromo
    ? quoteError ||
      (quote ? `${formatMoney(discount)} off applied` : 'Checking promo…')
    : null;
  const unitTotal = quote?.unitPrice ?? 0;
  const total = quote?.total ?? 0;

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const phoneOk = phone.replace(/\D/g, '').length >= 7;
  const step1Valid =
    tab === 'buy'
      ? !!destination &&
        !!product &&
        attested &&
        !!quote &&
        !!startDate &&
        !!endDate
      : status === 'authed' &&
        iccid.trim().length >= 10 &&
        !!product &&
        attested &&
        !!quote &&
        !!startDate &&
        !!endDate; // top-up: dropdown or manual ICCID
  // Top-ups are placed by a logged-in user — no name/email needed (the eSIM
  // and account are already known). Purchases require buyer name + email.
  const step2Valid =
    tab === 'topup' ? true : firstName.trim().length > 0 && emailOk;

  // Pick one of the user's own eSIMs to top up: sets the ICCID and auto-loads
  // that eSIM's destination so the top-up packages appear — no ICCID typing.
  async function selectEsim(esimId: string) {
    setSelectedEsimId(esimId);
    const e = myEsims?.find((m) => m.esimId === esimId);
    if (!e) return;
    setIccid(e.iccid);
    if (e.destIso) {
      try {
        setDestination(await api.country(e.destIso));
      } catch {
        /* packages just won't preload; destination stays as-is */
      }
    }
  }

  async function pay(method: 'mpesa' | 'card') {
    if (!product || !quote) return;
    setBusy(method);
    setError(null);
    const partnerCode = readReferralCode();
    const base = {
      productId: product.id,
      email,
      phone,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      compatAttested: attested,
      // Days drive per-day pricing for unlimited plans (ignored for fixed).
      startDate: quote.startDate,
      endDate: quote.endDate,
      quantity,
      expectedTotal: quote.total,
      expectedChargeAmount: quote.chargeAmount ?? undefined,
      idempotencyKey,
      ...(discount > 0 ? { promoCode: appliedPromo } : {}),
      ...(partnerCode ? { partnerCode } : {}),
    };
    try {
      if (tab === 'topup') {
        const { checkoutUrl } = await authFetch<{
          orderId: string;
          checkoutUrl: string;
        }>('/payments/topup', {
          method: 'POST',
          body: JSON.stringify({
            iccid,
            productId: product.id,
            method,
            startDate: quote.startDate,
            endDate: quote.endDate,
            expectedTotal: quote.total,
            expectedChargeAmount: quote.chargeAmount ?? undefined,
            idempotencyKey,
          }),
        });
        window.location.assign(checkoutUrl);
        return;
      }
      const endpoint =
        method === 'mpesa' ? '/payments/mpesa' : '/payments/card';
      const first = await authFetch<{ orderId: string; checkoutUrl: string }>(
        endpoint,
        { method: 'POST', body: JSON.stringify(base) },
      );
      window.location.assign(first.checkoutUrl);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Could not start payment. Please try again.',
      );
      setBusy(null);
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="w-full overflow-hidden rounded-3xl border border-zinc-200/80 bg-white shadow-[0_30px_80px_-20px_rgba(0,0,0,0.45)] ring-1 ring-black/5">
      {/* ── Tabs ──────────────────────────────────────────────────────── */}
      <div className="flex border-b border-zinc-200 text-[15px] font-semibold sm:text-base">
        {(['buy', 'topup'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              setStep(1);
              // Start each tab clean so a buy selection can't leak into top-up.
              setDestination(null);
              setChosen(null);
              setSelectedEsimId('');
              setIccid('');
            }}
            className={`flex-1 px-3 py-4 transition ${
              tab === t
                ? 'border-b-2 border-teal-600 text-teal-700'
                : 'text-zinc-500 hover:text-zinc-700'
            }`}
          >
            {t === 'buy'
              ? 'Buy your premium eSIM'
              : 'Top up your existing eSIM'}
          </button>
        ))}
      </div>

      <div className="space-y-5 p-6 sm:p-7">
        {step === 1 ? (
          <>
            {/* Inline login for top-up — no redirect; on success the eSIM
                picker below appears in place. */}
            {tab === 'topup' && status === 'anon' && <TopUpLogin />}
            {tab === 'topup' && status === 'loading' && (
              <div className="flex items-center gap-2 py-4 text-sm text-zinc-400">
                <Loader2 className="h-4 w-4 animate-spin" /> Checking your
                session…
              </div>
            )}

            {/* Top-up (logged in): pick one of your eSIMs OR type an ICCID */}
            {tab === 'topup' && status === 'authed' && (
              <>
                {/* Shortcut: choose from your own eSIMs (fills in the ICCID +
                    destination automatically). Only shown if you have any. */}
                {myEsims === null ? (
                  <div className="flex items-center gap-2 py-2 text-sm text-zinc-400">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading your
                    eSIMs…
                  </div>
                ) : myEsims.length > 0 ? (
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-600">
                      Your eSIMs
                    </label>
                    <select
                      value={selectedEsimId}
                      onChange={(e) => selectEsim(e.target.value)}
                      className="w-full rounded-xl border border-zinc-200 px-3.5 py-3 text-base outline-none focus:border-teal-500 sm:text-[15px]"
                    >
                      <option value="">Select one of your eSIMs…</option>
                      {myEsims.map((m) => (
                        <option key={m.esimId} value={m.esimId}>
                          {m.title} — {m.iccid.slice(-6)}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                {/* Manual ICCID — always available (e.g. an eSIM not on your
                    account). Typing here clears any dropdown selection. */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-600">
                    {myEsims && myEsims.length > 0
                      ? 'Or enter an ICCID'
                      : 'ICCID'}
                  </label>
                  <input
                    value={iccid}
                    onChange={(e) => {
                      setIccid(e.target.value);
                      setSelectedEsimId('');
                    }}
                    placeholder="Enter your eSIM ICCID"
                    className="w-full rounded-xl border border-zinc-200 px-3.5 py-3 text-base outline-none focus:border-teal-500 sm:text-[15px]"
                  />
                </div>
              </>
            )}

            {/* Trip details — for top-up these only appear once logged in. */}
            {(tab === 'buy' || status === 'authed') && (
              <>
                {/* Destination (auto-filled when you pick one of your eSIMs) */}
                <DestinationPicker
                  destination={destination}
                  onSelect={setDestination}
                />

                {/* Travel Dates ─────────────────────────────────────────────── */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-600">
                    Travel Dates
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={startDate}
                      min={today}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        if (endDate && e.target.value > endDate) setEndDate('');
                      }}
                      className="min-w-0 flex-1 rounded-lg border border-zinc-200 px-3 py-3 text-base outline-none focus:border-teal-500 sm:text-sm"
                    />
                    <span className="text-zinc-400">–</span>
                    <input
                      type="date"
                      value={endDate}
                      min={startDate || today}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="min-w-0 flex-1 rounded-lg border border-zinc-200 px-3 py-3 text-base outline-none focus:border-teal-500 sm:text-sm"
                    />
                  </div>
                </div>

                {/* Package + Quantity ───────────────────────────────────────── */}
                {loadingProducts ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
                  </div>
                ) : products.length > 0 ? (
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-600">
                        Package Size
                      </label>
                      <select
                        value={product?.id ?? ''}
                        onChange={(e) =>
                          setChosen(
                            products.find((p) => p.id === e.target.value) ??
                              null,
                          )
                        }
                        className="w-full rounded-xl border border-zinc-200 px-3.5 py-3 text-base outline-none focus:border-teal-500 sm:text-[15px]"
                      >
                        <option value="">
                          Select a plan for your travel dates…
                        </option>
                        {products
                          .filter(
                            (p) =>
                              fitsTrip(p, days) &&
                              (tab !== 'topup' || !p.unlimited),
                          )
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {planLabel(p)}
                            </option>
                          ))}
                      </select>
                      {product?.unlimited ? (
                        <p className="mt-1 text-xs text-teal-700">
                          Unlimited data — billed for {days} day
                          {days === 1 ? '' : 's'} ({formatMoney(total)})
                        </p>
                      ) : (
                        product &&
                        startDate &&
                        endDate &&
                        isRecommended(product) && (
                          <p className="mt-1 text-xs text-teal-700">
                            ✓ Recommended for your {days}-day trip
                          </p>
                        )
                      )}
                    </div>
                    {tab === 'buy' && (
                      <div className="w-24">
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-600">
                          No. of eSIMs
                        </label>
                        <select
                          value={quantity}
                          onChange={(e) => setQuantity(Number(e.target.value))}
                          className="w-full rounded-xl border border-zinc-200 px-3.5 py-3 text-base outline-none focus:border-teal-500 sm:text-[15px]"
                        >
                          {[1, 2, 3, 4, 5].map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                ) : destination ? (
                  <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    No plans available for this destination yet.
                  </p>
                ) : null}

                {/* Promo code ──────────────────────────────────────────────── */}
                {tab === 'buy' && (
                  <PromoCodeField
                    message={promoMsg}
                    accepted={discount > 0}
                    onApply={setAppliedPromo}
                  />
                )}

                {quoting && (
                  <p className="text-sm text-zinc-500">
                    Confirming the price for your travel dates…
                  </p>
                )}
                {quoteError && (
                  <p role="alert" className="text-sm text-red-700">
                    {quoteError}
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
                <p className="text-xs text-zinc-500">
                  Dates include both arrival and departure days. Unlimited: 3–30
                  days, 1 GB/day high-speed data, then up to 200 kbps.
                </p>
                {/* Device attestation ──────────────────────────────────────── */}
                <label className="flex cursor-pointer items-start gap-2.5 text-sm text-zinc-700">
                  <input
                    type="checkbox"
                    checked={attested}
                    onChange={(e) => setAttested(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-zinc-300 accent-teal-600"
                  />
                  <span>
                    I confirm that I have a{' '}
                    <strong>carrier-unlocked eSIM-enabled</strong> device.{' '}
                    <a
                      href="/how-it-works#compatibility"
                      className="text-teal-700 hover:underline"
                    >
                      Check compatible devices.
                    </a>
                  </span>
                </label>

                <button
                  onClick={() => setStep(2)}
                  disabled={!step1Valid || !quote?.checkoutEnabled}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-zinc-900 py-4 text-base font-semibold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next →
                </button>
              </>
            )}
          </>
        ) : (
          <>
            {/* ── Step 2: Details + payment ───────────────────────────── */}
            <button
              onClick={() => {
                setStep(1);
                setError(null);
              }}
              className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800"
            >
              <ChevronLeft className="h-4 w-4" /> Back
            </button>

            {/* Order summary ───────────────────────────────────────────── */}
            {product && (
              <OrderSummary
                title={product.title}
                total={total}
                unitPrice={unitTotal}
                quantity={quantity}
                unlimitedDays={unlimited ? days : undefined}
                discount={discount}
              />
            )}

            {tab === 'topup' ? (
              /* Top-up: buyer is logged in — confirm the target eSIM, no
                 personal details needed (we already know the account). */
              <div className="rounded-xl border border-zinc-200 px-4 py-3 text-sm">
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Topping up eSIM
                </span>
                <p className="mt-0.5 font-medium text-zinc-900">{iccid}</p>
              </div>
            ) : (
              <>
                {/* Name row */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-600">
                      First Name
                    </label>
                    <input
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="First name"
                      className="w-full rounded-xl border border-zinc-200 px-3.5 py-3 text-base outline-none focus:border-teal-500 sm:text-[15px]"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-600">
                      Last Name
                    </label>
                    <input
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Last name"
                      className="w-full rounded-xl border border-zinc-200 px-3.5 py-3 text-base outline-none focus:border-teal-500 sm:text-[15px]"
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-600">
                    Email — eSIM is sent here
                  </label>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    placeholder="you@example.com"
                    className="w-full rounded-xl border border-zinc-200 px-3.5 py-3 text-base outline-none focus:border-teal-500 sm:text-[15px]"
                  />
                  <p className="mt-1 text-xs text-zinc-400">
                    Log in with this email later to find your eSIM.
                  </p>
                </div>

                {/* Phone */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-600">
                    Phone — mobile money &amp; WhatsApp
                  </label>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    inputMode="tel"
                    placeholder="+254 7XX XXX XXX"
                    className="w-full rounded-xl border border-zinc-200 px-3.5 py-3 text-base outline-none focus:border-teal-500 sm:text-[15px]"
                  />
                </div>
              </>
            )}

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            {/* Pay buttons */}
            <button
              onClick={() => pay('mpesa')}
              disabled={
                !quote?.checkoutEnabled ||
                !step2Valid ||
                (tab === 'buy' && !phoneOk) ||
                busy !== null
              }
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-green-600 py-4 text-base font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy === 'mpesa' ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Smartphone className="h-5 w-5" />
              )}
              Pay {formatMoney(total)} via mobile money
            </button>

            <button
              onClick={() => pay('card')}
              disabled={
                !quote?.checkoutEnabled ||
                !step2Valid ||
                (tab === 'buy' && !phoneOk) ||
                busy !== null
              }
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-zinc-300 py-3.5 text-base font-medium text-zinc-700 transition hover:border-zinc-400 disabled:opacity-50"
            >
              {busy === 'card' ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <CreditCard className="h-5 w-5" />
              )}
              Pay by card
            </button>

            <div className="text-center text-xs text-zinc-400">
              <PaymentCharge quote={quote} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
