import Link from 'next/link';
import { Wifi, CalendarDays, Globe } from 'lucide-react';
import type { Product } from '@/lib/api';
import { formatMoney } from '@/lib/format';

export function PlanCard({ p }: { p: Product }) {
  return (
    <div className="flex flex-col rounded-2xl border border-zinc-200 bg-white p-5 transition hover:border-teal-300 hover:shadow-md">
      <div className="flex items-baseline justify-between">
        <span className="text-2xl font-semibold text-zinc-900">
          {p.dataLabel}
        </span>
        <span className="text-right">
          <span className="block text-lg font-bold text-teal-700">
            {formatMoney(p.priceKes)}
            {p.unlimited && (
              <span className="text-sm font-medium text-zinc-500">/day</span>
            )}
          </span>
        </span>
      </div>
      <ul className="mt-4 space-y-2 text-sm text-zinc-600">
        <li className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-zinc-400" />
          {p.unlimited
            ? 'Unlimited data · 3–30 days'
            : `${p.minDays ?? 1}–${p.validityDays} travel days`}
        </li>
        <li className="flex items-center gap-2">
          <Wifi className="h-4 w-4 text-zinc-400" />
          {p.speed.join('/')} speeds
        </li>
        {p.coverageCount > 1 && (
          <li className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-zinc-400" />
            {p.coverageCount}+ countries covered
          </li>
        )}
      </ul>
      <Link
        href={`/plan/${encodeURIComponent(p.id)}`}
        className="mt-5 rounded-xl bg-teal-600 px-4 py-2.5 text-center font-medium text-white transition hover:bg-teal-700"
      >
        Choose plan
      </Link>
    </div>
  );
}
