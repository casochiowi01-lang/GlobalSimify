'use client';

import { useState } from 'react';
import { Smartphone, ChevronDown, Wifi } from 'lucide-react';

type Platform = 'ios' | 'android';

const STEPS: Record<Platform, string[]> = {
  ios: [
    'Open Settings, then tap Mobile Data (or Cellular).',
    'Tap Add eSIM, then choose Use QR Code.',
    'Scan the QR code from your order or email.',
    'When asked, label this plan "Travel" so it is easy to spot.',
    'Keep your primary line as default for calls and iMessage.',
    'When you land abroad, turn on Data Roaming for the Travel eSIM only.',
  ],
  android: [
    'Open Settings, then go to Network & Internet.',
    'Tap SIMs, then Add eSIM / Download a SIM.',
    'Scan the QR code from your order or email.',
    'Enable the new eSIM once it finishes downloading.',
    'When you land abroad, turn on roaming for the travel eSIM.',
  ],
};

export function InstallGuide() {
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<Platform>('ios');

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <span className="flex items-center gap-2 font-semibold text-zinc-900">
          <Smartphone className="h-5 w-5 text-teal-600" />
          How to install your eSIM
        </span>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-zinc-400 transition ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="border-t border-zinc-100 px-5 pb-5 pt-4">
          {/* Wi-Fi tip */}
          <p className="flex items-start gap-2 rounded-xl bg-teal-50 px-3.5 py-3 text-sm text-teal-900">
            <Wifi className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
            Scan your QR code on home Wi-Fi <strong>before you travel</strong>.
            Your plan only starts counting once you connect abroad.
          </p>

          {/* Tabs */}
          <div className="mt-4 flex gap-2">
            {(['ios', 'android'] as Platform[]).map((p) => (
              <button
                key={p}
                onClick={() => setPlatform(p)}
                className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                  platform === p
                    ? 'bg-teal-600 text-white'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                }`}
              >
                {p === 'ios' ? 'iPhone (iOS)' : 'Android'}
              </button>
            ))}
          </div>

          {platform === 'android' && (
            <p className="mt-3 text-xs text-zinc-400">
              Steps vary slightly by phone brand and Android version.
            </p>
          )}

          <ol className="mt-4 space-y-3">
            {STEPS[platform].map((step, i) => (
              <li
                key={step}
                className="flex items-start gap-3 text-sm text-zinc-700"
              >
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-teal-600 text-xs font-bold text-white">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
