export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  body: string[]; // paragraphs
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: 'best-esim-for-dubai-from-kenya',
    title: 'The best eSIM for Dubai trips from Africa (2026 guide)',
    excerpt:
      'Heading to Dubai? Here’s how to stay online cheaply with a travel eSIM, paid with mobile money, without roaming bills.',
    date: '2026-05-20',
    body: [
      'Dubai is one of the most popular destinations for African travellers — for business, shopping, and holidays. The one thing that catches people out is connectivity: roaming on your home network can cost a fortune, and airport SIM cards mean queues and a new number.',
      'A travel eSIM solves this. You buy a data plan before you fly, scan a QR code, and land in Dubai already connected — while keeping your home number for WhatsApp and calls.',
      'For a typical 5–7 day Dubai trip, a 3GB–5GB plan is plenty for maps, ride-hailing, WhatsApp, and social media. Heavy users streaming video should consider 10GB. All plans are priced in Kenyan Shillings and paid with mobile money or card.',
      'Before buying, dial *#06# on your phone — if you see an EID number, your device supports eSIM. Most iPhones from XS onward and recent Samsung/Pixel phones are compatible.',
    ],
  },
  {
    slug: 'esim-vs-roaming-kenya',
    title: 'eSIM vs home-network roaming: which is cheaper abroad?',
    excerpt:
      'A simple breakdown of travel eSIMs versus traditional roaming for African travellers.',
    date: '2026-05-12',
    body: [
      'Traditional roaming charges you your home operator’s rates plus a roaming premium — often several hundred shillings per MB in some regions. It’s convenient but unpredictable, and a single video call can cost thousands.',
      'A travel eSIM uses local networks at local data rates, bundled into a flat price you pay upfront. You know exactly what you’ll spend, and you can top up if you run low.',
      'The trade-off: roaming keeps your number active for data automatically, while an eSIM is data-only (your physical SIM still handles calls/SMS). For most travellers, the savings and predictability of an eSIM win easily.',
    ],
  },
  {
    slug: 'how-to-install-esim-iphone-android',
    title: 'How to install a travel eSIM on iPhone and Android',
    excerpt:
      'Step-by-step install instructions — do this on Wi-Fi before you travel.',
    date: '2026-05-05',
    body: [
      'Installing an eSIM takes about a minute. The golden rule: do it on Wi-Fi before you travel, because downloading the profile needs an internet connection.',
      'On iPhone: Settings → Mobile Service → Add eSIM → Use QR Code, then scan the code from your GlobalSimify dashboard. Label it “Travel” and turn on Data Roaming for that line when you arrive.',
      'On Android: Settings → Network & internet → SIMs → Add eSIM, scan the QR, then set the eSIM as your mobile-data SIM abroad and enable roaming for it.',
      'You can install the eSIM on Wi-Fi before travelling. Data validity follows the travel dates selected at checkout; check your confirmed order dates.',
    ],
  },
];

export function getPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}
