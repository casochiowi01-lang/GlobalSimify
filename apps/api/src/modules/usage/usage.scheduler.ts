import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UsageService } from './usage.service.js';

/**
 * Drives proactive data-usage alerts. Polling complements signed 50/80% webhooks;
 * consumption for active eSIMs on a schedule (in addition to on-demand refresh
 * when a customer opens their dashboard).
 */
@Injectable()
export class UsageScheduler {
  private readonly logger = new Logger(UsageScheduler.name);

  constructor(private readonly usage: UsageService) {}

  @Cron(CronExpression.EVERY_MINUTE, { waitForCompletion: true })
  async webhooks(): Promise<void> {
    try {
      await this.usage.processWebhooks();
    } catch {
      this.logger.warn('Webhook processing will retry.');
    }
  }

  @Cron(CronExpression.EVERY_30_MINUTES, { waitForCompletion: true })
  async poll(): Promise<void> {
    try {
      await this.usage.pollActive();
    } catch (err) {
      this.logger.error(`Usage poll failed: ${(err as Error).message}`);
    }
  }

  @Cron(CronExpression.EVERY_6_HOURS)
  async expiry(): Promise<void> {
    try {
      await this.usage.checkExpiring();
    } catch (err) {
      this.logger.error(`Expiry check failed: ${(err as Error).message}`);
    }
  }
}
