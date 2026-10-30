import { describe, expect, it } from 'vitest';
import type { Product } from './api';
import {
  DEFAULT_TRIP_DAYS,
  fitsTrip,
  planLabel,
  recommendProduct,
  tripDuration,
} from './plans';

const plan = (overrides: Partial<Product>): Product =>
  ({
    id: 'p',
    title: 'Plan',
    dataLabel: '1 GB',
    priceKes: 10,
    minDays: 1,
    validityDays: 30,
    unlimited: false,
    ...overrides,
  }) as Product;

describe('tripDuration', () => {
  it('counts both arrival and departure days', () => {
    expect(tripDuration('2026-11-10', '2026-11-20')).toBe(11);
    expect(tripDuration('2026-11-10', '2026-11-10')).toBe(1);
  });

  it('assumes a default trip until both dates are chosen', () => {
    expect(tripDuration('', '2026-11-20')).toBe(DEFAULT_TRIP_DAYS);
    expect(tripDuration('2026-11-10', '')).toBe(DEFAULT_TRIP_DAYS);
  });

  it('never returns less than one day for reversed dates', () => {
    expect(tripDuration('2026-11-20', '2026-11-10')).toBe(1);
  });
});

describe('fitsTrip', () => {
  const window31to90 = plan({ minDays: 31, validityDays: 90 });

  it('accepts trips inside the validity window, inclusive', () => {
    expect(fitsTrip(window31to90, 31)).toBe(true);
    expect(fitsTrip(window31to90, 90)).toBe(true);
  });

  it('rejects trips outside the window', () => {
    expect(fitsTrip(window31to90, 30)).toBe(false);
    expect(fitsTrip(window31to90, 91)).toBe(false);
  });

  it('treats a missing minimum as one day', () => {
    expect(fitsTrip(plan({ minDays: undefined }), 1)).toBe(true);
  });
});

describe('recommendProduct', () => {
  const small = plan({ id: 'small', priceKes: 9 });
  const large = plan({ id: 'large', priceKes: 36 });
  const long = plan({
    id: 'long',
    priceKes: 11,
    minDays: 31,
    validityDays: 90,
  });
  const unlimited = plan({
    id: 'unl',
    priceKes: 8,
    unlimited: true,
    minDays: 3,
    validityDays: 30,
  });

  it('picks the cheapest fixed plan that covers the trip', () => {
    expect(recommendProduct([large, small, long], 7)?.id).toBe('small');
  });

  it('ignores cheaper per-day unlimited plans when a fixed plan fits', () => {
    expect(recommendProduct([unlimited, large], 7)?.id).toBe('large');
  });

  it('switches to longer-validity plans for long trips', () => {
    expect(recommendProduct([small, large, long], 45)?.id).toBe('long');
  });

  it('falls back to unlimited only when no fixed plan fits', () => {
    expect(recommendProduct([unlimited, long], 10)?.id).toBe('unl');
  });

  it('returns null when nothing fits', () => {
    expect(recommendProduct([], 7)).toBeNull();
    expect(recommendProduct([long], 7)).toBeNull();
  });
});

describe('planLabel', () => {
  it('describes fixed plans by data and validity', () => {
    expect(planLabel(plan({ dataLabel: '5 GB', priceKes: 36.5 }))).toBe(
      '5 GB · 1–30 days · $36.50',
    );
  });

  it('describes unlimited plans by daily price', () => {
    expect(planLabel(plan({ unlimited: true, priceKes: 8 }))).toBe(
      'Unlimited · $8.00/day',
    );
  });
});
