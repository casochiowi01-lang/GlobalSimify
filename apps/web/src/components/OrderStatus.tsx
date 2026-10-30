'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import type { OrderView } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { EsimCard } from './EsimCard';

const TERMINAL = [
  'COMPLETED',
  'PROVISIONED',
  'REFUNDED',
  'MANUAL_REVIEW',
  'PAYMENT_FAILED',
  'PROVISION_FAILED',
  'CANCELLED',
];
export function OrderStatus({ orderId }: { orderId: string }) {
  const { status, authFetch } = useAuth();
  const [order, setOrder] = useState<OrderView | null>(null);
  const [error, setError] = useState('');
  const [orderToken, setOrderToken] = useState('');
  useEffect(() => {
    if (status === 'loading') return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const url = new URL(window.location.href);
    const key = 'order-access:' + orderId;
    const fragment = new URLSearchParams(url.hash.slice(1));
    const token =
      fragment.get('access') ||
      url.searchParams.get('access') ||
      sessionStorage.getItem(key) ||
      '';
    if (token) sessionStorage.setItem(key, token);
    if (url.searchParams.has('access') || fragment.has('access')) {
      url.searchParams.delete('access');
      fragment.delete('access');
      url.hash = fragment.toString();
      window.history.replaceState(
        null,
        '',
        url.pathname + url.search + url.hash,
      );
    }
    async function poll() {
      try {
        const o = await authFetch<OrderView>('/orders/' + orderId, {
          cache: 'no-store',
          headers: token ? { 'x-order-token': token } : {},
        });
        if (stop) return;
        setOrder(o);
        setOrderToken(token);
        setError('');
        if (TERMINAL.includes(o.status)) return;
      } catch (e) {
        if (stop) return;
        setError(
          e instanceof Error &&
            (e.message.startsWith('404') || e.message.startsWith('401'))
            ? 'Sign in with your purchase email to view this order, or reopen the private confirmation link.'
            : 'Unable to refresh this order. Reconnecting…',
        );
        if (
          e instanceof Error &&
          (e.message.startsWith('404') || e.message.startsWith('401'))
        )
          return;
      }
      if (!stop) timer = setTimeout(poll, 3000);
    }
    void poll();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [orderId, status, authFetch]);

  const esims = order?.esims ?? (order?.esim ? [order.esim] : []);
  const done = order && ['COMPLETED', 'PROVISIONED'].includes(order.status);
  const review = order?.status === 'MANUAL_REVIEW';
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6">
        <h2 className="font-semibold text-zinc-900">
          {!order
            ? 'Loading your order'
            : done
              ? order.kind === 'TOPUP'
                ? 'Top-up applied'
                : 'Your eSIMs are ready'
              : review
                ? 'Your order needs a delivery review'
                : order.status === 'REFUNDED'
                  ? 'Refund completed'
                  : order.status === 'PAYMENT_FAILED'
                    ? 'Payment was not completed'
                    : order.status === 'CANCELLED'
                      ? 'Order cancelled'
                      : order.status === 'REFUND_PENDING'
                        ? 'Refund processing'
                        : order.status === 'AWAITING_PAYMENT' ||
                            order.status === 'DRAFT'
                          ? 'Checking your payment'
                          : 'Preparing your eSIMs'}
        </h2>
        {!done && !error && (!order || !TERMINAL.includes(order.status)) && (
          <Loader2 className="mt-3 h-5 w-5 animate-spin" />
        )}
        {review && (
          <p className="mt-2 text-sm text-amber-800">
            Your payment may already be complete. Please do not pay again.
            Support will reconcile the supplier delivery using order {order?.id}
            .
          </p>
        )}
        {order && ['PAID', 'PROVISIONING'].includes(order.status) && (
          <p className="mt-2 text-sm">
            Payment confirmed. Your{' '}
            {order.kind === 'TOPUP'
              ? 'top-up is being applied'
              : 'eSIM is being prepared'}
            . This page updates automatically—please do not pay again.
          </p>
        )}
        {done && order?.kind === 'TOPUP' && (
          <p className="mt-2 text-sm">
            Data has been added to eSIM ending {order.targetIccid?.slice(-6)}.
            Open My eSIMs to refresh its usage and validity.
          </p>
        )}
        {esims.length > 0 && (
          <p className="mt-2 text-sm">
            {esims.length} of {order?.quantity ?? 1} eSIMs delivered. Keep the
            activation codes private.
          </p>
        )}
        {error && (
          <p role="alert" className="mt-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <p className="mt-3 text-xs text-zinc-500">Order reference: {orderId}</p>
      </div>
      {esims.map((e) => (
        <EsimCard
          key={e.id}
          esim={e}
          title={order?.title}
          orderId={orderId}
          orderToken={orderToken}
          showUsage={status === 'authed'}
        />
      ))}
      <Link
        href="/account/esims"
        className="block rounded-xl bg-zinc-900 py-3 text-center font-medium text-white"
      >
        {status === 'authed'
          ? 'View my eSIMs'
          : 'Sign in with your purchase email'}
      </Link>
    </div>
  );
}
