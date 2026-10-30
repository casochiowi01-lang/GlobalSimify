'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Loader2, Search, X } from 'lucide-react';
import { api, type Country } from '@/lib/api';
import { formatMoney } from '@/lib/format';

const POPULAR_LIMIT = 15;
const SEARCH_DEBOUNCE_MS = 300;

/** Searchable destination dropdown: popular countries by default, debounced search as you type. */
export function DestinationPicker({
  destination,
  onSelect,
}: {
  destination: Country | null;
  onSelect: (country: Country) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Country[]>([]);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .countries()
      .then((countries) => setResults(countries.slice(0, POPULAR_LIMIT)))
      .catch(() => {
        // Optional: search still works without the popular-destination shortcuts.
      });
  }, []);

  useEffect(() => {
    const term = search.trim();
    if (!term) return;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const found = await api.search(term);
        setResults(
          found.map((r) => ({
            iso: r.iso,
            name: r.name,
            region: r.region,
            flagEmoji: r.flagEmoji,
            seoSlug: r.seoSlug,
            scope: 'COUNTRY' as const,
            popularRank: null,
            fromPriceKes: r.fromPriceKes,
            productCount: 0,
          })),
        );
      } catch {
        // Keep the previous results; the customer can retype.
      } finally {
        setLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    function closeOnOutsideClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, []);

  function choose(country: Country) {
    onSelect(country);
    setSearch('');
    setOpen(false);
  }

  return (
    <div className="relative" ref={rootRef}>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-600">
        Destination
      </label>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-xl border border-zinc-200 px-3.5 py-3 text-[15px] hover:border-teal-400"
      >
        {destination ? (
          <span>
            {destination.flagEmoji} {destination.name}
          </span>
        ) : (
          <span className="text-zinc-400">Select destination…</span>
        )}
        <ChevronDown className="h-4 w-4 text-zinc-400" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl">
          <div className="flex items-center gap-2 border-b border-zinc-100 px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-zinc-400" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search countries…"
              className="min-w-0 flex-1 text-base outline-none sm:text-sm"
            />
            {search && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearch('')}
              >
                <X className="h-3.5 w-3.5 text-zinc-400" />
              </button>
            )}
          </div>
          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
            </div>
          ) : (
            <ul className="max-h-52 overflow-y-auto py-1">
              {results.map((c) => (
                <li
                  key={c.iso}
                  onClick={() => choose(c)}
                  className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-teal-50"
                >
                  <span>{c.flagEmoji}</span>
                  <span className="font-medium">{c.name}</span>
                  {c.fromPriceKes > 0 && (
                    <span className="ml-auto text-xs text-zinc-400">
                      from {formatMoney(c.fromPriceKes)}
                    </span>
                  )}
                </li>
              ))}
              {!results.length && (
                <li className="px-3 py-3 text-center text-sm text-zinc-400">
                  No results
                </li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
