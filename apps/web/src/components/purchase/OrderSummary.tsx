import { formatMoney } from '@/lib/format';

/** Server-quoted totals shown before payment. All amounts come from the quote, never the client. */
export function OrderSummary({
  title,
  total,
  unitPrice,
  quantity,
  unlimitedDays,
  discount,
}: {
  title: string;
  total: number;
  unitPrice: number;
  quantity: number;
  /** Trip length for per-day unlimited plans; omitted for fixed plans. */
  unlimitedDays?: number;
  discount: number;
}) {
  return (
    <div className="rounded-xl bg-zinc-50 px-4 py-3 text-sm">
      <div className="flex items-center justify-between font-medium text-zinc-900">
        <span>{title}</span>
        <span>{formatMoney(total)}</span>
      </div>
      {unlimitedDays !== undefined && (
        <p className="mt-0.5 text-xs text-zinc-500">
          {unlimitedDays} travel days · confirmed trip price{' '}
          {formatMoney(unitPrice)}
        </p>
      )}
      {quantity > 1 && (
        <p className="mt-0.5 text-xs text-zinc-500">
          {quantity} × {formatMoney(unitPrice)} each
        </p>
      )}
      {discount > 0 && (
        <p className="mt-0.5 text-xs text-teal-700">
          Promo applied: −{formatMoney(discount)}
        </p>
      )}
    </div>
  );
}
