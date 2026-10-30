'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { formatMoney } from '@/lib/format';
import { AdminShell, Kpi, Panel } from '@/components/admin/AdminShell';
import { LineChart, Donut, BarChart } from '@/components/admin/Charts';
import {
  statusTone,
  type AdminDashboard,
  type AnalyticsResponse,
} from '@/lib/admin';

const STATUS_COLORS = [
  '#0d9488',
  '#f59e0b',
  '#ef4444',
  '#a78bfa',
  '#71717a',
  '#22c55e',
];

export default function AdminOverview() {
  const { status, user, authFetch } = useAuth();
  const [data, setData] = useState<AdminDashboard | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    if (status !== 'authed' || user?.role !== 'ADMIN') return;
    Promise.all([
      authFetch<AdminDashboard>('/admin/dashboard'),
      authFetch<AnalyticsResponse>('/admin/analytics?granularity=day'),
    ])
      .then(([d, a]) => {
        setData(d);
        setAnalytics(a);
      })
      .catch(() => setErr(true));
  }, [status, user, authFetch]);

  return (
    <AdminShell title="Overview">
      {!data ? (
        err ? (
          <p className="text-sm text-red-600">Could not load the dashboard.</p>
        ) : (
          <div className="grid place-items-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
          </div>
        )
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Kpi
              label="Revenue"
              value={formatMoney(data.revenue)}
              sub="paid orders"
            />
            <Kpi
              label="Gross profit"
              value={formatMoney(data.grossProfit)}
              sub={`${data.marginPct}% margin`}
              tone="good"
            />
            <Kpi
              label="Supplier cost"
              value={formatMoney(data.cogs)}
              sub="Celitech (postpaid)"
            />
            <Kpi label="Paid orders" value={String(data.paidOrders)} />
            <Kpi label="eSIMs issued" value={String(data.esimsIssued)} />
            <Kpi label="Customers" value={String(data.customers)} />
          </div>

          {analytics && analytics.series.length > 0 && (
            <Panel title="Revenue & profit (last 30 days)">
              <LineChart
                labels={analytics.series.map((p) =>
                  new Date(p.period).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  }),
                )}
                series={[
                  {
                    label: 'Revenue',
                    color: '#0d9488',
                    points: analytics.series.map((p) => p.revenue),
                  },
                  {
                    label: 'Profit',
                    color: '#f59e0b',
                    points: analytics.series.map((p) => p.profit),
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
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Orders by status">
              {data.ordersByStatus.length ? (
                <Donut
                  data={data.ordersByStatus.map((s, i) => ({
                    label: s.status,
                    value: s.count,
                    color: STATUS_COLORS[i % STATUS_COLORS.length],
                  }))}
                />
              ) : (
                <p className="text-sm text-zinc-500">No orders yet.</p>
              )}
            </Panel>

            <Panel title="Top destinations by revenue">
              {data.topDestinations.length ? (
                <BarChart
                  data={data.topDestinations.map((d) => ({
                    label:
                      d.destination.split('·').pop()?.trim() || d.destination,
                    value: Math.round(d.revenue),
                  }))}
                  format={(n) => `$${n}`}
                />
              ) : (
                <p className="text-sm text-zinc-500">No sales yet.</p>
              )}
            </Panel>
          </div>

          <p className="text-xs text-zinc-400">
            Amounts in USD. Profit = sale price − supplier (wholesale) cost.{' '}
            <span
              className={`ml-1 rounded px-1.5 py-0.5 ${statusTone('COMPLETED')}`}
            >
              live
            </span>
          </p>
        </div>
      )}
    </AdminShell>
  );
}
