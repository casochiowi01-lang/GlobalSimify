import type { Product } from './api';
import { formatMoney } from './format';

const DAY_MS = 86_400_000;
/** Trip length assumed until the customer picks dates. */
export const DEFAULT_TRIP_DAYS = 7;

/** Inclusive trip length in days: arrival and departure both count. */
export function tripDuration(start: string, end: string): number {
  if (!start || !end) return DEFAULT_TRIP_DAYS;
  const days =
    Math.round((new Date(end).getTime() - new Date(start).getTime()) / DAY_MS) +
    1;
  return Math.max(1, days);
}

/** Whether a plan's validity window covers a trip of `days`. */
export function fitsTrip(plan: Product, days: number): boolean {
  return days >= (plan.minDays ?? 1) && days <= plan.validityDays;
}

/**
 * The plan to suggest for a trip: the cheapest fixed-size plan that covers it.
 * Unlimited plans are priced per day, so they are only suggested when no
 * fixed-size plan fits.
 */
export function recommendProduct(
  products: readonly Product[],
  days: number,
): Product | null {
  const eligible = products.filter((p) => fitsTrip(p, days));
  const fixed = eligible.filter((p) => !p.unlimited);
  if (!fixed.length) return eligible[0] ?? null;
  const byPrice = [...fixed].sort((a, b) => a.priceKes - b.priceKes);
  return (
    byPrice.find((p) => p.validityDays >= days) ?? byPrice[byPrice.length - 1]
  );
}

export function planLabel(plan: Product): string {
  return plan.unlimited
    ? `Unlimited · ${formatMoney(plan.priceKes)}/day`
    : `${plan.dataLabel} · ${plan.minDays ?? 1}–${plan.validityDays} days · ${formatMoney(plan.priceKes)}`;
}
