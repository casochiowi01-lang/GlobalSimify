import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { AppConfigService } from '../../config/config.module.js';
import { SettingsService } from '../settings/settings.service.js';
import { FxService } from './fx.service.js';

export interface PriceBreakdown {
  baseUsd: number;
  fxRate: number; // USD→KES, snapshot for converting the Paystack charge only
  fxBufferPct: number;
  feePct: number;
  marginPct: number;
  /** Retail price in the PLATFORM CURRENCY (USD). Field name kept as `retailKes`
   *  for historical reasons; the value is USD. */
  retailKes: number;
  currency: 'USD';
  fxApproved: boolean;
}

/**
 * Computes the USD retail price from a USD wholesale cost. Separates three
 * concerns the original brief conflated:
 *   1. FX volatility cushion (fxBuffer)
 *   2. payment processor fee gross-up (so fees don't eat margin)
 *   3. our profit margin
 * Then rounds UP to a clean USD figure. The USD→KES rate is captured only so the
 * payment layer can convert the charge for Paystack (which collects KES).
 *
 * All percentages are config-driven and runtime-editable via Settings.
 */
@Injectable()
export class PricingService {
  constructor(
    private readonly config: AppConfigService,
    private readonly fx: FxService,
    private readonly settings: SettingsService,
  ) {}

  /**
   * The currently-effective pricing knobs (runtime Settings overrides falling
   * back to env). Used by the admin pricing screen and to preview margins.
   */
  async effective(fresh = false): Promise<{
    marginPct: number;
    fxBufferPct: number;
    processorFeePct: number;
    roundTo: number;
    fxRate: number;
    fxApproved: boolean;
    fxConfirmedAt: string | null;
    fxExpiresAt: string | null;
  }> {
    const [values, fx] = await Promise.all([
      this.settings.getNumbers(
        {
          'pricing.marginPct': this.config.get('PRICING_MARGIN_PCT'),
          'pricing.fxBufferPct': this.config.get('PRICING_FX_BUFFER_PCT'),
          'pricing.processorFeePct': this.config.get(
            'PRICING_PROCESSOR_FEE_PCT',
          ),
          'pricing.roundTo': this.config.get('PRICING_ROUND_TO'),
        },
        fresh,
      ),
      this.fx.snapshot(fresh),
    ]);
    const marginPct = values['pricing.marginPct'];
    const fxBufferPct = values['pricing.fxBufferPct'];
    const processorFeePct = values['pricing.processorFeePct'];
    const roundTo = values['pricing.roundTo'];
    return {
      marginPct,
      fxBufferPct,
      processorFeePct,
      roundTo,
      fxRate: round(fx.rate, 4),
      fxApproved: fx.approved,
      fxConfirmedAt: fx.confirmedAt,
      fxExpiresAt: fx.expiresAt,
    };
  }

  async priceUsd(baseUsd: number, fresh = false): Promise<PriceBreakdown> {
    const {
      fxRate,
      fxApproved,
      fxBufferPct,
      processorFeePct: feePct,
      marginPct,
      roundTo,
    } = await this.effective(fresh);

    // Pure USD pricing — NO FX multiplication (platform currency is USD).
    if (
      ![baseUsd, fxBufferPct, feePct, marginPct, roundTo, fxRate].every(
        Number.isFinite,
      ) ||
      baseUsd < 0 ||
      feePct < 0 ||
      feePct >= 1 ||
      marginPct < 0 ||
      fxBufferPct < 0 ||
      roundTo < 0 ||
      fxRate <= 0
    ) {
      throw new ServiceUnavailableException(
        'Pricing settings need administrator review.',
      );
    }
    const raw = (baseUsd * (1 + fxBufferPct) * (1 + marginPct)) / (1 - feePct);
    // roundTo <= 0 disables rounding — retail is the exact computed value (2dp).
    // With every knob at 0 this yields the exact wholesale (sheet) price.
    const retailUsd =
      roundTo > 0
        ? round(Math.ceil(raw / roundTo) * roundTo, 2)
        : round(raw, 2);

    return {
      baseUsd,
      fxRate: round(fxRate, 4),
      fxBufferPct,
      feePct,
      marginPct,
      retailKes: retailUsd, // USD value (legacy field name)
      currency: 'USD',
      fxApproved,
    };
  }
}

function round(n: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}
