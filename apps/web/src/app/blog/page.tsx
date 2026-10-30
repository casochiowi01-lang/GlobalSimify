import type { Metadata } from 'next';
import Link from 'next/link';
import { BLOG_POSTS } from '@/lib/blog';

export const metadata: Metadata = {
  title: 'Travel eSIM guides & tips',
  description:
    'Guides for Kenyan travellers: choosing a travel eSIM, avoiding roaming bills, device compatibility, and setup.',
  alternates: { canonical: '/blog' },
};

export default function BlogPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
        Travel eSIM guides
      </h1>
      <p className="mt-2 text-zinc-600">
        Tips to stay connected abroad, the smart way.
      </p>
      <div className="mt-8 space-y-4">
        {BLOG_POSTS.map((p) => (
          <Link
            key={p.slug}
            href={`/blog/${p.slug}`}
            className="block rounded-2xl border border-zinc-200 bg-white p-5 transition hover:border-teal-300 hover:shadow-md"
          >
            <span className="text-xs text-zinc-400">
              {new Date(p.date).toLocaleDateString('en-KE')}
            </span>
            <h2 className="mt-1 text-lg font-semibold text-zinc-900">
              {p.title}
            </h2>
            <p className="mt-1 text-sm text-zinc-600">{p.excerpt}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
