import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma, type Order, type OrderStatus } from '@prisma/client';
import { Events, type EsimProvisionedEvent } from '../../common/events.js';
import { AppConfigService } from '../../config/config.module.js';
import { CelitechService } from '../../integrations/celitech/celitech.service.js';
import type {
  EsimProfile,
  ProvisionRequest,
} from '../../integrations/celitech/celitech.types.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { markForManualReview } from './manual-review.js';
import { money } from './money.js';

type OrderForProvisioning = Prisma.OrderGetPayload<{
  include: { payment: true; fulfilments: true };
}>;
type Fulfilment = OrderForProvisioning['fulfilments'][number];

const PROVISIONABLE_STATUSES: OrderStatus[] = [
  'PAID',
  'PROVISIONING',
  'MANUAL_REVIEW',
];
/** A claimed supplier attempt younger than this still belongs to the worker that claimed it. */
const IN_FLIGHT_CLAIM_MS = 120_000;

/** Turns paid orders into delivered eSIMs, buying each one from the supplier exactly once. */
@Injectable()
export class ProvisioningService {
  private readonly logger = new Logger(ProvisioningService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly celitech: CelitechService,
    private readonly events: EventEmitter2,
    private readonly config: AppConfigService,
  ) {}

  /**
   * Provisioning saga. The database is the durable source of truth and each
   * supplier write is claimed exactly once (READY → SENT). An attempt whose
   * outcome is unknown (SENT/REVIEW) is lookup-only on recovery and is never
   * automatically purchased again.
   */
  async provision(orderId: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { payment: true, fulfilments: { orderBy: { index: 'asc' } } },
    });
    if (!order || !PROVISIONABLE_STATUSES.includes(order.status)) return;
    if (order.payment?.state !== 'COMPLETE') return;

    const blocker = this.provisioningBlocker(order);
    if (blocker) {
      await this.review(orderId, blocker);
      return;
    }

    await this.prisma.order.updateMany({
      where: { id: orderId, status: 'PAID' },
      data: { status: 'PROVISIONING' },
    });
    for (const fulfilment of order.fulfilments) {
      if ((await this.deliver(order, fulfilment)) === 'stop') return;
    }
    await this.completeIfDelivered(order);
  }

  /** Reasons a paid order must go to a human before any supplier request. */
  private provisioningBlocker(order: OrderForProvisioning): string | null {
    const expectedMode = this.celitech.isMock ? 'mock' : 'live';
    const liveSalesOff =
      order.supplierMode === 'live' &&
      (order.payment?.environment !== 'live' ||
        this.config.get('LIVE_SALES_ENABLED') !== 'true');
    if (order.supplierMode !== expectedMode || liveSalesOff) {
      return 'Supplier/payment environment mismatch. No supplier request sent.';
    }
    if (!order.fulfilments.length || !order.startDate || !order.endDate) {
      return 'Legacy order requires manual reconciliation. No supplier request sent.';
    }
    return null;
  }

  /**
   * Deliver one eSIM. Returns 'stop' when the order cannot progress in this
   * run: another worker owns the attempt, or the outcome needs reconciliation.
   */
  private async deliver(
    order: OrderForProvisioning,
    fulfilment: Fulfilment,
  ): Promise<'next' | 'stop'> {
    if (fulfilment.state === 'COMPLETE') return 'next';
    const claim = await this.prisma.fulfilment.updateMany({
      where: { id: fulfilment.id, state: 'READY' },
      data: { state: 'SENT', sentAt: new Date() },
    });
    const claimed = claim.count === 1;
    if (!claimed) {
      const current = await this.prisma.fulfilment.findUniqueOrThrow({
        where: { id: fulfilment.id },
      });
      if (current.state === 'COMPLETE') return 'next';
      const inFlight =
        current.state === 'SENT' &&
        current.sentAt !== null &&
        Date.now() - current.sentAt.getTime() < IN_FLIGHT_CLAIM_MS;
      if (inFlight) return 'stop';
    }

    try {
      const profile = claimed
        ? await this.purchase(order, fulfilment)
        : await this.recover(order, fulfilment);
      if (order.kind === 'TOPUP' && profile.iccid !== order.targetIccid) {
        throw new Error('Supplier returned an unexpected ICCID.');
      }
      await this.saveProfile(order, fulfilment.id, profile);
      return 'next';
    } catch {
      await this.prisma.fulfilment.updateMany({
        where: { id: fulfilment.id, state: { not: 'COMPLETE' } },
        data: {
          state: 'REVIEW',
          error: 'Supplier outcome needs reconciliation.',
        },
      });
      await this.review(
        order.id,
        'Delivery needs review. Support can reconcile the supplier reference; no repeat charge was attempted.',
      );
      return 'stop';
    }
  }

  /** The single billable supplier write, made only after a successful claim. */
  private purchase(order: OrderForProvisioning, fulfilment: Fulfilment) {
    const request: ProvisionRequest = {
      destinationIso: order.supplierDestination ?? order.destinationIso,
      dataGb: order.unlimited ? -1 : order.dataMb / 1000,
      validityDays: order.validityDays,
      startDate: order.startDate ?? undefined,
      endDate: order.endDate ?? undefined,
      referenceId: fulfilment.reference,
    };
    return order.kind === 'TOPUP'
      ? this.celitech.topUp({ ...request, iccid: order.targetIccid! })
      : this.celitech.provision(request);
  }

  /**
   * Resolve an attempt whose outcome is unknown. Live supplier calls are
   * looked up by reference only; mock purchases are free to repeat.
   */
  private async recover(
    order: OrderForProvisioning,
    fulfilment: Fulfilment,
  ): Promise<EsimProfile> {
    const profile = this.celitech.isMock
      ? await this.purchase(order, fulfilment)
      : await this.celitech.findByReference(fulfilment.reference);
    if (!profile) {
      throw new Error(
        'Supplier outcome unconfirmed; do not retry purchase automatically.',
      );
    }
    return profile;
  }

  /** Mark the order complete and accrue partner commission in one transaction. */
  private async completeIfDelivered(order: OrderForProvisioning) {
    const incomplete = await this.prisma.fulfilment.count({
      where: { orderId: order.id, state: { not: 'COMPLETE' } },
    });
    if (incomplete) return;
    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: { status: 'COMPLETED', failureReason: null },
      });
      if (!order.partnerCode || order.kind !== 'PURCHASE') return;
      const partner = await tx.partner.findUnique({
        where: { slug: order.partnerCode.toLowerCase() },
      });
      if (partner?.status !== 'ACTIVE') return;
      // upsert on the unique orderId keeps a replayed completion from double-accruing.
      await tx.commission.upsert({
        where: { orderId: order.id },
        update: {},
        create: {
          orderId: order.id,
          partnerId: partner.id,
          amountKes: money(
            Number(order.totalKes) * Number(partner.commissionPct),
          ),
          state: 'ACCRUED',
        },
      });
    });
  }

  private async saveProfile(
    order: Order,
    fulfilmentId: string,
    p: EsimProfile,
  ) {
    const initial = order.unlimited ? -1n : BigInt(order.dataMb) * 1000000n;
    const expiry = p.endDate
      ? new Date(p.endDate.length === 10 ? p.endDate + 'T23:59:59Z' : p.endDate)
      : null;
    const created = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.fulfilment.updateMany({
        where: { id: fulfilmentId, state: { not: 'COMPLETE' } },
        data: { state: 'COMPLETE' },
      });
      if (!claimed.count) return null;
      // A guest may have verified their email while supplier fulfilment was in flight.
      const currentOrder = await tx.order.findUniqueOrThrow({
        where: { id: order.id },
        select: { userId: true },
      });
      const esim =
        order.kind === 'TOPUP'
          ? await tx.esim.findUniqueOrThrow({
              where: { iccid: order.targetIccid! },
            })
          : await tx.esim.create({
              data: {
                userId: currentOrder.userId,
                orderId: order.id,
                iccid: p.iccid,
                smdpAddress: p.smdpAddress,
                matchingId: p.matchingId,
                lpa: p.lpa,
                providerPurchaseId: p.providerPurchaseId,
                dataMb: order.dataMb,
                validityDays: order.validityDays,
                supplierMode: order.supplierMode,
                unlimited: order.unlimited,
                initialBytes: initial,
                remainingBytes: initial,
                expiresAt: expiry,
              },
            });
      await tx.fulfilment.update({
        where: { id: fulfilmentId },
        data: {
          purchaseId: p.providerPurchaseId,
          esimId: esim.id,
          initialBytes: initial,
          remainingBytes: initial,
          startsAt: p.startDate ? new Date(p.startDate) : null,
          expiresAt: expiry,
          error: null,
        },
      });
      await tx.ledgerEntry.create({
        data: {
          orderId: order.id,
          account: 'cogs',
          direction: 'debit',
          amountKes: money(Number(order.baseUsd)),
          memo: 'USD supplier cost: ' + fulfilmentId,
        },
      });
      if (order.kind === 'TOPUP') {
        const packages = await tx.fulfilment.findMany({
          where: { esimId: esim.id, state: 'COMPLETE' },
        });
        const active = packages.filter(
          (x) => !x.expiresAt || x.expiresAt.getTime() > Date.now(),
        );
        const isUnlimited = active.some((x) => x.initialBytes === -1n);
        const knownDates = active.flatMap((x) =>
          x.expiresAt ? [x.expiresAt.getTime()] : [],
        );
        await tx.esim.update({
          where: { id: esim.id },
          data: {
            initialBytes: isUnlimited
              ? -1n
              : active.reduce((n, x) => n + x.initialBytes, 0n),
            remainingBytes: isUnlimited
              ? -1n
              : active.reduce((n, x) => n + x.remainingBytes, 0n),
            unlimited: isUnlimited,
            expiresAt:
              active.length && knownDates.length === active.length
                ? new Date(Math.max(...knownDates))
                : null,
            usageUpdatedAt: null,
            alertedThresholds: { set: [] },
            expiryAlerted: false,
          },
        });
      }
      return esim;
    });
    if (
      created &&
      order.kind !== 'TOPUP' &&
      this.config.get('BACKGROUND_MODE') !== 'cloud-tasks'
    ) {
      const event: EsimProvisionedEvent = {
        orderId: order.id,
        esimId: created.id,
        userId: created.userId,
        customerPhone: order.customerPhone,
        customerEmail: order.customerEmail,
        title: order.title,
        lpa: created.lpa,
      };
      this.events.emit(Events.EsimProvisioned, event);
    }
  }

  private review(orderId: string, reason: string) {
    return markForManualReview(this.prisma, this.logger, orderId, reason);
  }
}
