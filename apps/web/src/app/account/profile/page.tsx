'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Check, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/lib/auth';

export default function ProfilePage() {
  const router = useRouter();
  const { status, user, authFetch, reloadMe } = useAuth();

  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'anon') router.replace('/login?next=/account/profile');
  }, [status, router]);

  // Seed the form whenever a new user object loads (adjusting state during render, not in an effect).
  const [seededFrom, setSeededFrom] = useState<typeof user>(null);
  if (user && user !== seededFrom) {
    setSeededFrom(user);
    setName(user.name ?? '');
  }

  if (status !== 'authed') {
    return (
      <main className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </main>
    );
  }

  const dirty = name.trim() !== (user?.name ?? '');

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await authFetch('/users/me', {
        method: 'PATCH',
        body: JSON.stringify({ name: name.trim() }),
      });
      await reloadMe();
      setSaved(true);
    } catch {
      setError('Could not save your details. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-lg px-4 py-10">
      <Link
        href="/account"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900"
      >
        <ArrowLeft className="h-4 w-4" /> Account
      </Link>
      <h1 className="text-2xl font-bold text-zinc-900">
        Profile &amp; details
      </h1>
      <p className="mt-1 text-sm text-zinc-500">Update how we address you.</p>

      <form
        onSubmit={save}
        className="mt-6 space-y-4 rounded-2xl border border-zinc-200 bg-white p-6"
      >
        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-700">
            Full name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="w-full rounded-xl border border-zinc-200 px-3.5 py-3 text-[15px] outline-none focus:border-teal-500"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-700">
            Email
          </label>
          <input
            value={user?.email ?? ''}
            disabled
            className="w-full rounded-xl border border-zinc-100 bg-zinc-50 px-3.5 py-3 text-[15px] text-zinc-500"
          />
          <p className="mt-1 text-xs text-zinc-400">
            Your sign-in email. Your eSIMs and receipts are tied to it.
          </p>
        </div>

        {user?.phone && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700">
              Phone
            </label>
            <input
              value={user.phone}
              disabled
              className="w-full rounded-xl border border-zinc-100 bg-zinc-50 px-3.5 py-3 text-[15px] text-zinc-500"
            />
          </div>
        )}

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!dirty || busy}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 py-3 font-semibold text-white transition hover:bg-teal-700 disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : saved ? (
            <Check className="h-4 w-4" />
          ) : null}
          {saved ? 'Saved' : 'Save changes'}
        </button>
      </form>
    </main>
  );
}
