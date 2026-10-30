import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Check } from 'lucide-react';
import { api, type CountryWithProducts } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import { PlanCard } from '@/components/PlanCard';
import { Flag } from '@/components/Flag';
import { JsonLd } from '@/components/JsonLd';

type Params = { params: Promise<{ slug: string }> };

async function load(slug: string): Promise<CountryWithProducts | null> {
  try {
    return await api.country(slug);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const c = await load(slug);
  if (!c) return { title: 'Destination' };
  const title = `${c.name} travel eSIM`;
  const description = `Buy a ${c.name} data eSIM across Africa with mobile money or card — instant delivery, from ${formatMoney(c.fromPriceKes)}.`;
  return {
    title,
    description,
    alternates: { canonical: `/destinations/${slug}` },
    openGraph: { title, description },
  };
}

export default async function DestinationPage({ params }: Params) {
  const { slug } = await params;
  const c = await load(slug);
  if (!c) notFound();

  const coverageCount = c.products.reduce(
    (max, p) => Math.max(max, p.coverageCount),
    1,
  );

  const lowestPrice = c.products.reduce(
    (min, p) => Math.min(min, p.priceKes),
    c.products[0]?.priceKes ?? c.fromPriceKes,
  );
  const isMulti = c.scope === 'REGION' || c.scope === 'GLOBAL';
  const coverageNote = isMulti
    ? `Covers ${coverageCount} countries across ${c.region}.`
    : `Coverage on local 4G/5G networks across ${c.name}.`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: `${c.name} travel eSIM`,
    description: `Travel data eSIM for ${c.name} — instant QR delivery, pay with mobile money or card.`,
    brand: { '@type': 'Brand', name: 'GlobalSimify' },
    offers: {
      '@type': 'Offer',
      price: lowestPrice.toFixed(2),
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
    },
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: 'https://globalsimify.com',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Destinations',
        item: 'https://globalsimify.com/destinations',
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: c.name,
        item: `https://globalsimify.com/destinations/${slug}`,
      },
    ],
  };

  const DEST_FAQ: { q: string; a: string }[] = [
    {
      q: `Will my phone work in ${c.name}?`,
      a: 'Most phones from 2019 onward support eSIM. Dial *#06# — if you see an EID number, your device is eSIM-capable and ready to go.',
    },
    {
      q: 'When does my data start counting?',
      a: 'Your plan only starts once you connect to a network abroad. Install on home Wi-Fi before you fly and you land already online.',
    },
    {
      q: 'Can I top up if I run out?',
      a: `Yes. You can top up your ${c.name} eSIM any time from your account — no need to buy a new one.`,
    },
  ];

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <JsonLd data={jsonLd} />
      <JsonLd data={breadcrumbJsonLd} />
      <div className="flex items-center gap-4">
        <Flag iso={c.iso} size="text-4xl" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
            {c.name} eSIM
          </h1>
          <p className="text-zinc-500">
            {c.region}
            {coverageCount > 1 ? ` · ${coverageCount}+ countries` : ''} ·
            instant delivery
          </p>
        </div>
      </div>

      <p className="mt-4 text-zinc-600">
        Stay connected in {c.name} from {formatMoney(c.fromPriceKes)}.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {c.products.map((p) => (
          <PlanCard key={p.id} p={p} />
        ))}
      </div>

      {/* What's included */}
      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <h2 className="font-semibold text-zinc-900">What&apos;s included</h2>
          <ul className="mt-3 space-y-2 text-sm text-zinc-700">
            {[
              'Fast 4G/5G data',
              'Keep your number for calls & WhatsApp',
              'Instant QR delivery by email',
              'Pay with mobile money or card',
            ].map((t) => (
              <li key={t} className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
                {t}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <h2 className="font-semibold text-zinc-900">Coverage</h2>
          <p className="mt-3 text-sm text-zinc-600">{coverageNote}</p>
        </div>
      </div>

      {/* Destination FAQ */}
      <div className="mt-10">
        <h2 className="text-lg font-semibold text-zinc-900">
          {c.name} eSIM — common questions
        </h2>
        <div className="mt-3 divide-y divide-zinc-200 rounded-2xl border border-zinc-200">
          {DEST_FAQ.map(({ q, a }) => (
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
      </div>

      <div className="mt-10 rounded-2xl border border-zinc-200 bg-white p-5 text-sm text-zinc-600">
        <h2 className="font-medium text-zinc-900">Before you buy</h2>
        <p className="mt-1">
          Your phone must be <strong>eSIM-capable and carrier-unlocked</strong>.
          Dial <code>*#06#</code> — if you see an <strong>EID</strong> number,
          your device supports eSIM.{' '}
          <Link href="/compatibility" className="text-teal-700 hover:underline">
            Full compatibility guide →
          </Link>
        </p>
      </div>
    </main>
  );
}
