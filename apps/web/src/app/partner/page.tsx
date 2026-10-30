'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Users, TrendingUp, Wallet } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { formatMoney } from '@/lib/format';

interface Stats {
  partner: {
    name: string;
    slug: string;
    status: string;
    commissionPct: number;
  };
  conversions: number;
  payableKes: number;
  paidKes: number;
  totalKes: number;
  referralLink: string;
}

export default function PartnerDashboard() {
  const router = useRouter();
  const { status, authFetch } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(
    () =>
      authFetch<Stats>('/partner/stats').then(setStats, () =>
        setError('No partner account linked to this login.'),
      ),
    [authFetch],
  );

  useEffect(() => {
    if (status === 'anon') router.replace('/login');
    if (status === 'authed') load();
  }, [status, router, load]);

  async function payout() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await authFetch<{ requestedKes: number; status: string }>(
        '/partner/payout',
        { method: 'POST' },
      );
      setMsg(
        `Payout of ${formatMoney(r.requestedKes)} requested — we'll send it to your mobile money shortly.`,
      );
      await load();
    } catch {
      setMsg(
        'Payout failed â€” minimum is KES 500 and a mobile money number is required.',
      );
    } finally {
      setBusy(false);
    }
  }

  if (status !== 'authed') {
    return (
      <main className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto w-full max-w-lg px-4 py-16 text-center text-zinc-600">
        {error}
      </main>
    );
  }
  if (!stats) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </main>
    );
  }

  const link = `globalsimify.com${stats.referralLink}`;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold text-zinc-900">{stats.partner.name}</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Partner dashboard Â· {Math.round(stats.partner.commissionPct * 100)}%
        commission Â·{' '}
        <span className="capitalize">{stats.partner.status.toLowerCase()}</span>
      </p>

      <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5">
        <span className="text-sm text-zinc-500">Your referral link</span>
        <code className="mt-1 block rounded-lg bg-zinc-50 px-3 py-2 text-sm">
          {link}
        </code>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat
          icon={TrendingUp}
          label="Conversions"
          value={String(stats.conversions)}
        />
        <Stat
          icon={Wallet}
          label="Payable"
          value={formatMoney(stats.payableKes)}
        />
        <Stat
          icon={Users}
          label="Paid out"
          value={formatMoney(stats.paidKes)}
        />
      </div>

      {msg && (
        <p className="mt-4 rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-800">
          {msg}
        </p>
      )}

      <button
        onClick={payout}
        disabled={busy || stats.payableKes < 500}
        className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-5 py-3 font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        Request payout to mobile money
      </button>
      {stats.payableKes < 500 && (
        <p className="mt-1 text-xs text-zinc-400">Minimum payout is KES 500.</p>
      )}
    </main>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5">
      <Icon className="h-5 w-5 text-teal-600" />
      <p className="mt-2 text-sm text-zinc-500">{label}</p>
      <p className="text-2xl font-bold text-zinc-900">{value}</p>
    </div>
  );
}
