import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../../config/config.module.js';

interface AtClient {
  SMS: {
    send: (o: {
      to: string[];
      message: string;
      from?: string;
    }) => Promise<unknown>;
  };
}
type AtFactory = (cfg: { apiKey: string; username: string }) => AtClient;

/**
 * Provider-agnostic SMS sender. `mock` logs to the server (dev). `africastalking`
 * sends real SMS via the official SDK — Africa's Talking is the standard Kenyan
 * gateway. Sandbox is used automatically when AFRICASTALKING_USERNAME = "sandbox".
 *
 * Best-effort: failures are logged, never thrown, so a delivery hiccup can't
 * crash a checkout or login (the OTP challenge is still recorded server-side).
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private client?: AtClient;

  constructor(private readonly config: AppConfigService) {}

  get isMock(): boolean {
    return this.config.get('SMS_PROVIDER') === 'mock';
  }

  async send(to: string, message: string): Promise<boolean> {
    if (this.isMock) {
      this.logger.warn(`📲 [MOCK SMS] ${to}: ${message}`);
      return true;
    }
    try {
      const at = await this.atClient();
      const from = this.config.get('AFRICASTALKING_SENDER_ID');
      await at.SMS.send({ to: [to], message, ...(from ? { from } : {}) });
      return true;
    } catch (err) {
      this.logger.error(`SMS send to ${to} failed: ${(err as Error).message}`);
      return false;
    }
  }

  private async atClient(): Promise<AtClient> {
    if (this.client) return this.client;
    const apiKey = this.config.get('AFRICASTALKING_API_KEY');
    const username = this.config.get('AFRICASTALKING_USERNAME');
    if (!apiKey || !username) {
      throw new Error('AFRICASTALKING_API_KEY/USERNAME missing.');
    }
    const mod = (await import('africastalking')) as unknown as {
      default?: AtFactory;
    } & AtFactory;
    const factory: AtFactory = mod.default ?? mod;
    this.client = factory({ apiKey, username });
    return this.client;
  }
}
