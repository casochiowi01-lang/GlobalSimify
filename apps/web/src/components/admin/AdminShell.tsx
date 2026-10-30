'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  SearchCheck,
  Ticket,
  Percent,
  BarChart3,
  ShieldCheck,
  Loader2,
  ExternalLink,
  LogOut,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';

const NAV = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/admin/orders', label: 'Orders', icon: ShoppingCart },
  { href: '/admin/customers', label: 'Customers', icon: Users },
  { href: '/admin/esims', label: 'eSIM lookup', icon: SearchCheck },
  { href: '/admin/promos', label: 'Promo codes', icon: Ticket },
  { href: '/admin/pricing', label: 'Pricing & margin', icon: Percent },
  { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/admin/admins', label: 'Admins', icon: ShieldCheck },
];

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center bg-zinc-100">
      {children}
    </div>
  );
}

export function AdminShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const { status, user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === 'anon') router.replace('/login?next=/admin');
  }, [status, router]);

  if (status === 'loading') {
    return (
      <Center>
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </Center>
    );
  }
  if (status !== 'authed') return null;
  if (user?.role !== 'ADMIN') {
    return (
      <Center>
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-zinc-300" />
          <h1 className="mt-3 font-semibold text-zinc-900">Not authorized</h1>
          <p className="mt-1 text-sm text-zinc-500">
            This area is for administrators only.
          </p>
          <Link
            href="/"
            className="mt-4 inline-block text-teal-700 hover:underline"
          >
            ← Back to site
          </Link>
        </div>
      </Center>
    );
  }

  const isActive = (href: string, exact?: boolean) =>
    exact
      ? pathname === href
      : pathname === href || pathname?.startsWith(href + '/');

  return (
    <div className="min-h-screen bg-zinc-100 lg:flex">
      {/* Sidebar */}
      <aside className="border-b border-zinc-200 bg-white lg:h-screen lg:w-60 lg:shrink-0 lg:border-b-0 lg:border-r lg:sticky lg:top-0">
        <div className="flex items-center gap-2 px-5 py-4">
          <span className="text-lg font-bold text-zinc-900">
            Global<span className="text-teal-600">Simify</span>
          </span>
          <span className="rounded bg-zinc-900 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
            Admin
          </span>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible lg:pb-0">
          {NAV.map((n) => {
            const active = isActive(n.href, n.exact);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active
                    ? 'bg-teal-50 text-teal-700'
                    : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                }`}
              >
                <n.icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="hidden gap-1 border-t border-zinc-100 px-3 py-3 lg:block">
          <Link
            href="/"
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-100"
          >
            <ExternalLink className="h-4 w-4" /> View site
          </Link>
          <button
            onClick={() => logout()}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-100"
          >
            <LogOut className="h-4 w-4" /> Log out
          </button>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 px-4 py-6 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-zinc-900">{title}</h1>
            <span className="text-sm text-zinc-500">{user?.email}</span>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}

/** Small KPI card. */
export function Kpi({
  label,
  value,
  sub,
  tone = 'default',
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'default' | 'good' | 'bad';
}) {
  const toneCls =
    tone === 'good'
      ? 'text-teal-700'
      : tone === 'bad'
        ? 'text-red-600'
        : 'text-zinc-900';
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-bold ${toneCls}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-zinc-400">{sub}</p>}
    </div>
  );
}

/** Section container card. */
export function Panel({
  title,
  children,
  action,
}: {
  title?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5">
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between">
          {title && <h2 className="font-semibold text-zinc-900">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
