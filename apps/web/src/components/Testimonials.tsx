import { ShieldCheck, Zap, Wifi, Headphones } from 'lucide-react';

// Publish customer testimonials only after obtaining real feedback and consent.
const BENEFITS: { title: string; description: string }[] = [
  {
    title: 'Plan before you travel',
    description:
      'Browse destinations and choose a data plan for your travel dates.',
  },
  {
    title: 'Know your checkout total',
    description:
      'Review your USD trip total and the exact KES payment amount before paying.',
  },
  {
    title: 'Keep your home number',
    description:
      'Use your travel eSIM for data on a compatible unlocked phone. Home-line charges depend on your provider.',
  },
  {
    title: 'Manage your eSIM online',
    description:
      'Sign in to find your purchased eSIMs, check usage and review available paid top-up plans.',
  },
];

const BADGES: { icon: typeof Zap; label: string }[] = [
  { icon: ShieldCheck, label: 'Secured by Paystack' },
  { icon: Zap, label: 'Digital eSIM delivery' },
  { icon: Wifi, label: 'Coverage varies by plan' },
  { icon: Headphones, label: 'WhatsApp support' },
];

export function Testimonials() {
  return (
    <section className="bg-white">
      <div className="mx-auto w-full max-w-6xl px-4 py-16">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900">
            Built for your next trip
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-zinc-600">
            Choose your plan, review the price and manage your connectivity in
            one place.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {BENEFITS.map((t) => (
            <article
              key={t.title}
              className="flex flex-col rounded-2xl border border-zinc-200 bg-white p-6"
            >
              <h3 className="text-sm font-semibold text-zinc-900">{t.title}</h3>
              <p className="mt-3 flex-1 text-zinc-700">{t.description}</p>
            </article>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-zinc-600">
          {BADGES.map(({ icon: Icon, label }) => (
            <span key={label} className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-teal-600" />
              {label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
