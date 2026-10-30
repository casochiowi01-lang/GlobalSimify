import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  CalendarDays,
  Wifi,
  Globe,
  Check,
  Zap,
  ShieldCheck,
  Phone,
} from 'lucide-react';
import { api, type Product } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import { Flag } from '@/components/Flag';
import { Faq } from '@/components/Faq';
import { FAQS } from '@/lib/content';
import { JsonLd } from '@/components/JsonLd';

type Params = { params: Promise<{ id: string }> };

async function load(id: string): Promise<Product | null> {
  try {
    return await api.product(decodeURIComponent(id));
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const p = await load(id);
  if (!p) return { title: 'Plan' };
  return {
    title: `${p.dataLabel} · ${p.destName} eSIM`,
    alternates: { canonical: `/plan/${id}` },
  };
}

export default async function PlanPage({ params }: Params) {
  const { id } = await params;
  const p = await load(id);
  if (!p) notFound();

  const features = [
    `${p.dataLabel} of high-speed data`,
    `Valid for ${p.validityDays} days from first use`,
    `${p.speed.join('/')} network speeds`,
    p.coverageCount > 1
      ? `Works across ${p.coverageCount}+ countries`
      : 'Local network coverage',
    'Instant QR delivery — set up in minutes',
  ];

  const planUrl = `https://globalsimify.com/plan/${encodeURIComponent(p.id)}`;
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
        name: p.destName,
        item: `https://globalsimify.com/destinations/${p.destSlug}`,
      },
      {
        '@type': 'ListItem',
        position: 4,
        name: p.title,
        item: planUrl,
      },
    ],
  };

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <JsonLd data={breadcrumbJsonLd} />
      <Link
        href={`/destinations/${p.destSlug}`}
        className="text-sm text-teal-700 hover:underline"
      >
        ← Back to {p.destName}
      </Link>

      <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="flex items-center gap-3">
          <Flag iso={p.destIso} size="text-2xl" />
          <h1 className="text-2xl font-bold text-zinc-900">
            {p.destName} · {p.dataLabel}
          </h1>
        </div>
        <div className="mt-2 flex flex-wrap gap-4 text-sm text-zinc-600">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4 text-zinc-400" /> {p.validityDays}{' '}
            days
          </span>
          <span className="flex items-center gap-1.5">
            <Wifi className="h-4 w-4 text-zinc-400" /> {p.speed.join('/')}
          </span>
          {p.coverageCount > 1 && (
            <span className="flex items-center gap-1.5">
              <Globe className="h-4 w-4 text-zinc-400" /> {p.coverageCount}+
              countries
            </span>
          )}
        </div>

        <ul className="mt-6 space-y-2">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-2 text-zinc-700">
              <Check className="mt-0.5 h-5 w-5 shrink-0 text-teal-600" />
              <span>{f}</span>
            </li>
          ))}
        </ul>

        <div className="mt-8 flex items-center justify-between border-t border-zinc-100 pt-6">
          <div>
            <span className="block text-sm text-zinc-400">Total</span>
            <span className="text-3xl font-bold text-zinc-900">
              {formatMoney(p.priceKes)}
            </span>
          </div>
          <Link
            href={`/checkout?plan=${encodeURIComponent(p.id)}`}
            className="rounded-xl bg-teal-600 px-6 py-3 font-semibold text-white transition hover:bg-teal-700"
          >
            Buy now
          </Link>
        </div>

        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-zinc-500">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-teal-600" /> Pay with
            mobile money or card
          </span>
          <span className="flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-teal-600" /> Instant delivery
          </span>
          <span className="flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5 text-teal-600" /> No roaming bills
          </span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 text-center text-xs text-zinc-600">
        <div className="rounded-xl border border-zinc-200 bg-white p-3">
          <Zap className="mx-auto h-5 w-5 text-teal-600" />
          <p className="mt-1">Instant delivery</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-3">
          <ShieldCheck className="mx-auto h-5 w-5 text-teal-600" />
          <p className="mt-1">Pay with mobile money</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-3">
          <Phone className="mx-auto h-5 w-5 text-teal-600" />
          <p className="mt-1">Keep your number</p>
        </div>
      </div>

      <div className="mt-6">
        <Link
          href="/compatibility"
          className="text-sm text-teal-700 hover:underline"
        >
          Not sure if your phone works? Check compatibility →
        </Link>
      </div>

      <h2 className="mt-10 text-lg font-semibold text-zinc-900">
        Good to know
      </h2>
      <div className="mt-3">
        <Faq items={FAQS.slice(0, 5)} />
      </div>
    </main>
  );
}
