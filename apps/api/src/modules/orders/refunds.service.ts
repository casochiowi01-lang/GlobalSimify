import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { PaystackService } from '../../integrations/paystack/paystack.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { markForManualReview } from './manual-review.js';

/** Refunds a paid order through Paystack at most once, and books it in the ledger exactly once. */
@Injectable()
export class RefundsService {
  private readonly logger = new Logger(RefundsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paystack: PaystackService,
  ) {}

  async refundOrder(orderId: string, reason: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { payment: { include: { refunds: true } }, fulfilments: true },
    });
    if (!order?.payment || order.payment.state !== 'COMPLETE')
      throw new BadRequestException('No completed payment to refund.');
    if (
      order.fulfilments.some((f) => f.state === 'SENT' || f.state === 'REVIEW')
    )
      throw new BadRequestException(
        'Reconcile uncertain supplier requests before refunding.',
      );
    if (order.payment.refunds.length)
      throw new ConflictException(
        'A refund already exists; reconcile it rather than sending another.',
      );
    if (order.payment.environment !== this.paystack.environment)
      throw new BadRequestException(
        'Refund must use the original payment environment.',
      );
    // Claim via status before the provider write. A timeout is REVIEW, never automatic retry.
    const claim = await this.prisma.order.updateMany({
      where: {
        id: orderId,
        status: {
          in: ['COMPLETED', 'PAID', 'PROVISION_FAILED', 'MANUAL_REVIEW'],
        },
      },
      data: { status: 'REFUND_PENDING' },
    });
    if (!claim.count)
      throw new ConflictException('Refund already in progress or unavailable.');
    try {
      const result = await this.paystack.refund(
        order.payment.invoiceId,
        undefined,
        reason,
      );
      await this.prisma.refund.create({
        data: {
          paymentId: order.payment.id,
          amountKes: order.totalKes,
          reason,
          providerRef: result.ref,
          state: result.status,
        },
      });
      if (result.status === 'completed')
        await this.completeRefund(order.payment.id, result.ref);
    } catch {
      await this.review(
        orderId,
        'Refund outcome uncertain. Check Paystack before any repeat request.',
      );
    }
  }

  async completeRefund(paymentId: string, providerRef: string) {
    await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUniqueOrThrow({
        where: { id: paymentId },
      });
      const claim = await tx.order.updateMany({
        where: { id: payment.orderId, status: { not: 'REFUNDED' } },
        data: { status: 'REFUNDED' },
      });
      await tx.refund.updateMany({
        where: { paymentId, providerRef },
        data: { state: 'completed' },
      });
      if (claim.count)
        await tx.ledgerEntry.create({
          data: {
            orderId: payment.orderId,
            account: 'refunds',
            direction: 'debit',
            amountKes: payment.amountKes,
            memo: 'USD completed refund',
          },
        });
    });
  }

  private review(orderId: string, reason: string) {
    return markForManualReview(this.prisma, this.logger, orderId, reason);
  }
}
