import type { EsimCountry, EsimPackage } from './celitech.types.js';
import { PRICELIST } from './pricelist.data.js';

/**
 * Catalogue source used when CELITECH_MODE=mock. Built from the official
 * Celitech price list (pricelist.data.ts, effective 10 September 2026
 * spreadsheet). `priceUsd` is the EXACT wholesale USD from the sheet, so with
 * the pricing knobs (margin/fx/fee/round) all at 0 the displayed price equals
 * the sheet price; setting a margin marks every plan up accordingly.
 *
 * Each destination is expanded into one package per (data size × duration tier):
 *   - tier30 sizes  → validityDays 30 (plans valid up to 30 days)
 *   - tier90 sizes  → validityDays 90 (plans valid 31–90 days)
 * Unlimited per-day rates are expanded below. Checkout multiplies the supplier
 * daily cost by inclusive travel days before applying the saved retail settings.
 */
export function buildMockPackages(): EsimPackage[] {
  const out: EsimPackage[] = [];
  for (const e of PRICELIST) {
    if (e.restricted) continue;
    const countries: EsimCountry[] =
      e.scope === 'COUNTRY'
        ? [{ iso: e.iso2, name: e.name, region: e.region }]
        : (e.countries ?? []).map((name) => ({
            iso: '',
            name,
            region: e.region,
          }));
    const tiers: Array<{ prices: Record<string, number>; days: number }> = [
      { prices: e.tier30, days: 30 },
      { prices: e.tier90, days: 90 },
    ];
    for (const { prices, days } of tiers) {
      for (const [gbStr, priceUsd] of Object.entries(prices)) {
        const gb = Number(gbStr);
        out.push({
          providerPackageId: `pl_${e.iso2}_${gb}GB_${days}D`,
          destinationIso2: e.iso2,
          destinationName: e.name,
          region: e.region,
          dataGb: gb,
          validityDays: days,
          minDays: days > 30 ? 31 : 1,
          speed: e.service ? [e.service] : [],
          priceUsd,
          scope: e.scope,
          countries,
        });
      }
    }
    // September 2026: unlimited daily rates cover 3–30 inclusive travel days.
    if (typeof e.unlimitedPerDay === 'number') {
      out.push({
        providerPackageId: `pl_${e.iso2}_UNLIMITED`,
        destinationIso2: e.iso2,
        destinationName: e.name,
        region: e.region,
        dataGb: 0,
        validityDays: 30,
        priceUsd: e.unlimitedPerDay, // PER-DAY wholesale
        unlimited: true,
        minDays: 3,
        speed: e.service ? [e.service] : [],
        scope: e.scope,
        countries,
      });
    }
  }
  return out;
}
