'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, Mail } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { postLoginPath } from '@/lib/redirects';
import { GoogleSignInButton } from '@/components/GoogleSignInButton';
import { AppleSignInButton } from '@/components/AppleSignInButton';

export default function LoginPage() {
  const router = useRouter();
  const { status, user, requestEmailOtp, verifyEmailOtp } = useAuth();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [resent, setResent] = useState(false);

  // Redirect once authed AND the user profile has loaded (so role is known).
  useEffect(() => {
    if (status === 'authed' && user)
      router.replace(postLoginPath(window.location.search, user.role));
  }, [status, user, router]);

  // Tick the resend cooldown down to zero.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function onRequest(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { devCode } = await requestEmailOtp(email);
      setDevCode(devCode ?? null);
      setStep('code');
      setCooldown(30);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onResend() {
    if (cooldown > 0 || busy) return;
    setBusy(true);
    setError(null);
    setResent(false);
    try {
      const { devCode } = await requestEmailOtp(email);
      setDevCode(devCode ?? null);
      setCooldown(30);
      setResent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await verifyEmailOtp(email, code);
      // The redirect effect fires once the profile loads (role known).
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-16">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-zinc-900">
          {step === 'email' ? 'Log in or sign up' : 'Enter your code'}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {step === 'email'
            ? 'We will email you a 6-digit code. No password needed.'
            : `Sent to ${email}.`}
        </p>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        {step === 'email' ? (
          <form onSubmit={onRequest} className="mt-5 space-y-4">
            <div className="flex items-center gap-2 rounded-xl border border-zinc-200 px-3 py-3 focus-within:border-teal-500">
              <Mail className="h-5 w-5 text-zinc-400" />
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                inputMode="email"
                placeholder="you@example.com"
                className="w-full outline-none"
                autoFocus
              />
            </div>
            <button
              disabled={busy || !email.includes('@')}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 py-3 font-semibold text-white transition hover:bg-teal-700 disabled:opacity-50"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Send code
            </button>
          </form>
        ) : (
          <form onSubmit={onVerify} className="mt-5 space-y-4">
            {devCode && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Dev mode - your code is <strong>{devCode}</strong>
              </p>
            )}
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              inputMode="numeric"
              maxLength={6}
              placeholder="------"
              className="w-full rounded-xl border border-zinc-200 px-3 py-3 text-center text-2xl tracking-[0.5em] outline-none focus:border-teal-500"
              autoFocus
            />
            <button
              disabled={busy || code.length !== 6}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 py-3 font-semibold text-white transition hover:bg-teal-700 disabled:opacity-50"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Verify & continue
            </button>
            {resent && (
              <p className="text-center text-xs text-teal-700">
                A new code is on its way.
              </p>
            )}
            <button
              type="button"
              onClick={onResend}
              disabled={cooldown > 0 || busy}
              className="w-full text-sm font-medium text-teal-700 hover:underline disabled:text-zinc-400 disabled:no-underline"
            >
              {cooldown > 0
                ? `Resend code in ${cooldown}s`
                : "Didn't get it? Resend code"}
            </button>
            <button
              type="button"
              onClick={() => setStep('email')}
              className="w-full text-sm text-zinc-500 hover:text-zinc-900"
            >
              Use a different email
            </button>
          </form>
        )}

        <GoogleSignInButton />
        <AppleSignInButton />

        <p className="mt-4 text-center text-xs text-zinc-400">
          By continuing you agree to our{' '}
          <Link href="/legal/terms" className="underline">
            Terms
          </Link>{' '}
          and{' '}
          <Link href="/legal/privacy" className="underline">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
