import Link from 'next/link';
import { CheckoutForm } from '@/components/CheckoutForm';

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const { plan } = await searchParams;

  if (!plan) {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-16 text-center">
        <p className="text-zinc-600">No plan selected.</p>
        <Link
          href="/destinations"
          className="mt-3 inline-block text-teal-700 hover:underline"
        >
          Browse destinations →
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-md px-4 py-10">
      <h1 className="text-2xl font-bold text-zinc-900">Checkout</h1>
      <p className="mt-1 text-sm text-zinc-500">Secure payment via Paystack.</p>
      <div className="mt-6">
        <CheckoutForm planId={plan} />
      </div>
    </main>
  );
}
