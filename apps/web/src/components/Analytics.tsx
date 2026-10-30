'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';

/**
 * Privacy-friendly, env-gated analytics.
 *
 * Pick a provider at deploy time (no code change needed):
 *  - Set NEXT_PUBLIC_PLAUSIBLE_DOMAIN to use Plausible (cookieless).
 *  - Else set NEXT_PUBLIC_GA_ID (a GA4 measurement id) to use Google Analytics.
 *  - Set neither (e.g. in dev) and nothing is loaded.
 */
export function Analytics() {
  const pathname = usePathname();
  const plausibleDomain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
  const gaId = process.env.NEXT_PUBLIC_GA_ID;
  if (/^\/(order|account|admin|login|checkout)(\/|$)/.test(pathname))
    return null;

  if (plausibleDomain) {
    return (
      <Script
        defer
        data-domain={plausibleDomain}
        src="https://plausible.io/js/script.js"
        strategy="afterInteractive"
      />
    );
  }

  if (gaId) {
    return (
      <>
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
          strategy="afterInteractive"
        />
        <Script id="ga4-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${gaId}', { anonymize_ip: true });
          `}
        </Script>
      </>
    );
  }

  return null;
}
