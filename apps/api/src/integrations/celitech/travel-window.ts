import { BadRequestException } from '@nestjs/common';

/** Dates are inclusive calendar dates, matching supplier end-of-day semantics. */
export function travelWindow(
  startDate: string | undefined,
  endDate: string | undefined,
  unlimited: boolean,
  fallbackDays: number,
  now = new Date(),
) {
  const date = (s: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s))
      throw new BadRequestException('Use YYYY-MM-DD travel dates.');
    const d = new Date(`${s}T00:00:00Z`);
    if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== s)
      throw new BadRequestException('Invalid travel date.');
    return d;
  };
  if (!!startDate !== !!endDate || (unlimited && !startDate))
    throw new BadRequestException('Select both travel dates.');
  const start = date(startDate ?? now.toISOString().slice(0, 10));
  const end = endDate
    ? date(endDate)
    : new Date(start.getTime() + (fallbackDays - 1) * 86400000);
  const days = (end.getTime() - start.getTime()) / 86400000 + 1;
  const today = date(now.toISOString().slice(0, 10));
  const latest = new Date(today);
  latest.setUTCFullYear(latest.getUTCFullYear() + 1);
  if (
    start < today ||
    start > latest ||
    !Number.isInteger(days) ||
    days < (unlimited ? 3 : 1) ||
    days > (unlimited ? 30 : 90)
  ) {
    throw new BadRequestException(
      unlimited
        ? 'Unlimited plans require 3–30 travel days, starting within the next year.'
        : 'Select 1–90 travel days, starting within the next year.',
    );
  }
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    days,
  };
}
