import type { Metadata } from 'next';
import { Faq } from '@/components/Faq';
import { JsonLd } from '@/components/JsonLd';
import { FAQS } from '@/lib/content';

export const metadata: Metadata = {
  title: 'FAQ — travel eSIM questions answered',
  description:
    'How travel eSIMs work, device compatibility, mobile money payment, data validity, and refunds — answered for African travellers.',
  alternates: { canonical: '/faq' },
};

export default function FaqPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
        Frequently asked questions
      </h1>
      <p className="mt-2 text-zinc-600">
        Everything you need to know before buying a travel eSIM.
      </p>
      <div className="mt-8">
        <Faq items={FAQS} />
      </div>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: FAQS.map((f) => ({
            '@type': 'Question',
            name: f.q,
            acceptedAnswer: { '@type': 'Answer', text: f.a },
          })),
        }}
      />
    </main>
  );
}
