'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <div>
      <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">
        {label}
      </span>
      <button
        onClick={copy}
        className="mt-1 flex w-full items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-left transition hover:bg-zinc-100"
      >
        <code className="truncate text-sm text-zinc-800">{value}</code>
        {copied ? (
          <Check className="h-4 w-4 shrink-0 text-teal-600" />
        ) : (
          <Copy className="h-4 w-4 shrink-0 text-zinc-400" />
        )}
      </button>
    </div>
  );
}
