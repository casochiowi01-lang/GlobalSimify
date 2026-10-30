import type { Metadata } from 'next';
import { CompatibilityChecker } from '@/components/CompatibilityChecker';

export const metadata: Metadata = {
  title: 'Is my phone eSIM-compatible?',
  description:
    'Check if your phone supports eSIM with the *#06# / EID test, and follow step-by-step install instructions for iPhone and Android.',
  alternates: { canonical: '/compatibility' },
};

export default function CompatibilityPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
        Is my phone compatible?
      </h1>
      <p className="mt-2 text-zinc-600">
        Two things matter: your phone must support eSIM, and it must be
        carrier-unlocked. Here&apos;s how to be sure.
      </p>
      <div className="mt-8">
        <CompatibilityChecker />
      </div>
    </main>
  );
}
