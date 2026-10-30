import type { MetadataRoute } from 'next';
import { api } from '@/lib/api';
import { BLOG_POSTS } from '@/lib/blog';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://globalsimify.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes = [
    '',
    '/about',
    '/destinations',
    '/how-it-works',
    '/compatibility',
    '/faq',
    '/blog',
    '/partners',
    '/legal/terms',
    '/legal/privacy',
    '/legal/refunds',
  ].map((p) => ({
    url: `${SITE}${p}`,
    changeFrequency: 'weekly' as const,
    priority: p === '' ? 1 : 0.7,
  }));

  let destinations: MetadataRoute.Sitemap = [];
  try {
    const countries = await api.countries();
    destinations = countries.map((c) => ({
      url: `${SITE}/destinations/${c.seoSlug}`,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }));
  } catch {
    /* API offline at build — ship static routes only */
  }

  const posts = BLOG_POSTS.map((p) => ({
    url: `${SITE}/blog/${p.slug}`,
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  return [...staticRoutes, ...destinations, ...posts];
}
