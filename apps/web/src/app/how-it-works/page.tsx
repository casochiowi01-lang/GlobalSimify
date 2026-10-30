import type { Metadata } from 'next';
import Link from 'next/link';
import { Search, Smartphone, QrCode, Plane } from 'lucide-react';

export const metadata: Metadata = {
  title: 'How it works',
  description:
    'Buy a travel eSIM in three steps: pick your destination, pay with mobile money or card, scan the QR code. Stay connected the moment you land abroad.',
  alternates: { canonical: '/how-it-works' },
};

const steps = [
  {
    icon: Search,
    title: 'Pick your destination',
    body: 'Search where you’re headed and choose a data plan, priced clearly in Kenyan Shillings.',
  },
  {
    icon: Smartphone,
    title: 'Pay with mobile money or card',
    body: 'Enter your number and approve the STK PIN prompt. Your eSIM is created instantly — no paybill typing.',
  },
  {
    icon: QrCode,
    title: 'Scan the QR code',
    body: 'On home Wi-Fi, scan the QR from your dashboard to install the eSIM. Takes under a minute.',
  },
  {
    icon: Plane,
    title: 'Land connected',
    body: 'Switch the eSIM on when you arrive. No roaming bills, no airport SIM queues, no surprises.',
  },
];

export default function HowItWorksPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
        How GlobalSimify works
      </h1>
      <p className="mt-2 text-zinc-600">
        From booked to connected in minutes — here&apos;s the whole journey.
      </p>

      <ol className="mt-8 space-y-4">
        {steps.map((s, i) => (
          <li
            key={s.title}
            className="flex gap-4 rounded-2xl border border-zinc-200 bg-white p-5"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-teal-600 text-white">
              <s.icon className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-semibold text-zinc-900">
                {i + 1}. {s.title}
              </h2>
              <p className="mt-1 text-sm text-zinc-600">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-10 rounded-2xl bg-teal-600 p-6 text-center text-white">
        <h2 className="text-xl font-semibold">Ready to travel connected?</h2>
        <p className="mt-1 text-teal-50">Find a plan for your next trip.</p>
        <Link
          href="/destinations"
          className="mt-4 inline-block rounded-xl bg-white px-5 py-2.5 font-medium text-teal-700 hover:bg-teal-50"
        >
          Browse destinations
        </Link>
      </div>
    </main>
  );
}
