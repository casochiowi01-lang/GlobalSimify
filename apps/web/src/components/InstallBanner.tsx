'use client';

import { useEffect, useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { useClientValue } from '@/lib/use-client-value';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'etx_install_dismissed';

/** Whether to offer installation at all: not dismissed earlier and not already running as an app. */
function canOfferInstall(): boolean {
  try {
    if (localStorage.getItem(DISMISS_KEY)) return false;
  } catch {
    return false;
  }
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    // @ts-expect-error iOS Safari
    window.navigator.standalone === true;
  return !standalone;
}

const isIosDevice = () =>
  /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());

export function InstallBanner() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [dismissed, setDismissed] = useState(false);
  // iOS has no install prompt event, so Safari users get manual instructions instead.
  const isIos = useClientValue(() => canOfferInstall() && isIosDevice(), false);
  const show = !dismissed && (isIos || deferred !== null);

  useEffect(() => {
    if (!canOfferInstall() || isIosDevice()) return;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  function dismiss() {
    setDismissed(true);
    localStorage.setItem(DISMISS_KEY, '1');
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    dismiss();
  }

  if (!show) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-md rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl">
      <button
        onClick={dismiss}
        className="absolute right-3 top-3 text-zinc-400"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-600 text-white">
          <Download className="h-5 w-5" />
        </span>
        <div className="pr-4 text-sm">
          <p className="font-semibold text-zinc-900">Install GlobalSimify</p>
          {isIos ? (
            <p className="mt-0.5 text-zinc-600">
              Tap <Share className="inline h-4 w-4" /> then{' '}
              <strong>Add to Home Screen</strong> to access your eSIMs offline.
            </p>
          ) : (
            <>
              <p className="mt-0.5 text-zinc-600">
                Add the app to your home screen for offline access to your eSIM
                QR codes.
              </p>
              <button
                onClick={install}
                className="mt-2 rounded-lg bg-teal-600 px-3 py-1.5 font-medium text-white hover:bg-teal-700"
              >
                Install app
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
