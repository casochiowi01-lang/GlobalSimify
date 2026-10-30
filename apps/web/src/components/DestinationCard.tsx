import Link from 'next/link';
import type { Country } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import { Flag } from './Flag';

export function DestinationCard({ c }: { c: Country }) {
  return (
    <Link
      href={`/destinations/${c.seoSlug}`}
      className="group flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md"
    >
      <span className="flex items-center gap-3">
        <Flag iso={c.iso} />
        <span>
          <span className="block font-medium text-zinc-900">{c.name}</span>
          <span className="block text-sm text-zinc-500">{c.region}</span>
        </span>
      </span>
      <span className="text-right">
        <span className="block text-xs text-zinc-400">from</span>
        <span className="block font-semibold text-teal-700">
          {formatMoney(c.fromPriceKes)}
        </span>
      </span>
    </Link>
  );
}
