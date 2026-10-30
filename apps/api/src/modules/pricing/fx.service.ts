import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../../config/config.module.js';
import { SettingsService } from '../settings/settings.service.js';

const MAX_AGE = 48 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
interface Rate {
  rate: number;
  at: number;
  next: number;
}

/**
 * Automatic daily USD→KES reference rate. Cache in Postgres for reuse across
 * restarts/instances. A valid last-known rate can bridge an outage for at most
 * 48h from the provider's observation time. Never charge using the dev fallback.
 * Provider attribution is displayed wherever checkout conversion is shown.
 */
@Injectable()
export class FxService {
  private readonly logger = new Logger(FxService.name);
  private cached?: Rate;
  private retryAt = 0;
  private inFlight?: Promise<void>;
  constructor(
    private readonly config: AppConfigService,
    private readonly settings: SettingsService,
  ) {}

  async snapshot(_fresh = false) {
    if (!this.inFlight && Date.now() >= this.retryAt)
      this.inFlight = this.refresh().finally(() => {
        this.inFlight = undefined;
      });
    if (this.inFlight) await this.inFlight;
    const approved = !!this.cached && this.valid(this.cached);
    return {
      rate: this.cached?.rate ?? this.config.get('FX_USD_KES_FALLBACK'),
      approved,
      confirmedAt: this.cached ? new Date(this.cached.at).toISOString() : null,
      expiresAt: this.cached
        ? new Date(this.cached.at + MAX_AGE).toISOString()
        : null,
    };
  }

  private valid(value: Rate) {
    return (
      Number.isFinite(value.rate) &&
      value.rate > 0 &&
      Number.isFinite(value.at) &&
      value.at > 0 &&
      value.at <= Date.now() &&
      Date.now() - value.at < MAX_AGE
    );
  }

  private async refresh() {
    this.retryAt = Date.now() + 5 * 60 * 1000;
    try {
      const values = await this.settings.getNumbers(
        {
          'fx.reference.usdToKes': 0,
          'fx.reference.observedAt': 0,
          'fx.reference.nextUpdateAt': 0,
        },
        true,
      );
      const persisted = {
        rate: values['fx.reference.usdToKes'],
        at: values['fx.reference.observedAt'],
        next: values['fx.reference.nextUpdateAt'],
      };
      if (this.valid(persisted)) this.cached = persisted;
      if (this.valid(persisted) && persisted.next > Date.now()) {
        this.retryAt = Math.min(
          persisted.next,
          Date.now() + HOUR,
          persisted.at + MAX_AGE,
        );
        return;
      }
      const response = await fetch('https://open.er-api.com/v6/latest/USD', {
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error('FX HTTP failure');
      const body = (await response.json()) as {
        result?: string;
        base_code?: string;
        rates?: { KES?: number };
        time_last_update_unix?: number;
        time_next_update_unix?: number;
      };
      const next = {
        rate: Number(body.rates?.KES),
        at: Number(body.time_last_update_unix) * 1000,
        next: Number(body.time_next_update_unix) * 1000,
      };
      if (
        body.result !== 'success' ||
        body.base_code !== 'USD' ||
        !this.valid(next) ||
        !Number.isFinite(next.next)
      )
        throw new Error('FX response invalid or stale');
      await this.settings.setMany([
        { key: 'fx.reference.usdToKes', value: next.rate },
        { key: 'fx.reference.observedAt', value: next.at },
        { key: 'fx.reference.nextUpdateAt', value: next.next },
      ]);
      this.cached = next;
      this.retryAt = Math.min(
        Math.max(next.next, Date.now() + HOUR),
        Date.now() + 24 * HOUR,
        next.at + MAX_AGE,
      );
    } catch {
      this.logger.warn(
        'Automatic checkout FX refresh unavailable; only a recent confirmed reference rate may be used.',
      );
    }
  }

  async getUsdToKes(): Promise<number> {
    return (await this.snapshot()).rate;
  }
}
