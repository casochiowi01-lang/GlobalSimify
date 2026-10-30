import { OrderStatus } from '@/components/OrderStatus';
import { InstallGuide } from '@/components/InstallGuide';
import type { Metadata } from 'next';
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold text-zinc-900">Your order</h1>
      <div className="mt-6">
        <OrderStatus orderId={id} />
      </div>
      <div className="mt-6">
        <InstallGuide />
      </div>
    </main>
  );
}
