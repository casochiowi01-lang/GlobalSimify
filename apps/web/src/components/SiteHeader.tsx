import Link from 'next/link';
import { Globe2 } from 'lucide-react';
import { AuthButton } from './AuthButton';

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-zinc-100 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-5">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-teal-600 text-white">
              <Globe2 className="h-5 w-5" />
            </span>
            <span className="text-lg tracking-tight text-zinc-900">
              Global<span className="text-teal-600">Simify</span>
            </span>
          </Link>
        </div>
        <nav
          aria-label="Main navigation"
          className="flex items-center gap-5 text-sm font-medium text-zinc-600"
        >
          <Link href="/" className="hidden hover:text-zinc-900 sm:block">
            Home
          </Link>
          <Link
            href="/destinations"
            className="hidden hover:text-zinc-900 sm:block"
          >
            Destinations
          </Link>
          <Link
            href="/how-it-works"
            className="hidden hover:text-zinc-900 lg:block"
          >
            How it works
          </Link>
          <Link href="/about" className="hidden hover:text-zinc-900 lg:block">
            About us
          </Link>
          <AuthButton />
        </nav>
      </div>
      <nav
        aria-label="More navigation"
        className="flex flex-wrap justify-center gap-x-5 gap-y-2 border-t border-zinc-100 px-4 py-2.5 text-xs font-medium text-zinc-600 lg:hidden"
      >
        <Link href="/" className="hover:text-zinc-900 sm:hidden">
          Home
        </Link>
        <Link href="/destinations" className="hover:text-zinc-900 sm:hidden">
          Destinations
        </Link>
        <Link href="/how-it-works" className="hover:text-zinc-900">
          How it works
        </Link>
        <Link href="/about" className="hover:text-zinc-900">
          About us
        </Link>
      </nav>
    </header>
  );
}
