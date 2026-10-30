'use client';

import { useState } from 'react';
import { Copy, Check, Gift } from 'lucide-react';
import { useAuth } from '@/lib/auth';

export function ReferralCard() {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  if (!user) return null;

  const link = `https://globalsimify.com/r/${user.id}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-teal-600 text-white">
          <Gift className="h-5 w-5" />
        </span>
        <h3 className="font-semibold text-zinc-900">Refer a friend</h3>
      </div>
      <p className="mt-3 text-sm text-zinc-600">
        Share this link — friends who buy through it support you.
      </p>
      <button
        onClick={copy}
        className="mt-3 flex w-full items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-left transition hover:bg-zinc-100"
      >
        <code className="truncate text-sm text-zinc-800">{link}</code>
        {copied ? (
          <Check className="h-4 w-4 shrink-0 text-teal-600" />
        ) : (
          <Copy className="h-4 w-4 shrink-0 text-zinc-400" />
        )}
      </button>
    </div>
  );
}
