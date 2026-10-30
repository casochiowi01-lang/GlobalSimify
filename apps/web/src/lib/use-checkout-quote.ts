'use client';

import { useEffect, useState } from 'react';
import { useAuth } from './auth';

export interface CheckoutQuote {
  total: number;
  subtotal: number;
  discount: number;
  quantity: number;
  unitPrice: number;
  currency: string;
  days: number;
  startDate: string;
  endDate: string;
  checkoutEnabled: boolean;
  checkoutNotice: string | null;
  chargeCurrency: 'KES';
  chargeAmount: number | null;
}
/** The server prices the complete trip before the customer accepts its total. */
export function useCheckoutQuote(
  productId: string | undefined,
  startDate: string,
  endDate: string,
  quantity = 1,
  promoCode = '',
) {
  const { authFetch, user, status } = useAuth();
  const body = JSON.stringify({
    productId,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    quantity,
    promoCode: promoCode || undefined,
  });
  const identity = `${status}:${user?.id ?? ''}:${user?.role ?? ''}`;
  const resultKey = identity + body;
  const [result, setResult] = useState<{
    body: string;
    quote?: CheckoutQuote;
    error?: string;
    key: string;
  } | null>(null);
  useEffect(() => {
    if (!productId) return;
    const abort = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const data = await authFetch<CheckoutQuote>('/payments/quote', {
          method: 'POST',
          body,
          signal: abort.signal,
          cache: 'no-store',
        });
        if (!abort.signal.aborted)
          setResult({ body: resultKey, quote: data, key: crypto.randomUUID() });
      } catch (e) {
        if (!abort.signal.aborted)
          setResult({
            body: resultKey,
            error:
              e instanceof Error ? e.message : 'Unable to confirm this price.',
            key: '',
          });
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [body, productId, resultKey, authFetch]);
  const current = result?.body === resultKey ? result : null;
  return {
    quote: current?.quote,
    quoteError: current?.error,
    quoting: !!productId && !current,
    idempotencyKey: current?.key,
  };
}
