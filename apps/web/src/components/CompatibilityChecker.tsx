'use client';

import { useState } from 'react';
import { Smartphone, CheckCircle2, Info } from 'lucide-react';
import { describeDevice } from '@/lib/device';
import { useClientValue } from '@/lib/use-client-value';

export function CompatibilityChecker() {
  const userAgent = useClientValue(() => navigator.userAgent, '');
  const { os, device } = describeDevice(userAgent);
  // Instructions default to the detected platform until the visitor picks a tab.
  const [tabChoice, setTab] = useState<'ios' | 'android' | null>(null);
  const tab = tabChoice ?? (os === 'android' ? 'android' : 'ios');

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-2xl border border-teal-200 bg-teal-50 p-4">
        <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" />
        <div className="text-sm text-teal-900">
          {os === 'other' ? (
            <p>
              You appear to be on a computer. eSIMs install on a phone — open
              this page on the phone you&apos;ll travel with.
            </p>
          ) : (
            <p>
              We detected <strong>{device}</strong>. Most{' '}
              {os === 'ios'
                ? 'iPhones (XS, 2018 and newer)'
                : 'recent Android flagships'}{' '}
              support eSIM — but always confirm with the definitive check below.
            </p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5">
        <h2 className="flex items-center gap-2 font-semibold text-zinc-900">
          <CheckCircle2 className="h-5 w-5 text-teal-600" /> The 10-second check
        </h2>
        <p className="mt-2 text-sm text-zinc-600">
          Open your phone dialer and type{' '}
          <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-800">
            *#06#
          </code>
          . If you see an <strong>EID</strong> number (32 digits), your phone
          supports eSIM. No EID usually means no eSIM support.
        </p>
        <p className="mt-2 flex items-start gap-2 text-sm text-zinc-500">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          Your phone must also be <strong>carrier-unlocked</strong>. If you
          bought it on contract, ask your carrier to confirm it&apos;s unlocked.
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5">
        <h2 className="font-semibold text-zinc-900">
          How to install, step by step
        </h2>
        <div className="mt-3 flex gap-2">
          {(['ios', 'android'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                tab === t
                  ? 'bg-zinc-900 text-white'
                  : 'bg-zinc-100 text-zinc-600'
              }`}
            >
              {t === 'ios' ? 'iPhone' : 'Android'}
            </button>
          ))}
        </div>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-zinc-700">
          {tab === 'ios' ? (
            <>
              <li>Connect to Wi-Fi (do this before you travel).</li>
              <li>Settings → Mobile Service / Cellular → Add eSIM.</li>
              <li>Tap “Use QR Code” and scan the code from your dashboard.</li>
              <li>Label it “Travel”, then set it as your data line abroad.</li>
              <li>
                Turn ON Data Roaming for the eSIM line (it stays on the eSIM).
              </li>
            </>
          ) : (
            <>
              <li>Connect to Wi-Fi (do this before you travel).</li>
              <li>
                Settings → Network &amp; internet → SIMs → Add eSIM / Download a
                SIM.
              </li>
              <li>Scan the QR code from your dashboard.</li>
              <li>Set the eSIM as your mobile-data SIM abroad.</li>
              <li>Enable Roaming for the eSIM line only.</li>
            </>
          )}
        </ol>
      </div>
    </div>
  );
}
