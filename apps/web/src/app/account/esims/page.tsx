'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Smartphone } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import type { OrderView } from '@/lib/api';
import { EsimCard } from '@/components/EsimCard';
import { PushOptIn } from '@/components/PushOptIn';

export default function MyEsimsPage() {
  const router = useRouter();
  const { status, user, authFetch } = useAuth();
  const [loaded, setLoaded] = useState<{
    userId: string;
    orders: OrderView[];
  } | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const userId = status === 'authed' ? user?.id : undefined;
  // Only show orders fetched for the signed-in account, never a previous session's.
  const orders = userId && loaded?.userId === userId ? loaded.orders : null;

  useEffect(() => {
    if (status === 'anon') router.replace('/login');
  }, [status, router]);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    authFetch<OrderView[]>('/orders', { cache: 'no-store' })
      .then((value) => {
        if (active) {
          setLoaded({ userId, orders: value });
          setError('');
        }
      })
      .catch(() => {
        if (active)
          setError(
            'We could not load your eSIMs. Your purchases are safe—please try again.',
          );
      });
    return () => {
      active = false;
    };
  }, [userId, authFetch, retry]);

  if (status === 'authed' && error)
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-bold">My eSIMs</h1>
        <p role="alert" className="mt-4 text-red-700">
          {error}
        </p>
        <button
          className="mt-4 rounded-xl bg-teal-700 px-4 py-2 text-white"
          onClick={() => {
            setError('');
            setRetry((n) => n + 1);
          }}
        >
          Try again
        </button>
      </main>
    );

  if (status !== 'authed' || orders === null) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </main>
    );
  }

  const withEsim = orders.flatMap((o) =>
    (o.esims ?? (o.esim ? [o.esim] : [])).map((esim) => ({ ...o, esim })),
  );

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold text-zinc-900">My eSIMs</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Signed in as {user?.email ?? user?.phone}
      </p>
      <nav className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <Link href="/account" className="text-teal-700 hover:underline">
          Account
        </Link>
        <Link href="/account/orders" className="text-teal-700 hover:underline">
          Order history
        </Link>
        <Link href="/account/profile" className="text-teal-700 hover:underline">
          Profile
        </Link>
        {user?.role === 'ADMIN' && (
          <Link
            href="/admin"
            className="font-medium text-zinc-900 hover:underline"
          >
            Admin panel →
          </Link>
        )}
      </nav>

      {withEsim.length === 0 ? (
        <div className="mt-8 grid place-items-center rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center">
          <Smartphone className="h-10 w-10 text-zinc-300" />
          <h2 className="mt-3 font-medium text-zinc-900">No eSIMs yet</h2>
          <p className="mt-1 max-w-sm text-sm text-zinc-500">
            Buy a plan and your eSIM QR code will appear here.
          </p>
          <Link
            href="/destinations"
            className="mt-4 rounded-xl bg-teal-600 px-4 py-2 font-medium text-white hover:bg-teal-700"
          >
            Browse destinations
          </Link>
        </div>
      ) : (
        <div className="mt-8 space-y-5">
          <PushOptIn />
          {withEsim.map((o) => (
            <EsimCard
              key={o.esim.id}
              esim={o.esim}
              title={o.title}
              orderId={o.id}
              showUsage
            />
          ))}
        </div>
      )}
    </main>
  );
}
