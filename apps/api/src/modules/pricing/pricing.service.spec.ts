import { PricingService } from './pricing.service.js';
import type { AppConfigService } from '../../config/config.module.js';
import type { FxService } from './fx.service.js';
import type { SettingsService } from '../settings/settings.service.js';

describe('PricingService (USD)', () => {
  const config = {
    get: (k: string) =>
      ({
        PRICING_FX_BUFFER_PCT: 0.03,
        PRICING_PROCESSOR_FEE_PCT: 0.035,
        PRICING_MARGIN_PCT: 0.35,
        PRICING_ROUND_TO: 0.5,
      })[k],
  } as unknown as AppConfigService;
  const fx = {
    snapshot: () =>
      Promise.resolve({
        rate: 130,
        approved: true,
        confirmedAt: null,
        expiresAt: null,
      }),
  } as unknown as FxService;
  const settings = {
    getNumbers: (defaults: Record<string, number>) => Promise.resolve(defaults),
  } as unknown as SettingsService;

  const service = new PricingService(config, fx, settings);

  it('prices in USD (no FX in the price) and rounds up to nearest 0.5', async () => {
    const pb = await service.priceUsd(10);
    // 10 * 1.03 * 1.35 / 0.965 = 14.41 → ceil to 14.5 USD
    expect(pb.retailKes).toBe(14.5);
    expect(pb.currency).toBe('USD');
    expect(pb.fxRate).toBe(130); // snapshot for the Paystack KES conversion
  });

  it('every price is a multiple of 0.5 USD', async () => {
    for (const usd of [1, 3, 5.5, 22.4]) {
      const pb = await service.priceUsd(usd);
      expect(Number.isInteger(pb.retailKes * 2)).toBe(true);
      expect(pb.retailKes).toBeGreaterThan(0);
    }
  });
});
