import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  Check,
  Cloud,
  CreditCard,
  ExternalLink,
  Globe2,
  Layers3,
  MapPin,
  MessageCircle,
  QrCode,
  Smartphone,
} from 'lucide-react';
import { JsonLd } from '@/components/JsonLd';
import { SOCIAL_LINKS } from '@/lib/social';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://globalsimify.com';
const TITLE = 'About us';
const DESCRIPTION =
  'Meet GlobalSimify: travel data eSIMs for African and global travellers. Explore our services, country and regional plans, technology and social channels.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/about' },
  openGraph: {
    title: `${TITLE} · GlobalSimify`,
    description: DESCRIPTION,
    url: '/about',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${TITLE} · GlobalSimify`,
    description: DESCRIPTION,
  },
};

const SERVICES = [
  {
    icon: QrCode,
    title: 'Your travel connection, digitally delivered',
    text: 'Choose a destination, travel dates and data plan. Once payment is verified and your eSIM is issued, find the installation QR code on your order page and in your email, with image and PDF download options.',
  },
  {
    icon: Smartphone,
    title: 'Your eSIMs, in one place',
    text: 'Sign in with the email used at checkout to find your purchased eSIMs, installation details and available usage information. Add an eligible top-up when you need more data, without buying another eSIM.',
  },
  {
    icon: MessageCircle,
    title: 'Help choosing and getting connected',
    text: 'Explore our setup guides and compatibility checker, or ask the website assistant about available plans. If you need more help with an order or installation, reach our support team through the help page.',
  },
];

const PLAN_TYPES = [
  {
    icon: MapPin,
    title: 'Country plans',
    text: 'A focused choice when your trip takes you to one destination. Compare the available data allowances and validity periods for that country.',
  },
  {
    icon: Layers3,
    title: 'Regional plans',
    text: 'Useful for multi-stop journeys. One plan covers the countries specifically listed in that regional bundle—not necessarily every country in the region.',
  },
  {
    icon: Globe2,
    title: 'Global plans',
    text: 'Explore available multi-region coverage for wider itineraries. Check the included destinations to make sure every stop on your trip is covered.',
  },
];

const SOCIALS = [
  {
    name: 'Instagram',
    handle: '@globalsimify',
    href: SOCIAL_LINKS.instagram,
    image: '/social/instagram-globalsimify.jpeg',
    width: 832,
    height: 824,
    alt: 'GlobalSimify Instagram QR code and @globalsimify handle',
    description:
      'Follow our travel and connectivity updates. Tap the image or scan the QR code to visit our profile.',
  },
  {
    name: 'X / Twitter',
    handle: '@GlobalSimify',
    href: SOCIAL_LINKS.x,
    image: '/social/x-logo.svg',
    width: 1200,
    height: 1227,
    alt: 'X logo',
    description:
      'Follow GlobalSimify on X for news and updates from the brand.',
  },
  {
    name: 'TikTok',
    handle: '@globalsimify',
    href: SOCIAL_LINKS.tiktok,
    image: '/social/tiktok-logo.png',
    width: 1200,
    height: 1200,
    alt: 'TikTok logo',
    description:
      'Find GlobalSimify on TikTok and stay connected with our travel community.',
  },
];

const button =
  'inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-600';

export default function AboutPage() {
  return (
    <main>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'AboutPage',
          '@id': `${SITE}/about#webpage`,
          url: `${SITE}/about`,
          name: 'About GlobalSimify',
          description: DESCRIPTION,
          about: { '@id': `${SITE}/#organization` },
          isPartOf: { '@id': `${SITE}/#website` },
        }}
      />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: SITE },
            {
              '@type': 'ListItem',
              position: 2,
              name: 'About us',
              item: `${SITE}/about`,
            },
          ],
        }}
      />

      <section className="border-b border-teal-100 bg-teal-50/70">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:py-16 lg:grid-cols-[1.4fr_1fr] lg:items-center lg:gap-16">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">
              About GlobalSimify
            </p>
            <h1 className="mt-4 max-w-2xl text-4xl font-semibold leading-tight tracking-tight text-zinc-900 sm:text-5xl">
              More of your trip.
              <br />
              Less worry about staying connected.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-zinc-600">
              We help African and global travellers find and manage mobile data
              for their journeys abroad—without shopping for a physical SIM at
              every destination.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/destinations"
                className={`${button} bg-teal-700 text-white hover:bg-teal-800`}
              >
                Explore our plans{' '}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href="/how-it-works"
                className={`${button} border border-teal-200 bg-white text-teal-800 hover:bg-teal-50`}
              >
                How it works
              </Link>
            </div>
          </div>
          <div className="rounded-3xl border border-teal-100 bg-white p-7 sm:p-8">
            <span className="inline-flex rounded-2xl bg-teal-50 p-3 text-teal-700">
              <Globe2 className="h-8 w-8" aria-hidden="true" />
            </span>
            <h2 className="mt-5 text-xl font-semibold text-zinc-900">
              An African brand. A global outlook.
            </h2>
            <p className="mt-3 leading-relaxed text-zinc-600">
              GlobalSimify is a brand of Entrix Corporate Solutions. Our focus
              is simple: make choosing, purchasing and managing travel
              connectivity easier, wherever your journey begins.
            </p>
            <p className="mt-4 leading-relaxed text-zinc-600">
              We resell travel data eSIM plans supplied through CELITECH,
              bringing destination discovery, checkout and eSIM management
              together under the GlobalSimify brand.
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-16 px-4 py-14 sm:space-y-20 sm:py-20">
        <section aria-labelledby="services-heading">
          <p className="text-xs font-semibold uppercase tracking-widest text-teal-700">
            What we offer
          </p>
          <h2
            id="services-heading"
            className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900"
          >
            From planning your trip to staying online.
          </h2>
          <div className="mt-7 grid gap-5 md:grid-cols-3">
            {SERVICES.map(({ icon: Icon, title, text }) => (
              <article
                key={title}
                className="rounded-2xl border border-zinc-200 bg-white p-6"
              >
                <Icon className="h-6 w-6 text-teal-700" aria-hidden="true" />
                <h3 className="mt-4 text-lg font-semibold text-zinc-900">
                  {title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-zinc-600">{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="plans-heading">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-teal-700">
                Our plans, at a glance
              </p>
              <h2
                id="plans-heading"
                className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900"
              >
                A plan for the way you travel.
              </h2>
            </div>
            <Link
              href="/destinations"
              className="inline-flex items-center gap-2 text-sm font-semibold text-teal-700 underline-offset-4 hover:underline"
            >
              See current plans and prices{' '}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="mt-7 grid gap-5 md:grid-cols-3">
            {PLAN_TYPES.map(({ icon: Icon, title, text }) => (
              <article key={title} className="rounded-2xl bg-zinc-100 p-6">
                <Icon className="h-6 w-6 text-teal-700" aria-hidden="true" />
                <h3 className="mt-4 text-lg font-semibold text-zinc-900">
                  {title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-zinc-600">{text}</p>
              </article>
            ))}
          </div>
          <div className="mt-5 grid gap-6 rounded-2xl border border-zinc-200 bg-white p-6 sm:grid-cols-2">
            <div>
              <h3 className="font-semibold text-zinc-900">
                Fixed-data bundles
              </h3>
              <p className="mt-2 text-sm leading-7 text-zinc-600">
                Choose a stated data allowance for a defined validity period.
                Data size, supported destinations and travel dates determine the
                available options.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-zinc-900">
                Unlimited options, where available
              </h3>
              <p className="mt-2 text-sm leading-7 text-zinc-600">
                Unlimited plans are priced by the day. Your travel dates
                determine the trip duration and total. Review each plan’s
                coverage, validity and any fair-use conditions before choosing.
              </p>
            </div>
            <p className="border-t border-zinc-100 pt-4 text-sm leading-6 text-zinc-600 sm:col-span-2">
              Plan availability and prices can change. Plans are displayed in
              USD; checkout shows the exact payment currency and amount before
              you pay. Always review the current plan details for your trip.
            </p>
          </div>
        </section>

        <section
          aria-labelledby="technology-heading"
          className="grid gap-8 lg:grid-cols-2 lg:gap-12"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-teal-700">
              The technology behind your connection
            </p>
            <h2
              id="technology-heading"
              className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900"
            >
              A digital SIM. A simpler setup.
            </h2>
            <p className="mt-4 leading-7 text-zinc-600">
              An eSIM is a digital SIM profile installed on a compatible device.
              With a GlobalSimify travel data plan, you can use mobile data
              abroad while keeping your usual SIM available for your existing
              number.
            </p>
            <ul className="mt-5 space-y-3 text-sm leading-6 text-zinc-600">
              {[
                'You need an eSIM-compatible, carrier-unlocked device and an internet connection to install the profile.',
                'Travel plans provide data. Regular voice calls, SMS and home-network roaming are separate unless the plan explicitly says otherwise.',
                'Coverage, network availability and activation rules depend on the selected plan and destination.',
              ].map((text) => (
                <li key={text} className="flex gap-3">
                  <Check
                    className="mt-1 h-4 w-4 shrink-0 text-teal-700"
                    aria-hidden="true"
                  />
                  <span>{text}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/compatibility"
              className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-teal-700 underline-offset-4 hover:underline"
            >
              Check your device{' '}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="space-y-5 rounded-2xl border border-zinc-200 bg-white p-6 sm:p-8">
            <div>
              <h3 className="flex items-center gap-2 font-semibold text-zinc-900">
                <Globe2 className="h-5 w-5 text-teal-700" aria-hidden="true" />
                CELITECH connectivity
              </h3>
              <p className="mt-2 text-sm leading-7 text-zinc-600">
                Our supplier integration connects your selected plan to eSIM
                provisioning and supported top-ups. GlobalSimify is your
                storefront and support contact, not the underlying mobile
                network operator.
              </p>
            </div>
            <div className="border-t border-zinc-100 pt-5">
              <h3 className="flex items-center gap-2 font-semibold text-zinc-900">
                <CreditCard
                  className="h-5 w-5 text-teal-700"
                  aria-hidden="true"
                />
                Paystack checkout
              </h3>
              <p className="mt-2 text-sm leading-7 text-zinc-600">
                Payments are handled through Paystack, with card and supported
                M-Pesa options shown at checkout. eSIM fulfilment begins after
                payment is verified.
              </p>
            </div>
            <div className="border-t border-zinc-100 pt-5">
              <h3 className="flex items-center gap-2 font-semibold text-zinc-900">
                <Cloud className="h-5 w-5 text-teal-700" aria-hidden="true" />
                Google Cloud infrastructure
              </h3>
              <p className="mt-2 text-sm leading-7 text-zinc-600">
                Our website and API run on Google Cloud. Background processing
                helps complete paid orders, while email-verified account access
                brings your eSIM details together in one place.
              </p>
            </div>
          </div>
        </section>

        <section aria-labelledby="social-heading">
          <p className="text-xs font-semibold uppercase tracking-widest text-teal-700">
            Keep in touch
          </p>
          <h2
            id="social-heading"
            className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900"
          >
            Find us beyond your next destination.
          </h2>
          <p className="mt-3 max-w-2xl leading-7 text-zinc-600">
            Follow our official channels for news, travel inspiration and
            updates. For help with a purchase, use our{' '}
            <Link
              href="/help"
              className="font-medium text-teal-700 underline underline-offset-4"
            >
              support page
            </Link>{' '}
            rather than posting personal or eSIM details publicly.
          </p>
          <div className="mt-7 grid gap-5 md:grid-cols-3">
            {SOCIALS.map((social) => (
              <a
                key={social.name}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white transition-colors hover:border-teal-500 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-600"
              >
                <div className="flex aspect-square items-center justify-center border-b border-zinc-100 bg-white p-5">
                  {social.name === 'Instagram' ? (
                    <Image
                      src={social.image}
                      alt={social.alt}
                      width={social.width}
                      height={social.height}
                      unoptimized
                      className="h-auto w-full max-w-80"
                    />
                  ) : (
                    <div className="flex h-32 w-32 items-center justify-center rounded-3xl bg-black">
                      <Image
                        src={social.image}
                        alt={social.alt}
                        width={social.width}
                        height={social.height}
                        sizes="128px"
                        className={
                          social.name === 'TikTok'
                            ? 'h-32 w-32 rounded-3xl'
                            : 'h-auto w-16'
                        }
                      />
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <h3 className="flex items-center justify-between gap-3 text-lg font-semibold text-zinc-900">
                    {social.name}
                    <ExternalLink
                      className="h-4 w-4 shrink-0 text-zinc-500 group-hover:text-teal-700"
                      aria-hidden="true"
                    />
                  </h3>
                  <p className="mt-1 text-sm font-medium text-teal-700">
                    {social.handle}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-zinc-600">
                    {social.description}
                  </p>
                  <span className="mt-5 block pt-1 text-sm font-semibold text-teal-700">
                    Visit our profile <span aria-hidden="true">→</span>
                    <span className="sr-only"> (opens in a new tab)</span>
                  </span>
                </div>
              </a>
            ))}
          </div>
        </section>

        <section
          className="rounded-3xl bg-zinc-900 px-6 py-10 text-center sm:px-10"
          aria-labelledby="next-trip-heading"
        >
          <h2
            id="next-trip-heading"
            className="text-2xl font-semibold tracking-tight text-white sm:text-3xl"
          >
            Where are you heading next?
          </h2>
          <p className="mx-auto mt-3 max-w-xl leading-7 text-zinc-300">
            Find a plan that fits your destination and dates, or get help
            choosing the right option.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/destinations"
              className={`${button} bg-teal-600 text-white hover:bg-teal-700`}
            >
              Browse destinations{' '}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href="/help"
              className={`${button} border border-zinc-600 text-white hover:bg-zinc-800`}
            >
              Talk to us
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
