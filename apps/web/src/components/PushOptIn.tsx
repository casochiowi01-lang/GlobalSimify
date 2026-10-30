'use client';

import { useEffect, useState } from 'react';
import { Bell, BellOff, Check } from 'lucide-react';
import { API_BASE } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useClientValue } from '@/lib/use-client-value';

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function PushOptIn() {
  const { authFetch } = useAuth();
  const supported = useClientValue(
    () => 'serviceWorker' in navigator && 'PushManager' in window,
    false,
  );
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supported) return;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setEnabled(!!sub))
      .catch(() => {
        // Unknown subscription state: leave the toggle off so the user can opt in.
      });
  }, [supported]);

  async function enable() {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return;
      const { publicKey } = await fetch(
        `${API_BASE}/push/vapid-public-key`,
      ).then((r) => r.json());
      if (!publicKey) return;
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const json = sub.toJSON() as {
        endpoint: string;
        keys: { p256dh: string; auth: string };
      };
      await authFetch('/push/subscribe', {
        method: 'POST',
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });
      setEnabled(true);
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }

  if (!supported) return null;

  if (enabled) {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-teal-50 px-4 py-3 text-sm text-teal-800">
        <Check className="h-4 w-4" /> Data alerts are on — we&apos;ll notify you
        at 50%, 80% and 100% usage.
      </div>
    );
  }

  return (
    <button
      onClick={enable}
      disabled={busy}
      className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-700 hover:border-teal-300 disabled:opacity-50"
    >
      {busy ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
      Turn on data usage alerts
    </button>
  );
}
