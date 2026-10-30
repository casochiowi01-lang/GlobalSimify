'use client';

import { useState } from 'react';
import { Loader2, Handshake } from 'lucide-react';
import { API_BASE } from '@/lib/api';

export default function PartnersPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mpesa, setMpesa] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ slug: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/partners/apply`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, email, mpesaNumber: mpesa }),
      });
      setResult(await res.json());
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-lg px-4 py-12">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-teal-600 text-white">
          <Handshake className="h-6 w-6" />
        </span>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
          Become a partner
        </h1>
      </div>
      <p className="mt-3 text-zinc-600">
        Travel agencies earn commission on every eSIM sold through your referral
        link. Sign up, share your link, and get paid to mobile money.
      </p>

      {result ? (
        <div className="mt-8 rounded-2xl border border-teal-200 bg-teal-50 p-6">
          <h2 className="font-semibold text-teal-900">
            Application received! 🎉
          </h2>
          <p className="mt-2 text-sm text-teal-800">
            Once approved, your referral link will be:
          </p>
          <code className="mt-2 block rounded-lg bg-white px-3 py-2 text-sm">
            globalsimify.com/r/{result.slug}
          </code>
          <p className="mt-3 text-sm text-teal-800">
            We&apos;ll be in touch to activate your account.
          </p>
        </div>
      ) : (
        <form
          onSubmit={submit}
          className="mt-8 space-y-4 rounded-2xl border border-zinc-200 bg-white p-6"
        >
          <Field label="Agency name" value={name} onChange={setName} required />
          <Field label="Email" value={email} onChange={setEmail} type="email" />
          <Field
            label="Mobile money number (for payouts)"
            value={mpesa}
            onChange={setMpesa}
          />
          <button
            disabled={busy || name.length < 2}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 py-3 font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Apply to partner
          </button>
        </form>
      )}
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-zinc-700">{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2.5 outline-none focus:border-teal-500"
      />
    </label>
  );
}
