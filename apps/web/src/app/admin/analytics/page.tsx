'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { formatMoney } from '@/lib/format';
import { AdminShell, Kpi, Panel } from '@/components/admin/AdminShell';
import { LineChart, BarChart } from '@/components/admin/Charts';
import type { AnalyticsResponse } from '@/lib/admin';

type Granularity = 'day' | 'week' | 'month';

const GRANULARITIES: { value: Granularity; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

const RANGES = [
  { days: 7, label: 'Last 7' },
  { days: 30, label: 'Last 30' },
  { days: 90, label: 'Last 90' },
];

function formatPeriod(period: string, granularity: Granularity): string {
  const d = new Date(period);
  if (Number.isNaN(d.getTime())) return period;
  if (granularity === 'month') {
    return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function AdminAnalytics() {
  const { status, user, authFetch } = useAuth();
  const [granularity, setGranularity] = useState<Granularity>('day');
  const [rangeDays, setRangeDays] = useState(30);
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  // Which range the last response (or failure) belongs to; a new range is loading until it settles.
  const [settled, setSettled] = useState<{
    query: string;
    failed: boolean;
  } | null>(null);
  const query = `${granularity}:${rangeDays}`;
  const loading = settled?.query !== query;
  const err = settled?.query === query && settled.failed;

  const load = useCallback(() => {
    const requested = `${granularity}:${rangeDays}`;
    const to = new Date();
    const from = new Date(to.getTime() - rangeDays * 24 * 60 * 60 * 1000);
    const qs = new URLSearchParams({
      granularity,
      from: from.toISOString(),
      to: to.toISOString(),
    });
    authFetch<AnalyticsResponse>(`/admin/analytics?${qs.toString()}`)
      .then((d) => {
        setData(d);
        setSettled({ query: requested, failed: false });
      })
      .catch(() => setSettled({ query: requested, failed: true }));
  }, [authFetch, granularity, rangeDays]);

  useEffect(() => {
    if (status !== 'authed' || user?.role !== 'ADMIN') return;
    load();
  }, [status, user, authFetch, load]);

  const totals = useMemo(() => {
    const series = data?.series ?? [];
    const revenue = series.reduce((s, p) => s + p.revenue, 0);
    const cogs = series.reduce((s, p) => s + p.cogs, 0);
    const profit = series.reduce((s, p) => s + p.profit, 0);
    const orders = series.reduce((s, p) => s + p.orders, 0);
    const marginPct = revenue > 0 ? (profit / revenue) * 100 : 0;
    return { revenue, cogs, profit, orders, marginPct };
  }, [data]);

  const btnCls = (active: boolean) =>
    `rounded-lg px-3 py-1.5 text-sm font-medium transition ${
      active
        ? 'bg-teal-600 text-white'
        : 'bg-white text-zinc-600 border border-zinc-300 hover:bg-zinc-50'
    }`;

  const hasData = (data?.series.length ?? 0) > 0;

  return (
    <AdminShell title="Sales & analytics">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Group by
            </span>
            {GRANULARITIES.map((g) => (
              <button
                key={g.value}
                onClick={() => setGranularity(g.value)}
                className={btnCls(granularity === g.value)}
              >
                {g.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Range
            </span>
            {RANGES.map((r) => (
              <button
                key={r.days}
                onClick={() => setRangeDays(r.days)}
                className={btnCls(rangeDays === r.days)}
              >
                {r.label} days
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid place-items-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
          </div>
        ) : err ? (
          <p className="text-sm text-red-600">Could not load analytics.</p>
        ) : !hasData ? (
          <Panel>
            <p className="py-10 text-center text-sm text-zinc-500">
              No sales in this range yet.
            </p>
          </Panel>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
              <Kpi label="Total revenue" value={formatMoney(totals.revenue)} />
              <Kpi
                label="Total profit"
                value={formatMoney(totals.profit)}
                tone="good"
              />
              <Kpi label="Total COGS" value={formatMoney(totals.cogs)} />
              <Kpi
                label="Margin"
                value={`${totals.marginPct.toFixed(1)}%`}
                tone="good"
              />
              <Kpi label="Orders" value={String(totals.orders)} />
            </div>

            <Panel title="Revenue & profit">
              <LineChart
                labels={data!.series.map((p) =>
                  formatPeriod(p.period, granularity),
                )}
                series={[
                  {
                    label: 'Revenue',
                    color: '#0d9488',
                    points: data!.series.map((p) => p.revenue),
                  },
                  {
                    label: 'Profit',
                    color: '#f59e0b',
                    points: data!.series.map((p) => p.profit),
                  },
                ]}
                format={(n) => `$${n}`}
              />
              <div className="mt-2 flex gap-5 text-xs text-zinc-500">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-teal-600" />{' '}
                  Revenue
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" />{' '}
                  Profit
                </span>
              </div>
            </Panel>

            <Panel title="Profit per period">
              <BarChart
                data={data!.series.map((p) => ({
                  label: formatPeriod(p.period, granularity),
                  value: Math.round(p.profit),
                }))}
                format={(n) => `$${n}`}
              />
            </Panel>
          </>
        )}
      </div>
    </AdminShell>
  );
}
