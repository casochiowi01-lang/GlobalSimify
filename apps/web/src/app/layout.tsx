import type { Metadata, Viewport } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';
import 'flag-icons/css/flag-icons.min.css';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { Providers } from '@/components/Providers';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';
import { InstallBanner } from '@/components/InstallBanner';
import { WhatsAppFab } from '@/components/WhatsAppFab';
import { AskAi } from '@/components/AskAi';
import { SiteChrome } from '@/components/SiteChrome';
import { Analytics } from '@/components/Analytics';
import { OrganizationJsonLd } from '@/components/JsonLd';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://globalsimify.com';

const TITLE =
  'GlobalSimify - Travel eSIMs for African & Global Travellers Worldwide';
const DESCRIPTION =
  'Instant data eSIMs for your trip abroad. Pay with mobile money or card, scan a QR code, and stay connected the moment you land. Built for African travellers.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: TITLE,
    template: '%s · GlobalSimify',
  },
  description: DESCRIPTION,
  applicationName: 'GlobalSimify',
  openGraph: {
    type: 'website',
    siteName: 'GlobalSimify',
    title: TITLE,
    description: DESCRIPTION,
    url: SITE,
    // og:image is provided by app/opengraph-image.tsx (dynamically rendered).
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    // Twitter falls back to the og:image from opengraph-image.tsx.
  },
};

export const viewport: Viewport = {
  themeColor: '#0d9488',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-zinc-50 text-zinc-900">
        <OrganizationJsonLd />
        <Analytics />
        <Providers>
          <SiteChrome>
            <SiteHeader />
          </SiteChrome>
          <div className="flex flex-1 flex-col">{children}</div>
          <SiteChrome>
            <SiteFooter />
            <InstallBanner />
            <WhatsAppFab />
            <AskAi />
          </SiteChrome>
          <ServiceWorkerRegister />
        </Providers>
      </body>
    </html>
  );
}
