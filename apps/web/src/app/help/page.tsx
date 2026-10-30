'use client';

import { useEffect, useState } from 'react';
import { MessageCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import type { OrderView } from '@/lib/api';

const WHATSAPP = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '254710204662';

const STEPS = [
  'Make sure Data Roaming is ON for your eSIM line (Settings → Cellular/Mobile).',
  'Confirm the eSIM is selected as your Mobile Data line.',
  'Toggle Airplane mode on and off, or restart your phone.',
  'Manually select a network: Settings → Cellular → Network Selection → off → pick one.',
];

export default function HelpPage() {
  const { status, authFetch } = useAuth();
  const [esims, setEsims] = useState<{ id: string; label: string }[]>([]);
  const [esimId, setEsimId] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (status === 'authed') {
      authFetch<OrderView[]>('/orders')
        .then((os) =>
          setEsims(
            os
              .filter((o) => o.esim)
              .map((o) => ({
                id: o.esim!.id,
                label: `${o.title} · ${o.esim!.iccid.slice(-6)}`,
              })),
          ),
        )
        .catch(() => {
          // Optional: the ticket form still works without the eSIM picker.
        });
    }
  }, [status, authFetch]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await authFetch('/tickets', {
        method: 'POST',
        body: JSON.stringify({
          message,
          esimId: esimId || undefined,
          category: 'no_data',
        }),
      });
      setDone(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
        Help &amp; support
      </h1>

      <section className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6">
        <h2 className="font-semibold text-zinc-900">Data not connecting?</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Try these quick fixes first:
        </p>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-zinc-700">
          {STEPS.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </section>

      <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6">
        <h2 className="font-semibold text-zinc-900">
          Still stuck? Send us a ticket
        </h2>
        {done ? (
          <p className="mt-3 flex items-center gap-2 rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-800">
            <CheckCircle2 className="h-4 w-4" /> Ticket submitted — we&apos;ll
            be in touch.
          </p>
        ) : (
          <form onSubmit={submit} className="mt-3 space-y-3">
            {esims.length > 0 && (
              <select
                value={esimId}
                onChange={(e) => setEsimId(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 outline-none focus:border-teal-500"
              >
                <option value="">Which eSIM? (optional)</option>
                {esims.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.label}
                  </option>
                ))}
              </select>
            )}
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              rows={4}
              placeholder="Describe the issue…"
              className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 outline-none focus:border-teal-500"
            />
            <button
              disabled={busy || message.length < 3}
              className="flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-5 py-2.5 font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Submit ticket
            </button>
          </form>
        )}
      </section>

      <a
        href={`https://wa.me/${WHATSAPP}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 flex items-center justify-center gap-2 rounded-2xl bg-green-500 py-3 font-semibold text-white hover:bg-green-600"
      >
        <MessageCircle className="h-5 w-5" /> Chat on WhatsApp
      </a>
    </main>
  );
}
