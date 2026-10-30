'use client';

import { usePathname } from 'next/navigation';

/**
 * Hides the public marketing chrome (header, footer, floating buttons) on the
 * admin console so /admin/* renders as a full-bleed dashboard.
 */
export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname?.startsWith('/admin')) return null;
  return <>{children}</>;
}
