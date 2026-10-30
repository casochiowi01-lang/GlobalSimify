'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Inline email-OTP login used inside the purchase widget's top-up tab, so a
 * customer can sign in without leaving the page. On success the auth context
 * flips to `authed` and the parent widget re-renders to show the eSIM picker.
 */
export function TopUpLogin() {
  const { requestEmailOtp, verifyEmailOtp } = useAuth();
  const [phase, setPhase] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [resent, setResent] = useState(false);

  const emailOk = EMAIL_RE.test(email.trim());

  // Tick the resend cooldown down to zero.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function send(isResend = false) {
    setBusy(true);
    setError(null);
    if (isResend) setResent(false);
    try {
      const res = await requestEmailOtp(email.trim().toLowerCase());
      setDevCode(res.devCode ?? null);
      setPhase('code');
      setCooldown(30);
      if (isResend) setResent(true);
    } catch (e) {
      setError((e as Error).message || 'Could not send the code.');
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    setError(null);
    try {
      // On success the auth context updates to authed; the widget re-renders.
      await verifyEmailOtp(email.trim().toLowerCase(), code.trim());
    } catch (e) {
      setError((e as Error).message || 'Invalid or expired code.');
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-teal-100 bg-teal-50/60 p-4">
      <p className="text-sm font-medium text-teal-900">
        Log in to top up your eSIM
      </p>
      <p className="mt-0.5 text-xs text-teal-700">
        Use the email you bought with — we’ll send a one-time code.
      </p>

      {phase === 'email' ? (
        <div className="mt-3 space-y-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && emailOk && !busy && send()}
            placeholder="you@example.com"
            className="w-full rounded-xl border border-zinc-200 px-3.5 py-3 text-base outline-none focus:border-teal-500 sm:text-[15px]"
          />
          <button
            onClick={() => send()}
            disabled={!emailOk || busy}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 py-3 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Send code
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <input
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) =>
              e.key === 'Enter' && code.trim().length >= 4 && !busy && verify()
            }
            placeholder="Enter the code we emailed you"
            className="w-full rounded-xl border border-zinc-200 px-3.5 py-3 text-base tracking-widest outline-none focus:border-teal-500 sm:text-[15px]"
          />
          {devCode && (
            <p className="text-xs text-zinc-500">
              Dev code: <span className="font-mono">{devCode}</span>
            </p>
          )}
          <button
            onClick={verify}
            disabled={code.trim().length < 4 || busy}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 py-3 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Verify &amp;
            continue
          </button>
          {resent && (
            <p className="text-xs text-teal-700">A new code is on its way.</p>
          )}
          <div className="flex items-center justify-between">
            <button
              onClick={() => send(true)}
              disabled={cooldown > 0 || busy}
              className="text-xs font-medium text-teal-700 hover:underline disabled:text-zinc-400 disabled:no-underline"
            >
              {cooldown > 0
                ? `Resend in ${cooldown}s`
                : "Didn't get it? Resend"}
            </button>
            <button
              onClick={() => {
                setPhase('email');
                setError(null);
                setCode('');
              }}
              className="text-xs text-zinc-500 hover:text-zinc-800"
            >
              Use a different email
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
