'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

const CLIENT_ID = process.env.NEXT_PUBLIC_APPLE_CLIENT_ID;
const REDIRECT_URI = process.env.NEXT_PUBLIC_APPLE_REDIRECT_URI;

interface AppleAuthResponse {
  authorization: { id_token: string; code: string };
}
interface AppleID {
  auth: {
    init: (o: Record<string, unknown>) => void;
    signIn: () => Promise<AppleAuthResponse>;
  };
}
declare global {
  interface Window {
    AppleID?: AppleID;
  }
}

export function AppleSignInButton() {
  const router = useRouter();
  const { appleSignIn } = useAuth();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!CLIENT_ID) return;
    function init() {
      if (!window.AppleID) return;
      window.AppleID.auth.init({
        clientId: CLIENT_ID,
        scope: 'name email',
        redirectURI: REDIRECT_URI || window.location.origin,
        usePopup: true,
      });
      setReady(true);
    }
    if (window.AppleID) {
      init();
      return;
    }
    const existing = document.getElementById('appleid-script');
    if (existing) {
      existing.addEventListener('load', init);
      return;
    }
    const s = document.createElement('script');
    s.id = 'appleid-script';
    s.src =
      'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';
    s.async = true;
    s.onload = init;
    document.head.appendChild(s);
  }, []);

  async function onClick() {
    setError(null);
    try {
      const res = await window.AppleID!.auth.signIn();
      await appleSignIn(res.authorization.id_token);
      router.replace('/account/esims');
    } catch (e) {
      const msg =
        (e as { error?: string } & Error).error ?? (e as Error).message;
      if (msg && msg !== 'popup_closed_by_user')
        setError('Apple sign-in failed.');
    }
  }

  if (!CLIENT_ID) return null;

  return (
    <div className="mt-3">
      <button
        onClick={onClick}
        disabled={!ready}
        className="flex w-full items-center justify-center gap-2 rounded-md bg-black py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
      >
        <svg
          viewBox="0 0 384 512"
          width="14"
          height="14"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C73.3 141.6 24 184.5 24 270.5q0 38.1 13.9 78.6c12.3 35.9 56.8 124.1 103.3 122.7 24.3-.6 41.5-17.2 73.1-17.2 30.7 0 46.6 17.2 73.7 17.2 46.9-.7 87.2-80.9 98.9-116.9-62.9-29.7-61.2-87-61.2-86.2zM262.1 84.5c27.4-32.5 24.9-62.1 24.1-72.5-24.2 1.4-52.2 16.5-68.2 35.1-17.6 19.9-27.9 44.5-25.7 71.9 26.1 2 49.9-11.4 69.8-34.5z" />
        </svg>
        Continue with Apple
      </button>
      {error && (
        <p className="mt-2 text-center text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
