'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import type { UsageDto } from '@/lib/api';

export function UsageBar({ esimId }: { esimId: string }) {
  const { authFetch } = useAuth();
  const [usage, setUsage] = useState<UsageDto | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchUsage = useCallback(
    () =>
      authFetch<UsageDto>(`/esims/${esimId}/usage`).then(setUsage, () => {
        /* keep the last known usage */
      }),
    [authFetch, esimId],
  );

  useEffect(() => {
    void fetchUsage();
  }, [fetchUsage]);

  // Manual refresh shows the spinner; the initial load uses the skeleton instead.
  async function load() {
    setLoading(true);
    await fetchUsage();
    setLoading(false);
  }

  if (!usage) {
    return <div className="h-14 animate-pulse rounded-xl bg-zinc-100" />;
  }

  const pct = usage.pctUsed;
  const barColor =
    pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-teal-500';

  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-zinc-900">
          {usage.remainingLabel} of {usage.totalLabel} left
        </span>
        <button
          onClick={load}
          className="flex items-center gap-1 text-zinc-400 hover:text-zinc-700"
          aria-label="Refresh usage"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-zinc-100">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-xs text-zinc-500">
        <span>{pct}% used</span>
        {usage.daysLeft !== null && <span>{usage.daysLeft} days left</span>}
      </div>
    </div>
  );
}
