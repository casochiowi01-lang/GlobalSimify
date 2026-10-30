import Link from 'next/link';
import { Compass } from 'lucide-react';

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-20 text-center">
      <Compass className="h-12 w-12 text-teal-600" />
      <h1 className="mt-4 text-3xl font-bold text-zinc-900">Page not found</h1>
      <p className="mt-2 text-zinc-600">
        We couldn&apos;t find that page. Let&apos;s get you back on track.
      </p>
      <div className="mt-6 flex gap-3">
        <Link
          href="/"
          className="rounded-xl bg-teal-600 px-5 py-2.5 font-medium text-white hover:bg-teal-700"
        >
          Go home
        </Link>
        <Link
          href="/destinations"
          className="rounded-xl border border-zinc-300 px-5 py-2.5 font-medium text-zinc-700 hover:border-zinc-400"
        >
          Browse destinations
        </Link>
      </div>
    </main>
  );
}
