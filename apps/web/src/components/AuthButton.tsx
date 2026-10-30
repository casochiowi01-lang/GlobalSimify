'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth';

export function AuthButton() {
  const { status, user, logout } = useAuth();

  if (status === 'loading') {
    return <span className="h-9 w-20 animate-pulse rounded-lg bg-zinc-100" />;
  }

  if (status === 'authed') {
    return (
      <span className="flex items-center gap-3">
        <Link
          href="/account/esims"
          className="rounded-lg bg-zinc-900 px-3.5 py-2 text-white hover:bg-zinc-700"
        >
          My eSIMs
        </Link>
        <button
          onClick={() => logout()}
          className="hidden text-zinc-500 hover:text-zinc-900 sm:block"
          title={user?.phone ?? 'Log out'}
        >
          Log out
        </button>
      </span>
    );
  }

  return (
    <Link
      href="/login"
      className="rounded-lg bg-teal-600 px-3.5 py-2 text-white hover:bg-teal-700"
    >
      Log in
    </Link>
  );
}
