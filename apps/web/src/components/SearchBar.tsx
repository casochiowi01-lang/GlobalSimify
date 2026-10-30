'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Loader2 } from 'lucide-react';
import { api, type SearchResult } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import { Flag } from './Flag';

const NO_RESULTS: SearchResult[] = [];

export function SearchBar({ autoFocus = false }: { autoFocus?: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [found, setFound] = useState<{
    term: string;
    results: SearchResult[];
  } | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  // Results belong to the term they were fetched for; a newer term is loading until its results land.
  const term = q.trim();
  const searchable = term.length >= 2;
  const results =
    searchable && found?.term === term ? found.results : NO_RESULTS;
  const loading = searchable && found?.term !== term;

  // Debounced search.
  useEffect(() => {
    if (!searchable) return;
    const t = setTimeout(async () => {
      try {
        const r = await api.search(term);
        setFound({ term, results: r });
        setOpen(true);
        setActive(0);
      } catch {
        setFound({ term, results: [] });
      }
    }, 200);
    return () => clearTimeout(t);
  }, [term, searchable]);

  // Close on outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  function go(r: SearchResult) {
    router.push(`/destinations/${r.seoSlug}`);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => (a + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => (a - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(results[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div ref={boxRef} className="relative w-full max-w-xl">
      <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3.5 shadow-sm focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-100">
        {loading ? (
          <Loader2 className="h-5 w-5 shrink-0 animate-spin text-zinc-400" />
        ) : (
          <Search className="h-5 w-5 shrink-0 text-zinc-400" />
        )}
        <input
          autoFocus={autoFocus}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => results.length && setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Where are you travelling? e.g. Dubai, UK, Europe"
          className="w-full bg-transparent text-base text-zinc-900 outline-none placeholder:text-zinc-400"
          aria-label="Search destinations"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            open && results.length > 0 ? `${listId}-${active}` : undefined
          }
        />
      </div>

      {open && results.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl"
        >
          {results.map((r, i) => (
            <li
              key={r.iso}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
            >
              <button
                tabIndex={-1}
                onClick={() => go(r)}
                onMouseEnter={() => setActive(i)}
                className={`flex w-full items-center justify-between px-4 py-3 text-left transition ${
                  i === active ? 'bg-teal-50' : 'bg-white'
                }`}
              >
                <span className="flex items-center gap-3">
                  <Flag iso={r.iso} />
                  <span>
                    <span className="block font-medium text-zinc-900">
                      {r.name}
                    </span>
                    <span className="block text-sm text-zinc-500">
                      {r.region}
                    </span>
                  </span>
                </span>
                <span className="text-sm font-medium text-teal-700">
                  from {formatMoney(r.fromPriceKes)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
