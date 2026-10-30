import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PaymentsService } from './payments.service.js';

/**
 * Periodically reconciles the money path against Paystack. Signed webhooks
 * can be missed, so this safety net re-polls pending payments,
 * re-enqueues stuck orders, and finalises in-flight refunds. See
 * {@link PaymentsService.reconcile}.
 */
@Injectable()
export class PaymentsScheduler {
  private readonly logger = new Logger(PaymentsScheduler.name);

  constructor(private readonly payments: PaymentsService) {}

  @Cron(CronExpression.EVERY_5_MINUTES, { waitForCompletion: true })
  async reconcile(): Promise<void> {
    try {
      await this.payments.reconcile();
    } catch (err) {
      this.logger.error(`Reconcile run failed: ${(err as Error).message}`);
    }
  }
}
