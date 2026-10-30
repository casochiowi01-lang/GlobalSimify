import Link from 'next/link';
import { WifiOff } from 'lucide-react';

export const metadata = { title: 'Offline' };

export default function OfflinePage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-20 text-center">
      <WifiOff className="h-12 w-12 text-zinc-400" />
      <h1 className="mt-4 text-2xl font-bold text-zinc-900">
        You&apos;re offline
      </h1>
      <p className="mt-2 text-zinc-600">
        No internet connection right now. Your already-opened eSIM QR codes stay
        available in <strong>My eSIMs</strong> even offline.
      </p>
      <Link
        href="/account/esims"
        className="mt-6 rounded-xl bg-teal-600 px-5 py-2.5 font-medium text-white hover:bg-teal-700"
      >
        Open My eSIMs
      </Link>
    </main>
  );
}
