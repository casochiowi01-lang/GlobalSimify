import type { CheckoutQuote } from '@/lib/use-checkout-quote';

/** Show the actual payment currency before redirecting to the processor. */
export function PaymentCharge({ quote }: { quote?: CheckoutQuote }) {
  if (quote?.chargeAmount == null) return null;
  return (
    <p className="text-xs text-zinc-600">
      Paystack charge:{' '}
      <strong>
        {new Intl.NumberFormat('en-KE', {
          style: 'currency',
          currency: 'KES',
        }).format(quote.chargeAmount)}
      </strong>
      . Prices are displayed in USD and converted using the daily reference
      rate. Your card issuer may apply its own conversion fees.{' '}
      <a
        href="https://www.exchangerate-api.com"
        target="_blank"
        rel="noreferrer"
        className="underline"
      >
        Rates by Exchange Rate API
      </a>
      .
    </p>
  );
}
