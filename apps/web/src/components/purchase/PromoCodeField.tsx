'use client';

import { useState } from 'react';

/** Collapsible promo-code entry. The parent owns the applied code and its validation message. */
export function PromoCodeField({
  message,
  accepted,
  onApply,
}: {
  message: string | null;
  accepted: boolean;
  onApply: (code: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-sm text-teal-700 hover:underline"
      >
        I have a promo code
      </button>
      {open && (
        <div className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="PROMO CODE"
            aria-label="Promo code"
            className="min-w-0 flex-1 rounded-lg border border-zinc-200 px-3 py-3 text-base uppercase outline-none focus:border-teal-500 sm:py-2 sm:text-sm"
          />
          <button
            type="button"
            onClick={() => onApply(code.trim().toUpperCase())}
            className="shrink-0 rounded-lg bg-zinc-900 px-4 py-3 text-sm font-medium text-white hover:bg-zinc-700 sm:py-2"
          >
            Apply
          </button>
        </div>
      )}
      {message && (
        <p className={`text-xs ${accepted ? 'text-teal-700' : 'text-red-600'}`}>
          {message}
        </p>
      )}
    </>
  );
}
