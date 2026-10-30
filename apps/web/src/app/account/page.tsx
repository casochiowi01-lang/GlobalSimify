'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Loader2,
  Smartphone,
  Receipt,
  LogOut,
  ChevronRight,
  UserCog,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { ReferralCard } from '@/components/ReferralCard';

export default function AccountHubPage() {
  const router = useRouter();
  const { status, user, logout } = useAuth();

  useEffect(() => {
    if (status === 'anon') router.replace('/login');
  }, [status, router]);

  if (status !== 'authed') {
    return (
      <main className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </main>
    );
  }

  async function handleLogout() {
    await logout();
    router.replace('/');
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold text-zinc-900">Your account</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Signed in as {user?.email ?? user?.phone}
      </p>

      <div className="mt-8 space-y-3">
        <Link
          href="/account/esims"
          className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white p-4 transition hover:border-teal-300 hover:bg-zinc-50"
        >
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-teal-50 text-teal-600">
              <Smartphone className="h-5 w-5" />
            </span>
            <span className="font-medium text-zinc-900">My eSIMs</span>
          </div>
          <ChevronRight className="h-5 w-5 text-zinc-400" />
        </Link>

        <Link
          href="/account/orders"
          className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white p-4 transition hover:border-teal-300 hover:bg-zinc-50"
        >
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-teal-50 text-teal-600">
              <Receipt className="h-5 w-5" />
            </span>
            <span className="font-medium text-zinc-900">Order history</span>
          </div>
          <ChevronRight className="h-5 w-5 text-zinc-400" />
        </Link>

        <Link
          href="/account/profile"
          className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white p-4 transition hover:border-teal-300 hover:bg-zinc-50"
        >
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-teal-50 text-teal-600">
              <UserCog className="h-5 w-5" />
            </span>
            <span className="font-medium text-zinc-900">
              Profile &amp; details
            </span>
          </div>
          <ChevronRight className="h-5 w-5 text-zinc-400" />
        </Link>

        {user?.role === 'ADMIN' && (
          <Link
            href="/admin"
            className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-900 bg-zinc-900 p-4 text-white transition hover:bg-zinc-800"
          >
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/10">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <span className="font-medium">Admin panel</span>
            </div>
            <ChevronRight className="h-5 w-5 text-white/60" />
          </Link>
        )}
      </div>

      <div className="mt-6">
        <ReferralCard />
      </div>

      <button
        onClick={handleLogout}
        className="mt-6 flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
      >
        <LogOut className="h-4 w-4" />
        Log out
      </button>
    </main>
  );
}
