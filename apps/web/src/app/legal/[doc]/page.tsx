import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LEGAL } from '@/lib/legal';

type Params = { params: Promise<{ doc: string }> };

export function generateStaticParams() {
  return Object.keys(LEGAL).map((doc) => ({ doc }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { doc } = await params;
  const d = LEGAL[doc];
  return d
    ? {
        title: d.title,
        description: d.intro,
        alternates: { canonical: `/legal/${doc}` },
      }
    : { title: 'Legal', alternates: { canonical: `/legal/${doc}` } };
}

export default async function LegalPage({ params }: Params) {
  const { doc } = await params;
  const d = LEGAL[doc];
  if (!d) notFound();

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
        {d.title}
      </h1>
      <p className="mt-1 text-sm text-zinc-400">
        Last updated {new Date(d.updated).toLocaleDateString('en-KE')}
      </p>
      <p className="mt-4 text-zinc-600">{d.intro}</p>
      <div className="mt-8 space-y-6">
        {d.sections.map((s) => (
          <section key={s.heading}>
            <h2 className="font-semibold text-zinc-900">{s.heading}</h2>
            <p className="mt-1 text-sm leading-relaxed text-zinc-600">
              {s.body}
            </p>
          </section>
        ))}
      </div>
    </main>
  );
}
