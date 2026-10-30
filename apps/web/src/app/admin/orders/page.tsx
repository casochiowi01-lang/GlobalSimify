'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { formatMoney } from '@/lib/format';
import { AdminShell, Panel } from '@/components/admin/AdminShell';
import { statusTone, type AdminOrder } from '@/lib/admin';

const STATUS_OPTIONS = [
  'COMPLETED',
  'PROVISIONED',
  'PAID',
  'PROVISIONING',
  'AWAITING_PAYMENT',
  'PAYMENT_FAILED',
  'PROVISION_FAILED',
  'REFUNDED',
  'MANUAL_REVIEW',
  'CANCELLED',
];

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${statusTone(status)}`}
    >
      {status}
    </span>
  );
}

export default function AdminOrders() {
  const { status, user, authFetch } = useAuth();
  const [result, setResult] = useState<{
    filter: string;
    rows: AdminOrder[];
  } | null>(null);
  const [err, setErr] = useState(false);
  const [filter, setFilter] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  // Rows belong to the filter they were fetched for; a new filter shows the loader until its rows arrive.
  const rows = result?.filter === filter ? result.rows : null;

  const load = useCallback(() => {
    if (status !== 'authed' || user?.role !== 'ADMIN') return;
    const qs = filter ? `?status=${encodeURIComponent(filter)}` : '';
    authFetch<AdminOrder[]>(`/admin/orders${qs}`)
      .then((list) => {
        setResult({ filter, rows: list });
        setErr(false);
      })
      .catch(() => setErr(true));
  }, [status, user, authFetch, filter]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <AdminShell title="Orders">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <label className="text-sm text-zinc-500">Status</label>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-900 focus:border-teal-500 focus:outline-none"
          >
            <option value="">All</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <Panel>
          {!rows ? (
            err ? (
              <p className="text-sm text-red-600">Could not load orders.</p>
            ) : (
              <div className="grid place-items-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
              </div>
            )
          ) : rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-zinc-500">
              No orders found.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500">
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium">Title</th>
                    <th className="px-3 py-2 font-medium">Customer</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 text-right font-medium">
                      Revenue
                    </th>
                    <th className="px-3 py-2 text-right font-medium">Profit</th>
                    <th className="px-3 py-2 font-medium">Method</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((o) => (
                    <OrderRow
                      key={o.id}
                      order={o}
                      open={openId === o.id}
                      onToggle={() => setOpenId(openId === o.id ? null : o.id)}
                      onChanged={load}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </AdminShell>
  );
}

function OrderRow({
  order,
  open,
  onToggle,
  onChanged,
}: {
  order: AdminOrder;
  open: boolean;
  onToggle: () => void;
  onChanged: () => void;
}) {
  const customer =
    order.customerEmail || order.customerPhone || order.customerName || '—';
  return (
    <>
      <tr className="border-b border-zinc-100 hover:bg-zinc-50">
        <td className="px-3 py-2.5 whitespace-nowrap text-zinc-600">
          {new Date(order.createdAt).toLocaleDateString()}
        </td>
        <td className="px-3 py-2.5 font-medium text-zinc-900">{order.title}</td>
        <td className="px-3 py-2.5 text-zinc-600">{customer}</td>
        <td className="px-3 py-2.5">
          <StatusBadge status={order.status} />
        </td>
        <td className="px-3 py-2.5 text-right text-zinc-900">
          {formatMoney(order.revenue)}
        </td>
        <td className="px-3 py-2.5 text-right font-medium text-teal-700">
          {formatMoney(order.profit)}
        </td>
        <td className="px-3 py-2.5 text-zinc-600">
          {order.payment?.method ?? '—'}
        </td>
        <td className="px-3 py-2.5 text-right">
          <button
            onClick={onToggle}
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
          >
            {open ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
            Actions
          </button>
        </td>
      </tr>
      {open && (
        <tr className="border-b border-zinc-100 bg-zinc-50">
          <td colSpan={8} className="px-3 py-4">
            <OrderDetail order={order} onChanged={onChanged} />
          </td>
        </tr>
      )}
    </>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-zinc-400">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-zinc-800">{value}</dd>
    </div>
  );
}

function OrderDetail({
  order,
  onChanged,
}: {
  order: AdminOrder;
  onChanged: () => void;
}) {
  const { authFetch } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(
    null,
  );
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const run = useCallback(
    async (action: string, path: string, init?: RequestInit) => {
      setBusy(action);
      setResult(null);
      try {
        await authFetch(path, { method: 'POST', ...init });
        setResult({ ok: true, msg: 'Done.' });
        onChanged();
      } catch {
        setResult({ ok: false, msg: 'Request failed.' });
      } finally {
        setBusy(null);
      }
    },
    [authFetch, onChanged],
  );

  const customer =
    order.customerEmail || order.customerPhone || order.customerName || '—';

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
        <Field
          label="Order ID"
          value={
            <span className="break-all font-mono text-xs">{order.id}</span>
          }
        />
        <Field label="Kind" value={order.kind} />
        <Field label="Status" value={<StatusBadge status={order.status} />} />
        <Field label="Customer" value={customer} />
        <Field label="Revenue" value={formatMoney(order.revenue)} />
        <Field label="Supplier cost" value={formatMoney(order.cogs)} />
        <Field
          label="Profit"
          value={
            <span className="font-medium text-teal-700">
              {formatMoney(order.profit)}
            </span>
          }
        />
        <Field label="Promo code" value={order.promoCode ?? '—'} />
        {order.failureReason && (
          <Field
            label="Failure reason"
            value={<span className="text-red-600">{order.failureReason}</span>}
          />
        )}
        {order.esim?.iccid && (
          <Field
            label="eSIM ICCID"
            value={
              <span className="font-mono text-xs">{order.esim.iccid}</span>
            }
          />
        )}
      </dl>

      <div className="flex flex-wrap items-center gap-2">
        <ActionButton
          label="Retry provisioning"
          busy={busy === 'retry'}
          disabled={busy !== null}
          onClick={() => run('retry', `/admin/orders/${order.id}/retry`)}
        />
        <ActionButton
          label="Refund"
          tone="danger"
          busy={busy === 'refund'}
          disabled={busy !== null}
          onClick={() => {
            if (window.confirm('Refund this order? This cannot be undone.')) {
              run('refund', `/admin/orders/${order.id}/refund`);
            }
          }}
        />
        <ActionButton
          label="Resend eSIM"
          busy={busy === 'resend'}
          disabled={busy !== null}
          onClick={() => run('resend', `/admin/orders/${order.id}/resend`)}
        />
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-white p-3">
        <div>
          <label className="block text-xs font-medium text-zinc-500">
            Start date
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1 rounded-lg border border-zinc-200 px-2 py-1 text-sm focus:border-teal-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500">
            End date
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="mt-1 rounded-lg border border-zinc-200 px-2 py-1 text-sm focus:border-teal-500 focus:outline-none"
          />
        </div>
        <ActionButton
          label="Reschedule dates"
          busy={busy === 'reschedule'}
          disabled={busy !== null || !startDate || !endDate}
          onClick={() =>
            run('reschedule', `/admin/orders/${order.id}/reschedule`, {
              body: JSON.stringify({ startDate, endDate }),
            })
          }
        />
      </div>

      {result && (
        <p
          className={`text-sm ${result.ok ? 'text-teal-700' : 'text-red-600'}`}
        >
          {result.msg}
        </p>
      )}
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  busy,
  disabled,
  tone = 'default',
}: {
  label: string;
  onClick: () => void;
  busy: boolean;
  disabled: boolean;
  tone?: 'default' | 'danger';
}) {
  const cls =
    tone === 'danger'
      ? 'border-red-200 text-red-700 hover:bg-red-50'
      : 'border-zinc-200 text-zinc-700 hover:bg-zinc-100';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition disabled:opacity-50 ${cls}`}
    >
      {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {label}
    </button>
  );
}
