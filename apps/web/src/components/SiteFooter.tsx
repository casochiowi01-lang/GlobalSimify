import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-zinc-100 bg-zinc-50">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">Shop</h3>
            <ul className="mt-3 space-y-2 text-sm text-zinc-500">
              <li>
                <Link href="/destinations" className="hover:text-zinc-900">
                  Destinations
                </Link>
              </li>
              <li>
                <Link href="/how-it-works" className="hover:text-zinc-900">
                  How it works
                </Link>
              </li>
              <li>
                <Link href="/compatibility" className="hover:text-zinc-900">
                  Check compatibility
                </Link>
              </li>
              <li>
                <Link href="/partners" className="hover:text-zinc-900">
                  Partner with us
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">Help</h3>
            <ul className="mt-3 space-y-2 text-sm text-zinc-500">
              <li>
                <Link href="/about" className="hover:text-zinc-900">
                  About us
                </Link>
              </li>
              <li>
                <Link href="/faq" className="hover:text-zinc-900">
                  FAQ
                </Link>
              </li>
              <li>
                <Link href="/help" className="hover:text-zinc-900">
                  Help &amp; support
                </Link>
              </li>
              <li>
                <Link href="/blog" className="hover:text-zinc-900">
                  Blog
                </Link>
              </li>
              <li>
                <Link href="/account/esims" className="hover:text-zinc-900">
                  My eSIMs
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">Legal</h3>
            <ul className="mt-3 space-y-2 text-sm text-zinc-500">
              <li>
                <Link href="/legal/terms" className="hover:text-zinc-900">
                  Terms
                </Link>
              </li>
              <li>
                <Link href="/legal/privacy" className="hover:text-zinc-900">
                  Privacy
                </Link>
              </li>
              <li>
                <Link href="/legal/refunds" className="hover:text-zinc-900">
                  Refunds
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">Pay with</h3>
            <p className="mt-3 flex flex-wrap gap-2 text-sm">
              <span className="font-semibold text-green-700">Mobile money</span>
              <span className="font-semibold text-zinc-700">Visa</span>
              <span className="font-semibold text-zinc-700">Mastercard</span>
            </p>
          </div>
        </div>
        <div className="mt-8 border-t border-zinc-100 pt-6 text-center">
          <p className="text-sm text-zinc-400">
            Stay connected abroad. Built for African travellers.
          </p>
          <div className="mt-3 flex flex-col items-center gap-1.5 text-xs text-zinc-400 sm:flex-row sm:justify-center sm:gap-3">
            <span>
              © {new Date().getFullYear()} GlobalSimify. All rights reserved.
            </span>
            <span className="hidden text-zinc-300 sm:inline">•</span>
            <span>
              GlobalSimify<sup className="text-[0.6em]">™</sup> is a brand of{' '}
              <span className="font-medium text-zinc-500">
                Entrix Corporate Solutions
              </span>
              .
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
