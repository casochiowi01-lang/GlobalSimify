import { serializeJsonLd } from '@/lib/json-ld';
import { SOCIAL_LINKS } from '@/lib/social';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://globalsimify.com';

/** Renders an arbitrary JSON-LD structured-data block. Server component. */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}

/** Site-wide Organization + WebSite schema for GlobalSimify. */
export function OrganizationJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE}/#organization`,
        name: 'GlobalSimify',
        url: SITE,
        logo: `${SITE}/icons/icon.svg`,
        description:
          'Instant data eSIMs for your trip abroad. Pay with mobile money or card, scan a QR code, and stay connected the moment you land. Built for African travellers.',
        sameAs: Object.values(SOCIAL_LINKS),
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE}/#website`,
        name: 'GlobalSimify',
        url: SITE,
        publisher: { '@id': `${SITE}/#organization` },
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${SITE}/destinations?q={search_term_string}`,
          },
          'query-input': 'required name=search_term_string',
        },
      },
    ],
  };

  return <JsonLd data={data} />;
}
