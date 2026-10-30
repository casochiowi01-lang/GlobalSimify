import type { NextConfig } from 'next';

/**
 * Sent on every response. The CSP only restricts framing, plugins and <base>
 * so it cannot break third-party sign-in or checkout; script and style
 * sources are governed by the framework.
 */
const SECURITY_HEADERS = [
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains',
  },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
  },
  {
    key: 'Content-Security-Policy',
    value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
  },
];

/** Pages with personal data: never cached, indexed or leaked via Referer. */
const PRIVATE_PATHS = ['/order/:path*', '/account/:path*', '/admin/:path*'];

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle (.next/standalone) for lean
  // containers — used by the Docker image deployed to Cloud Run.
  output: 'standalone',
  poweredByHeader: false,
  async headers() {
    // When rules overlap, later ones win, so private-page rules come last.
    return [
      { source: '/:path*', headers: SECURITY_HEADERS },
      ...PRIVATE_PATHS.map((source) => ({
        source,
        headers: [
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'Cache-Control', value: 'private, no-store' },
        ],
      })),
    ];
  },

  // SEO: consolidate to a single canonical host. www.globalsimify.com is
  // mapped in Cloud Run (for SSL) purely so this redirect can fire — it never
  // serves content itself, avoiding a duplicate-host signal.
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.globalsimify.com' }],
        destination: 'https://globalsimify.com/:path*',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
