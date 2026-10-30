import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Zap,
  ShieldCheck,
  Smartphone,
  Globe2,
  QrCode,
  CreditCard,
  Plane,
  Wifi,
  Check,
  Sparkles,
  MapPin,
  Headphones,
} from 'lucide-react';
import { api } from '@/lib/api';
import { SearchBar } from '@/components/SearchBar';
import { DestinationCard } from '@/components/DestinationCard';
import { Flag } from '@/components/Flag';
import { PurchaseWidget } from '@/components/PurchaseWidget';
import { Testimonials } from '@/components/Testimonials';

export const metadata: Metadata = { alternates: { canonical: '/' } };

const REGIONS: { name: string; emoji: string; blurb: string }[] = [
  { name: 'Europe', emoji: '🇪🇺', blurb: '39+ countries, one eSIM' },
  { name: 'Middle East', emoji: '🕌', blurb: 'Dubai, Saudi, Qatar & more' },
  { name: 'Asia', emoji: '🏯', blurb: 'Thailand, China, India…' },
  { name: 'Africa', emoji: '🦁', blurb: 'Stay online across the continent' },
  { name: 'North America', emoji: '🗽', blurb: 'USA, Canada, Mexico' },
  { name: 'Global', emoji: '🌍', blurb: '120+ countries, one plan' },
];

const WHY: { icon: typeof Zap; title: string; body: string }[] = [
  {
    icon: CreditCard,
    title: 'Pay with mobile money or card',
    body: 'Check out in seconds with the payment method you already use. No forex, no hassle.',
  },
  {
    icon: Zap,
    title: 'Delivered instantly',
    body: 'Your eSIM and QR code arrive in seconds — by email and on your account.',
  },
  {
    icon: ShieldCheck,
    title: 'No roaming bills',
    body: 'A fixed price up front. No bill shock when you get home.',
  },
  {
    icon: Globe2,
    title: 'Coverage everywhere',
    body: '120+ destinations on fast 4G/5G networks, powered by Celitech.',
  },
  {
    icon: Smartphone,
    title: 'Keep your number',
    body: 'Your eSIM runs alongside your home network. Stay reachable on WhatsApp.',
  },
  {
    icon: Headphones,
    title: 'Real support',
    body: 'Talk to a human on WhatsApp before, during, and after your trip.',
  },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: 'What is an eSIM?',
    a: 'An eSIM is a digital SIM built into your phone. Instead of a plastic card, you scan a QR code and a travel data plan installs in seconds — no shop, no swapping SIMs.',
  },
  {
    q: 'Will my phone work with an eSIM?',
    a: 'Most phones from 2019 onward support eSIM (iPhone XS+, recent Samsung Galaxy, Google Pixel and more). Dial *#06# — if you see an EID number, you are good to go.',
  },
  {
    q: 'Do I keep my number?',
    a: 'Yes. The travel eSIM adds data alongside your normal SIM, so you keep your usual number for calls, mobile money and WhatsApp.',
  },
  {
    q: 'When should I install it?',
    a: 'Buy and install before you fly, on home Wi-Fi. Your plan only starts counting once you connect abroad, so you land already online.',
  },
  {
    q: 'How do I pay?',
    a: 'With mobile money or card, in Kenyan Shillings. You get a clear price up front — no roaming surprises.',
  },
];

export default async function Home() {
  let popular = [] as Awaited<ReturnType<typeof api.countries>>;
  try {
    popular = (await api.countries()).slice(0, 8);
  } catch {
    // API offline — the page still renders with the search box.
  }

  return (
    <main className="flex flex-col">
      {/* ---------------------------------------------------------------- Hero */}
      <section className="relative isolate overflow-hidden">
        {/* teal gradient fallback */}
        <div
          aria-hidden
          className="absolute inset-0 -z-20 bg-gradient-to-br from-teal-700 via-teal-600 to-emerald-600"
        />
        {/* hero image full-bleed — drop /hero.webp to activate */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[url('/hero.webp')] bg-cover bg-center"
        />
        {/* readability scrim */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-gradient-to-b from-zinc-950/60 via-zinc-950/35 to-zinc-950/70"
        />

        <div className="relative mx-auto max-w-6xl px-4 py-14 sm:py-20">
          <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-12">
            {/* ── Left: copy ─────────────────────────────────────────── */}
            <div className="flex flex-col items-start lg:flex-1 lg:pt-8">
              <span className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-sm font-medium text-white backdrop-blur">
                <Flag iso="GX" size="text-sm" /> Built for African and Global
                Travellers
              </span>
              <h1
                className="animate-fade-up mt-5 text-4xl font-bold tracking-tight text-white drop-shadow-sm sm:text-5xl xl:text-6xl"
                style={{ animationDelay: '0.05s' }}
              >
                Land abroad,{' '}
                <span className="bg-gradient-to-r from-teal-200 to-emerald-200 bg-clip-text text-transparent">
                  already connected.
                </span>
              </h1>
              <p
                className="animate-fade-up mt-4 max-w-lg text-lg text-zinc-100/90"
                style={{ animationDelay: '0.1s' }}
              >
                Buy a travel data eSIM with mobile money or card, scan one QR
                code, and skip the airport SIM queues. No roaming bills, no
                surprises.
              </p>
              <div
                className="animate-fade-up mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-white/85"
                style={{ animationDelay: '0.15s' }}
              >
                <span className="flex items-center gap-1.5">
                  <Zap className="h-4 w-4 text-teal-300" /> Instant delivery
                </span>
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-teal-300" /> Pay with
                  mobile money or card
                </span>
                <span className="flex items-center gap-1.5">
                  <Smartphone className="h-4 w-4 text-teal-300" /> Keep your
                  number
                </span>
              </div>
              {/* Search bar — visible on mobile below the widget, on desktop in the left col */}
              <div
                className="animate-fade-up mt-8 hidden w-full max-w-md lg:block"
                style={{ animationDelay: '0.2s' }}
              >
                <SearchBar />
              </div>
            </div>

            {/* ── Right: Purchase widget ─────────────────────────────── */}
            <div
              className="animate-fade-up w-full lg:w-[500px] lg:shrink-0"
              style={{ animationDelay: '0.1s' }}
            >
              <PurchaseWidget />
            </div>
          </div>

          {/* Mobile search bar — below the widget */}
          <div className="mt-6 lg:hidden">
            <SearchBar />
          </div>
        </div>
      </section>

      {/* stats strip */}
      <section className="border-b border-zinc-100 bg-white">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px px-4 py-6 text-center sm:grid-cols-4">
          {[
            ['120+', 'Countries covered'],
            ['60s', 'To get connected'],
            ['Mobile money', 'Pay your way'],
            ['WhatsApp', 'Customer support'],
          ].map(([big, small]) => (
            <div key={small}>
              <div className="text-2xl font-bold text-zinc-900">{big}</div>
              <div className="text-xs text-zinc-500">{small}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------ Popular destinations */}
      <section className="mx-auto w-full max-w-6xl px-4 py-14">
        <div className="flex items-end justify-between">
          <h2 className="text-2xl font-semibold text-zinc-900">
            Popular destinations
          </h2>
          <Link
            href="/destinations"
            className="text-sm font-medium text-teal-700 hover:underline"
          >
            View all →
          </Link>
        </div>
        {popular.length === 0 ? (
          <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Destinations are loading shortly — please refresh in a moment.
          </p>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {popular.map((c) => (
              <DestinationCard key={c.iso} c={c} />
            ))}
          </div>
        )}
      </section>

      {/* ----------------------------------------------------- What is an eSIM */}
      <section className="bg-white">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-teal-700">
              <Sparkles className="h-3.5 w-3.5" /> The basics
            </span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-zinc-900">
              What is an eSIM?
            </h2>
            <p className="mt-3 text-zinc-600">
              An eSIM is a digital SIM already built into your phone. Instead of
              hunting for a SIM card at the airport, you scan one QR code and a
              travel data plan installs in seconds — then you keep your usual
              number for calls, mobile money and WhatsApp.
            </p>
            <ul className="mt-5 space-y-3">
              {[
                'No physical SIM card to buy or swap',
                'Installs in under a minute from a QR code',
                'Runs alongside your normal home network line',
                'Switch it on the moment you land',
              ].map((t) => (
                <li key={t} className="flex items-start gap-3 text-zinc-700">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-teal-600 text-white">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
            <Link
              href="/how-it-works"
              className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700 hover:underline"
            >
              See how it works →
            </Link>
          </div>
          {/* illustrative phone card */}
          <div className="relative">
            <div className="mx-auto w-full max-w-sm rounded-3xl border border-zinc-200 bg-gradient-to-br from-teal-50 to-white p-6 shadow-xl shadow-teal-100/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-teal-600 text-white">
                    <Globe2 className="h-5 w-5" />
                  </span>
                  <div className="text-sm font-semibold text-zinc-900">
                    GlobalSimify eSIM
                  </div>
                </div>
                <Wifi className="h-5 w-5 text-teal-600" />
              </div>
              <div className="mt-6 grid place-items-center rounded-2xl bg-white p-6 shadow-inner">
                <QrCode className="h-28 w-28 text-zinc-900" />
              </div>
              <div className="mt-5 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Data</span>
                  <span className="font-medium text-zinc-900">5 GB</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Validity</span>
                  <span className="font-medium text-zinc-900">30 days</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Status</span>
                  <span className="font-medium text-teal-700">
                    Ready to install
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------- Why GlobalSimify */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900">
            Why GlobalSimify?
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-zinc-600">
            Built around how travellers across Africa actually travel and pay —
            fast, local, and with no nasty surprises.
          </p>
        </div>
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {WHY.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="rounded-2xl border border-zinc-200 bg-white p-6 transition hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-lg hover:shadow-teal-100/40"
            >
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-teal-50 text-teal-700">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-semibold text-zinc-900">{title}</h3>
              <p className="mt-1 text-sm text-zinc-600">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ----------------------------------------------------- Testimonials */}
      <Testimonials />

      {/* --------------------------------------------------- Regions available */}
      <section className="bg-gradient-to-b from-zinc-50 to-white">
        <div className="mx-auto w-full max-w-6xl px-4 py-16">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-zinc-900">
                Regions available
              </h2>
              <p className="mt-2 text-zinc-600">
                Single-country, regional, and worldwide plans.
              </p>
            </div>
            <Link
              href="/destinations"
              className="hidden text-sm font-medium text-teal-700 hover:underline sm:block"
            >
              Browse all →
            </Link>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {REGIONS.map((r) => (
              <Link
                key={r.name}
                href="/destinations"
                className="group flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-lg hover:shadow-teal-100/40"
              >
                <span className="text-2xl">{r.emoji}</span>
                <span>
                  <span className="block font-semibold text-zinc-900 group-hover:text-teal-700">
                    {r.name}
                  </span>
                  <span className="block text-xs text-zinc-500">{r.blurb}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* -------------------------------------------------- Buy before you fly */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16">
        <div className="rounded-3xl bg-gradient-to-br from-teal-600 to-emerald-500 p-8 text-white sm:p-12">
          <div className="flex items-center gap-2 text-teal-50">
            <Plane className="h-5 w-5" />
            <span className="text-sm font-semibold uppercase tracking-wide">
              Buy before you fly
            </span>
          </div>
          <h2 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight">
            Three steps and you are connected.
          </h2>
          <ol className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {[
              [
                QrCode,
                'Pick your destination',
                'Search where you are headed and choose a data plan priced in KSh.',
              ],
              [
                CreditCard,
                'Pay with mobile money or card',
                'Confirm the payment on your phone. Your eSIM is created instantly.',
              ],
              [
                Plane,
                'Scan & fly',
                'Scan the QR on home Wi-Fi before you travel. Land already online.',
              ],
            ].map(([Icon, t, d], i) => {
              const StepIcon = Icon as typeof QrCode;
              return (
                <li
                  key={t as string}
                  className="rounded-2xl bg-white/10 p-5 backdrop-blur"
                >
                  <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-white font-bold text-teal-700">
                      {i + 1}
                    </span>
                    <StepIcon className="h-5 w-5 text-teal-50" />
                  </div>
                  <h3 className="mt-3 font-semibold">{t as string}</h3>
                  <p className="mt-1 text-sm text-teal-50/90">{d as string}</p>
                </li>
              );
            })}
          </ol>
          <Link
            href="/destinations"
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 font-semibold text-teal-700 transition hover:bg-teal-50"
          >
            <MapPin className="h-4 w-4" /> Find your destination
          </Link>
        </div>
      </section>

      {/* -------------------------------------------------------------- FAQ */}
      <section className="bg-white">
        <div className="mx-auto w-full max-w-3xl px-4 py-16">
          <h2 className="text-center text-3xl font-bold tracking-tight text-zinc-900">
            Frequently asked questions
          </h2>
          <div className="mt-8 divide-y divide-zinc-200 rounded-2xl border border-zinc-200">
            {FAQ.map(({ q, a }) => (
              <details key={q} className="group p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between font-medium text-zinc-900">
                  {q}
                  <span className="ml-4 text-teal-600 transition group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm text-zinc-600">{a}</p>
              </details>
            ))}
          </div>
          <p className="mt-6 text-center text-sm text-zinc-500">
            Still have a question?{' '}
            <Link
              href="/help"
              className="font-medium text-teal-700 hover:underline"
            >
              Visit the help centre →
            </Link>
          </p>
        </div>
      </section>

      {/* ----------------------------------------------------------- Final CTA */}
      <section className="bg-gradient-to-b from-zinc-50 to-teal-50">
        <div className="mx-auto w-full max-w-3xl px-4 py-16 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900">
            Ready for your trip?
          </h2>
          <p className="mt-3 text-zinc-600">
            Search your destination and get connected in under a minute.
          </p>
          <div className="mt-8 flex justify-center">
            <SearchBar />
          </div>
        </div>
      </section>
    </main>
  );
}
