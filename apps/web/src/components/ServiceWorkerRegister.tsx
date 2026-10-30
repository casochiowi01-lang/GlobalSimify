'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegister() {
  useEffect(() => {
    // Only run the service worker in production builds. In `next dev` it would
    // trigger on-demand compilation of precached routes and slow everything down.
    if (process.env.NODE_ENV !== 'production') return;
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* registration failed — app still works online */
      });
    }
  }, []);
  return null;
}
