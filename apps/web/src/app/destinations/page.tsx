import type { Metadata } from 'next';
import Link from 'next/link';
import { SearchX } from 'lucide-react';
import { api } from '@/lib/api';
import { SearchBar } from '@/components/SearchBar';
import { DestinationCard } from '@/components/DestinationCard';
import { Flag } from '@/components/Flag';
import { formatMoney } from '@/lib/format';

type SearchParams = Promise<{ q?: string }>;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const { q } = await searchParams;
  if (q?.trim()) {
    return {
      title: `Search results for "${q}"`,
      description: `Travel eSIM data plans matching "${q}".`,
      // Search-result pages are near-duplicates of /destinations — point
      // Google at the canonical browse page instead of indexing every query.
      alternates: { canonical: '/destinations' },
      robots: { index: false, follow: true },
    };
  }
  return {
    title: 'All destinations',
    description: 'Browse travel eSIM data plans for every destination.',
    alternates: { canonical: '/destinations' },
  };
}

export default async function DestinationsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { q } = await searchParams;
  const query = q?.trim();

  // ── Search mode: powers the sitelinks search box (/destinations?q=...) ──
  if (query) {
    let results = [] as Awaited<ReturnType<typeof api.search>>;
    try {
      results = await api.search(query);
    } catch {
      /* API offline */
    }

    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-10">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
          Search results for &ldquo;{query}&rdquo;
        </h1>
        <div className="mt-6">
          <SearchBar />
        </div>

        {results.length === 0 ? (
          <div className="mt-14 flex flex-col items-center text-center">
            <SearchX className="h-10 w-10 text-zinc-300" />
            <p className="mt-3 text-zinc-500">
              No destinations match &ldquo;{query}&rdquo;.
            </p>
            <Link
              href="/destinations"
              className="mt-4 text-teal-700 hover:underline"
            >
              Browse all destinations →
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((r) => (
              <Link
                key={r.iso}
                href={`/destinations/${r.seoSlug}`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-4 transition hover:border-teal-300 hover:bg-zinc-50"
              >
                <span className="flex items-center gap-3">
                  <Flag iso={r.iso} />
                  <span>
                    <span className="block font-medium text-zinc-900">
                      {r.name}
                    </span>
                    <span className="block text-sm text-zinc-500">
                      {r.region}
                    </span>
                  </span>
                </span>
                <span className="text-sm font-medium text-teal-700">
                  from {formatMoney(r.fromPriceKes)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </main>
    );
  }

  // ── Browse mode: all destinations grouped by region ──
  let countries = [] as Awaited<ReturnType<typeof api.countries>>;
  try {
    countries = await api.countries();
  } catch {
    /* API offline */
  }

  const byRegion = new Map<string, typeof countries>();
  for (const c of countries) {
    const list = byRegion.get(c.region) ?? [];
    list.push(c);
    byRegion.set(c.region, list);
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
        Where are you travelling?
      </h1>
      <div className="mt-6">
        <SearchBar />
      </div>

      {[...byRegion.entries()].map(([region, list]) => (
        <section key={region} className="mt-10">
          <h2 className="text-lg font-semibold text-zinc-700">{region}</h2>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((c) => (
              <DestinationCard key={c.iso} c={c} />
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
