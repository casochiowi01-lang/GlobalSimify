import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma, type Order } from '@prisma/client';
import { Events, type PaymentCompletedEvent } from '../../common/events.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AppConfigService } from '../../config/config.module.js';
import {
  PaystackService,
  type VerifyResult,
} from '../../integrations/paystack/paystack.service.js';
import {
  OrdersService,
  type CreateOrderInput,
  type CreateTopUpInput,
} from '../orders/orders.service.js';
import { RefundsService } from '../orders/refunds.service.js';
import { ProvisioningQueue } from '../orders/provisioning.queue.js';
import { PromotionsService } from '../promotions/promotions.service.js';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly paystack: PaystackService,
    private readonly orders: OrdersService,
    private readonly provisioning: ProvisioningQueue,
    private readonly promotions: PromotionsService,
    private readonly events: EventEmitter2,
    private readonly refunds: RefundsService,
  ) {}

  async checkoutMpesa(input: CreateOrderInput) {
    return this.start(await this.orders.createOrder(input), 'MPESA');
  }
  async checkoutCard(input: CreateOrderInput) {
    return this.start(await this.orders.createOrder(input), 'CARD');
  }
  async checkoutTopUp(
    input: CreateTopUpInput,
    method: 'MPESA' | 'CARD' = 'MPESA',
  ) {
    return this.start(await this.orders.createTopUp(input), method);
  }
  async quote(input: Parameters<OrdersService['quote']>[0], userId?: string) {
    const q = await this.orders.quote(input);
    const availability = await this.orders.checkoutAvailability(userId);
    if (
      availability.checkoutEnabled &&
      !q.price.fxApproved &&
      this.config.get('CELITECH_MODE') === 'live'
    ) {
      availability.checkoutEnabled = false;
      availability.checkoutNotice =
        'Payments are temporarily unavailable while the store confirms its currency conversion rate. No payment will be taken.';
    }
    return {
      total: q.total,
      subtotal: q.subtotal,
      discount: q.discount,
      quantity: q.quantity,
      unitPrice: q.price.retailKes,
      currency: 'USD',
      chargeCurrency: 'KES',
      chargeAmount: q.price.fxApproved
        ? new Prisma.Decimal(q.total)
            .mul(q.price.fxRate)
            .toDecimalPlaces(2)
            .toNumber()
        : null,
      ...q.window,
      ...availability,
    };
  }

  private async start(order: Order, method: 'MPESA' | 'CARD') {
    const base = this.config.corsOrigins[0] ?? 'http://localhost:3001';
    const callback =
      base +
      '/order/' +
      order.id +
      '#access=' +
      encodeURIComponent(order.accessToken);
    const existing = await this.prisma.payment.findUnique({
      where: { orderId: order.id },
    });
    if (existing) {
      if (existing.state === 'COMPLETE')
        return { orderId: order.id, checkoutUrl: callback };
      if (existing.checkoutUrl)
        return { orderId: order.id, checkoutUrl: existing.checkoutUrl };
      throw new ConflictException(
        'Payment setup is being checked. Do not submit a second payment.',
      );
    }
    const expectedAmount = new Prisma.Decimal(order.totalKes)
      .mul(order.fxRate)
      .mul(100)
      .toDecimalPlaces(0)
      .toNumber();
    if (!Number.isSafeInteger(expectedAmount) || expectedAmount < 1)
      throw new ConflictException('Invalid payment total.');
    const reference = 'gs-' + order.id;
    // Reserve the reference before contacting Paystack, including the expected charge.
    await this.prisma.$transaction(async (tx) => {
      await tx.payment.create({
        data: {
          orderId: order.id,
          provider: 'paystack',
          method,
          invoiceId: reference,
          state: 'PROCESSING',
          amountKes: order.totalKes,
          expectedAmount,
          chargeCurrency: 'KES',
          environment: this.paystack.environment,
        },
      });
      await tx.order.update({
        where: { id: order.id },
        data: { status: 'AWAITING_PAYMENT' },
      });
    });
    const init = await this.paystack.initializeTransaction({
      reference,
      amountKes: expectedAmount / 100,
      email: order.customerEmail!,
      callbackUrl: callback,
      channels: method === 'CARD' ? ['card'] : ['mobile_money'],
      phone: order.customerPhone,
    });
    if (init.reference !== reference)
      throw new Error('Payment reference mismatch.');
    await this.prisma.payment.update({
      where: { invoiceId: reference },
      data: { state: 'PENDING', checkoutUrl: init.checkoutUrl },
    });
    if (this.paystack.isMock)
      setTimeout(() => {
        void this.verify(reference).catch(() =>
          this.logger.warn('Mock payment pending reconciliation.'),
        );
      }, 2200);
    return { orderId: order.id, checkoutUrl: init.checkoutUrl };
  }

  async handleWebhook(
    payload: {
      event?: string;
      data?: { reference?: string; id?: number | string; status?: string };
    },
    opts: { rawBody?: Buffer; signature?: string; internal?: boolean } = {},
  ) {
    if (
      !opts.rawBody ||
      !this.paystack.verifySignature(opts.rawBody, opts.signature)
    )
      throw new UnauthorizedException('Invalid webhook signature.');
    const event = payload.event ?? '';
    const data = payload.data ?? {};
    if (event === 'charge.success' && data.reference)
      await this.verify(data.reference);
    if (event.startsWith('refund.') && data.id !== undefined) {
      const ref = String(data.id);
      const refund = await this.prisma.refund.findFirst({
        where: { providerRef: ref },
      });
      if (refund) {
        // Re-verify provider status, do not trust event order.
        const result = await this.paystack.getRefundStatus(ref);
        if (result.status === 'completed')
          await this.refunds.completeRefund(refund.paymentId, ref);
        else
          await this.prisma.refund.update({
            where: { id: refund.id },
            data: { state: result.status },
          });
      }
    }
    return { ok: true };
  }

  private async verify(reference: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { invoiceId: reference },
    });
    if (!payment || payment.environment !== this.paystack.environment) return;
    const v = await this.paystack.verifyTransaction(reference);
    if (v.state === 'COMPLETE') await this.confirm(reference, v);
    // Do not expire pending or late-success payments into an unrecoverable failure.
  }

  private async confirm(reference: string, v: VerifyResult) {
    const payment = await this.prisma.payment.findUnique({
      where: { invoiceId: reference },
      include: { order: true },
    });
    if (!payment) return;
    if (
      v.reference !== reference ||
      payment.expectedAmount === null ||
      payment.expectedAmount !== v.amountSubunit ||
      payment.chargeCurrency !== v.currency ||
      payment.environment !== v.environment ||
      (payment.order.supplierMode === 'live' && v.environment !== 'live')
    ) {
      await this.prisma.order.updateMany({
        where: {
          id: payment.orderId,
          status: { in: ['DRAFT', 'AWAITING_PAYMENT', 'PAYMENT_FAILED'] },
        },
        data: {
          status: 'MANUAL_REVIEW',
          failureReason:
            'Payment amount, currency or environment did not match. No eSIM was purchased.',
        },
      });
      throw new Error('Verified payment did not match the order.');
    }
    const changed = await this.prisma.$transaction(async (tx) => {
      const claim = await tx.payment.updateMany({
        where: { id: payment.id, state: { not: 'COMPLETE' } },
        data: {
          state: 'COMPLETE',
          verifiedAt: new Date(),
          feesKes:
            v.feesKes === undefined
              ? undefined
              : new Prisma.Decimal(v.feesKes)
                  .div(payment.order.fxRate)
                  .toDecimalPlaces(2),
          netKes:
            v.netKes === undefined
              ? undefined
              : new Prisma.Decimal(v.netKes)
                  .div(payment.order.fxRate)
                  .toDecimalPlaces(2),
        },
      });
      if (!claim.count) return false;
      await tx.order.updateMany({
        where: {
          id: payment.orderId,
          status: { in: ['DRAFT', 'AWAITING_PAYMENT', 'PAYMENT_FAILED'] },
        },
        data: { status: 'PAID' },
      });
      await tx.ledgerEntry.create({
        data: {
          orderId: payment.orderId,
          account: 'customer_revenue',
          direction: 'credit',
          amountKes: payment.amountKes,
          memo: 'USD verified payment',
        },
      });
      if (v.feesKes !== undefined)
        await tx.ledgerEntry.create({
          data: {
            orderId: payment.orderId,
            account: 'processor_fees',
            direction: 'debit',
            amountKes: new Prisma.Decimal(v.feesKes)
              .div(payment.order.fxRate)
              .toDecimalPlaces(2),
            memo: 'USD processor fee',
          },
        });
      if (payment.order.promoCode)
        await tx.promotion.update({
          where: { code: payment.order.promoCode },
          data: { usedCount: { increment: 1 } },
        });
      return true;
    });
    if (changed && this.config.get('BACKGROUND_MODE') !== 'cloud-tasks') {
      const event: PaymentCompletedEvent = {
        orderId: payment.orderId,
        userId: payment.order.userId,
        customerEmail: payment.order.customerEmail,
        title: payment.order.title,
        amountUsd: Number(payment.amountKes),
        currency: 'USD',
        method: payment.method,
        reference,
        kind: payment.order.kind,
      };
      this.events.emit(Events.PaymentCompleted, event);
    }
    // PAID is a durable outbox entry. The periodic recovery scan covers a crash here.
    await this.provisioning.enqueue(payment.orderId);
  }

  async reconcile(limit = 200) {
    const stats = {
      pendingChecked: 0,
      confirmed: 0,
      failed: 0,
      reprovisioned: 0,
      refundsUpdated: 0,
    };
    if (!this.prisma.configured) return stats;
    const pending = await this.prisma.payment.findMany({
      where: {
        state: { in: ['PENDING', 'PROCESSING'] },
        environment: this.paystack.environment,
      },
      take: limit,
      orderBy: { updatedAt: 'asc' },
    });
    for (const p of pending) {
      stats.pendingChecked++;
      try {
        await this.verify(p.invoiceId);
        await this.prisma.payment.update({
          where: { id: p.id },
          data: { updatedAt: new Date() },
        });
      } catch {
        this.logger.warn('Payment ' + p.id + ' awaiting reconciliation.');
      }
    }
    const stalled = await this.prisma.order.findMany({
      where: { status: { in: ['PAID', 'PROVISIONING'] } },
      select: { id: true },
      take: Math.min(limit, 100),
      orderBy: { updatedAt: 'asc' },
    });
    for (const o of stalled) {
      await this.provisioning.enqueue(o.id);
      stats.reprovisioned++;
    }
    const refunds = await this.prisma.refund.findMany({
      where: {
        state: { in: ['pending', 'processing'] },
        payment: { environment: this.paystack.environment },
      },
      take: Math.min(limit, 100),
    });
    for (const r of refunds) {
      if (!r.providerRef) continue;
      try {
        const next = await this.paystack.getRefundStatus(r.providerRef);
        if (next.status === 'completed')
          await this.refunds.completeRefund(r.paymentId, r.providerRef);
        else
          await this.prisma.refund.update({
            where: { id: r.id },
            data: { state: next.status },
          });
        stats.refundsUpdated++;
      } catch {
        this.logger.warn('Refund ' + r.id + ' awaiting reconciliation.');
      }
    }
    return stats;
  }
}
