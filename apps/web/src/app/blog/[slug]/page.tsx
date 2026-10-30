import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BLOG_POSTS, getPost } from '@/lib/blog';
import { JsonLd } from '@/components/JsonLd';

type Params = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return BLOG_POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  return post
    ? {
        title: post.title,
        description: post.excerpt,
        alternates: { canonical: `/blog/${slug}` },
      }
    : { title: 'Article' };
}

export default async function BlogPostPage({ params }: Params) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  const blogPostingJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt,
    url: `https://globalsimify.com/blog/${slug}`,
    datePublished: post.date,
    author: { '@type': 'Organization', name: 'GlobalSimify' },
    publisher: { '@type': 'Organization', name: 'GlobalSimify' },
  };

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12">
      <JsonLd data={blogPostingJsonLd} />
      <Link href="/blog" className="text-sm text-teal-700 hover:underline">
        ← All guides
      </Link>
      <h1 className="mt-4 text-3xl font-bold tracking-tight text-zinc-900">
        {post.title}
      </h1>
      <span className="mt-1 block text-sm text-zinc-400">
        {new Date(post.date).toLocaleDateString('en-KE')}
      </span>
      <article className="mt-6 space-y-4 leading-relaxed text-zinc-700">
        {post.body.map((para, i) => (
          <p key={i}>{para}</p>
        ))}
      </article>
      <div className="mt-10 rounded-2xl bg-teal-600 p-6 text-center text-white">
        <p className="font-semibold">Ready to travel connected?</p>
        <Link
          href="/destinations"
          className="mt-3 inline-block rounded-xl bg-white px-5 py-2.5 font-medium text-teal-700"
        >
          Browse eSIM plans
        </Link>
      </div>
    </main>
  );
}
