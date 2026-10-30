'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { QA } from '@/lib/content';

export function Faq({ items }: { items: QA[] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="divide-y divide-zinc-100 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
      {items.map((item, i) => (
        <div key={item.q}>
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
          >
            <span className="font-medium text-zinc-900">{item.q}</span>
            <ChevronDown
              className={`h-5 w-5 shrink-0 text-zinc-400 transition ${open === i ? 'rotate-180' : ''}`}
            />
          </button>
          {open === i && (
            <p className="px-5 pb-4 text-sm leading-relaxed text-zinc-600">
              {item.a}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
