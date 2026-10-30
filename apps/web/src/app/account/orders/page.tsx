'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Receipt } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import type { OrderStatus, OrderView } from '@/lib/api';
import { formatMoney } from '@/lib/format';

const STATUS_BADGE: Record<OrderStatus, { label: string; className: string }> =
  {
    DRAFT: { label: 'Draft', className: 'bg-zinc-100 text-zinc-600' },
    AWAITING_PAYMENT: {
      label: 'Awaiting payment',
      className: 'bg-amber-100 text-amber-700',
    },
    PAID: { label: 'Paid', className: 'bg-amber-100 text-amber-700' },
    PROVISIONING: {
      label: 'Provisioning',
      className: 'bg-amber-100 text-amber-700',
    },
    PROVISIONED: {
      label: 'Provisioned',
      className: 'bg-green-100 text-green-700',
    },
    COMPLETED: { label: 'Completed', className: 'bg-green-100 text-green-700' },
    PAYMENT_FAILED: {
      label: 'Payment failed',
      className: 'bg-red-100 text-red-700',
    },
    PROVISION_FAILED: {
      label: 'Provision failed',
      className: 'bg-red-100 text-red-700',
    },
    CANCELLED: { label: 'Cancelled', className: 'bg-red-100 text-red-700' },
    REFUND_PENDING: {
      label: 'Refund pending',
      className: 'bg-zinc-100 text-zinc-600',
    },
    REFUNDED: { label: 'Refunded', className: 'bg-zinc-100 text-zinc-600' },
    MANUAL_REVIEW: {
      label: 'Manual review',
      className: 'bg-amber-100 text-amber-700',
    },
  };

function StatusBadge({ status }: { status: OrderStatus }) {
  const badge = STATUS_BADGE[status] ?? {
    label: status,
    className: 'bg-zinc-100 text-zinc-600',
  };
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}
    >
      {badge.label}
    </span>
  );
}

const dateFmt = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

export default function OrderHistoryPage() {
  const router = useRouter();
  const { status, authFetch } = useAuth();
  const [orders, setOrders] = useState<OrderView[] | null>(null);

  useEffect(() => {
    if (status === 'anon') router.replace('/login');
  }, [status, router]);

  useEffect(() => {
    if (status === 'authed') {
      authFetch<OrderView[]>('/orders')
        .then(setOrders)
        .catch(() => setOrders([]));
    }
  }, [status, authFetch]);

  if (status !== 'authed' || orders === null) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold text-zinc-900">Order history</h1>
      <p className="mt-1 text-sm text-zinc-500">
        All your orders, newest first.
      </p>

      {orders.length === 0 ? (
        <div className="mt-8 grid place-items-center rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center">
          <Receipt className="h-10 w-10 text-zinc-300" />
          <h2 className="mt-3 font-medium text-zinc-900">No orders yet</h2>
          <p className="mt-1 max-w-sm text-sm text-zinc-500">
            When you buy a plan, your orders will show up here.
          </p>
          <Link
            href="/destinations"
            className="mt-4 rounded-xl bg-teal-600 px-4 py-2 font-medium text-white hover:bg-teal-700"
          >
            Browse destinations
          </Link>
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {orders.map((o) => (
            <li key={o.id}>
              <Link
                href={`/order/${o.id}`}
                className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white p-4 transition hover:border-teal-300 hover:bg-zinc-50"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-zinc-900">
                    {o.title}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {dateFmt.format(new Date(o.createdAt))}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <StatusBadge status={o.status} />
                  <span className="text-sm font-semibold text-zinc-900">
                    {formatMoney(o.totalKes)}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
