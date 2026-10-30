import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID, createHash, timingSafeEqual } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CatalogService } from '../catalog/catalog.service.js';
import { PricingService } from '../pricing/pricing.service.js';
import { CelitechService } from '../../integrations/celitech/celitech.service.js';
import { travelWindow } from '../../integrations/celitech/travel-window.js';
import { PaystackService } from '../../integrations/paystack/paystack.service.js';
import { AppConfigService } from '../../config/config.module.js';
import { PromotionsService } from '../promotions/promotions.service.js';
import { normalizePhone } from '../auth/phone.util.js';
import { money } from './money.js';

export interface QuoteInput {
  productId: string;
  startDate?: string;
  endDate?: string;
  quantity?: number;
  promoCode?: string;
}
export interface CreateOrderInput extends QuoteInput {
  phone: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  compatAttested: boolean;
  validityDays?: number;
  userId?: string;
  partnerCode?: string;
  idempotencyKey?: string;
  expectedTotal?: number;
  expectedChargeAmount?: number;
}
export interface CreateTopUpInput extends QuoteInput {
  esimId?: string;
  iccid?: string;
  userId: string;
  idempotencyKey?: string;
  expectedTotal?: number;
  expectedChargeAmount?: number;
}
/**
 * Checkout: server-side quotes, live-sales gating, and idempotent creation of
 * purchase and top-up orders. Provisioning and refunds live in their own services.
 */
@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
    private readonly pricing: PricingService,
    private readonly celitech: CelitechService,
    private readonly paystack: PaystackService,
    private readonly promotions: PromotionsService,
    private readonly config: AppConfigService,
  ) {}

  async quote(input: QuoteInput) {
    const product = this.catalog.getProduct(input.productId);
    const base = this.catalog.getBaseUsd(input.productId);
    if (!product || base === undefined)
      throw new NotFoundException('Plan not found. Refresh the catalogue.');
    const quantity = input.quantity ?? 1;
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 5)
      throw new BadRequestException('Choose 1–5 eSIMs.');
    const window = travelWindow(
      input.startDate,
      input.endDate,
      product.unlimited,
      product.validityDays,
    );
    if (window.days < product.minDays || window.days > product.validityDays)
      throw new BadRequestException(
        'Choose the plan matching your travel duration.',
      );
    let wholesale = product.unlimited ? base * window.days : base;
    let packageId = product.providerPackageId;
    if (!this.celitech.isMock) {
      const q = await this.celitech.quote(
        product.supplierDestination,
        product.unlimited ? -1 : product.dataMb / 1000,
        window.startDate,
        window.endDate,
        window.days,
      );
      wholesale = q.priceUsd;
      packageId = q.packageId;
    }
    const price = await this.pricing.priceUsd(wholesale, true);
    const subtotal = Number(money(price.retailKes).mul(quantity));
    const promo = input.promoCode
      ? await this.promotions.preview(input.promoCode, subtotal)
      : null;
    if (promo && !promo.valid)
      throw new BadRequestException(
        promo.reason ?? 'Promo code is not available.',
      );
    const discount = promo?.discountKes ?? 0;
    return {
      product,
      window,
      quantity,
      wholesale,
      packageId,
      price,
      promoCode: promo?.code,
      subtotal,
      discount,
      total: Number(money(Math.max(0, subtotal - discount))),
    };
  }

  private async assertSalesMode(userId?: string) {
    if (
      !this.celitech.isMock &&
      (this.config.get('LIVE_SALES_ENABLED') !== 'true' ||
        this.paystack.environment !== 'live')
    ) {
      throw new ServiceUnavailableException(
        'Live sales are not enabled yet. No payment has been taken.',
      );
    }
    if (this.celitech.isMock && this.paystack.environment === 'live') {
      throw new ServiceUnavailableException(
        'Real payments cannot purchase demonstration eSIMs.',
      );
    }
    if (!(await this.checkoutAvailability(userId)).checkoutEnabled) {
      throw new ServiceUnavailableException(
        'Checkout is restricted to the authenticated launch-test administrator. No payment has been taken.',
      );
    }
  }

  get salesAvailability() {
    const enabled = this.celitech.isMock
      ? this.paystack.environment !== 'live'
      : this.config.get('LIVE_SALES_ENABLED') === 'true' &&
        this.paystack.environment === 'live';
    return {
      checkoutEnabled: enabled,
      checkoutNotice: enabled
        ? null
        : 'Browse plans and check prices now. Purchases and top-ups will open once live payments are enabled. No payment will be taken.',
    };
  }

  async checkoutAvailability(
    userId?: string,
  ): Promise<{ checkoutEnabled: boolean; checkoutNotice: string | null }> {
    const availability = this.salesAvailability;
    if (
      availability.checkoutEnabled &&
      this.config.get('BACKGROUND_MODE') === 'cloud-tasks'
    ) {
      const heartbeats = await Promise.all(
        [
          'worker.lastRecoveryAt',
          'worker.lastSuccess.reconcile',
          'worker.lastSuccess.emails',
        ].map((key) => this.prisma.setting.findUnique({ where: { key } })),
      );
      if (
        heartbeats.some((row) => {
          const at = Number(row?.value);
          return (
            !Number.isFinite(at) ||
            at > Date.now() ||
            Date.now() - at > 15 * 60000
          );
        })
      ) {
        return {
          checkoutEnabled: false,
          checkoutNotice:
            'Delivery services are temporarily unavailable. Please try again later; no payment will be taken.',
        };
      }
    }
    if (
      availability.checkoutEnabled &&
      this.config.get('LIVE_SALES_ADMIN_ONLY') === 'true'
    ) {
      const user = userId
        ? await this.prisma.user.findUnique({
            where: { id: userId },
            select: { role: true, status: true },
          })
        : null;
      if (user?.role !== 'ADMIN' || user.status !== 'ACTIVE')
        return {
          checkoutEnabled: false,
          checkoutNotice:
            'Final live-payment testing is in progress. Customer checkout will open shortly. No payment will be taken.',
        };
      return {
        checkoutEnabled: true,
        checkoutNotice:
          'Administrator launch test: this payment and eSIM purchase use real money.',
      };
    }
    return availability;
  }

  async createOrder(input: CreateOrderInput) {
    return this.createPricedOrder(input, 'PURCHASE');
  }

  private async createPricedOrder(
    input: CreateOrderInput,
    kind: 'PURCHASE' | 'TOPUP',
    targetIccid?: string,
    prepared?: Awaited<ReturnType<OrdersService['quote']>>,
  ) {
    await this.assertSalesMode(input.userId);
    if (!input.compatAttested)
      throw new BadRequestException(
        'Confirm your device supports eSIM and is carrier-unlocked.',
      );
    const phone = normalizePhone(input.phone);
    if (!phone)
      throw new BadRequestException(
        'Enter a valid phone number with country code.',
      );
    const email = input.email?.trim().toLowerCase();
    if (!email)
      throw new BadRequestException(
        'An email address is required for delivery.',
      );
    const q = prepared ?? (await this.quote(input));
    if (!this.celitech.isMock && !q.price.fxApproved)
      throw new ServiceUnavailableException(
        'The store could not confirm its USD to KES conversion rate. Please retry later; no payment was taken.',
      );
    const chargeAmount = money(q.total)
      .mul(q.price.fxRate)
      .toDecimalPlaces(2)
      .toNumber();
    if (
      !this.celitech.isMock &&
      (input.expectedChargeAmount === undefined ||
        Math.abs(chargeAmount - input.expectedChargeAmount) > 0.005)
    ) {
      throw new ConflictException(
        'The KES payment amount changed. Refresh the quote and review it before paying.',
      );
    }
    if (
      input.expectedTotal === undefined ||
      Math.abs(q.total - input.expectedTotal) > 0.005
    )
      throw new ConflictException(
        'The price changed. Review the updated total before paying.',
      );
    if (q.total <= 0)
      throw new BadRequestException('This order cannot be paid at zero value.');
    const idempotencyKey = input.idempotencyKey ?? randomUUID();
    const requestHash = createHash('sha256')
      .update(
        JSON.stringify([
          kind,
          targetIccid ?? null,
          input.userId ?? null,
          email,
          phone,
          input.productId,
          q.window,
          q.quantity,
          q.promoCode ?? null,
        ]),
      )
      .digest('hex');
    const existing = await this.prisma.order.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      if (existing.requestHash !== requestHash)
        throw new ConflictException(
          'Checkout key was already used for another selection.',
        );
      return existing;
    }
    try {
      return await this.prisma.order.create({
        data: {
          kind,
          targetIccid,
          userId: input.userId,
          status: 'DRAFT',
          productId: q.product.id,
          providerPackageId: q.packageId,
          destinationIso: q.product.destIso,
          supplierDestination: q.product.supplierDestination,
          supplierMode: this.celitech.isMock ? 'mock' : 'live',
          unlimited: q.product.unlimited,
          title: (kind === 'TOPUP' ? 'Top-up: ' : '') + q.product.title,
          dataMb: q.product.dataMb,
          validityDays: q.window.days,
          quantity: q.quantity,
          startDate: q.window.startDate,
          endDate: q.window.endDate,
          baseUsd: new Prisma.Decimal(q.wholesale),
          fxRate: new Prisma.Decimal(q.price.fxRate),
          unitPriceKes: money(q.price.retailKes),
          discountKes: money(q.discount),
          totalKes: money(q.total),
          customerPhone: phone,
          customerEmail: email,
          customerName:
            [input.firstName, input.lastName]
              .filter(Boolean)
              .join(' ')
              .trim() || undefined,
          compatAttested: true,
          attestedAt: new Date(),
          partnerCode: input.partnerCode,
          promoCode: q.promoCode,
          idempotencyKey,
          requestHash,
          fulfilments: {
            create: Array.from({ length: q.quantity }, (_, index) => ({
              index,
              reference: randomUUID(),
            })),
          },
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        const raced = await this.prisma.order.findUnique({
          where: { idempotencyKey },
        });
        if (raced?.requestHash === requestHash) return raced;
        throw new ConflictException(
          'Checkout key was already used for another selection.',
        );
      }
      throw e;
    }
  }

  async createTopUp(input: CreateTopUpInput) {
    await this.assertSalesMode(input.userId);
    const esim = await this.prisma.esim.findFirst({
      where: {
        ...(input.esimId ? { id: input.esimId } : { iccid: input.iccid ?? '' }),
        userId: input.userId,
      },
      include: { order: true },
    });
    if (!esim) throw new NotFoundException('eSIM not found in your account.');
    if (esim.supplierMode !== (this.celitech.isMock ? 'mock' : 'live'))
      throw new BadRequestException(
        'Test eSIMs cannot be topped up in live mode.',
      );
    const q = await this.quote({ ...input, quantity: 1 });
    if (q.product.destIso !== esim.order.destinationIso)
      throw new BadRequestException(
        'Select a top-up for the same destination as this eSIM.',
      );
    if (!(await this.celitech.canTopUp(esim.iccid)))
      throw new BadRequestException('This eSIM is not eligible for a top-up.');
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: input.userId },
    });
    // Create via common pricing/idempotency path. Profile details are not requested again.
    return this.createPricedOrder(
      {
        ...input,
        quantity: 1,
        phone: user.phone || esim.order.customerPhone,
        email: user.email || esim.order.customerEmail || undefined,
        compatAttested: true,
      },
      'TOPUP',
      esim.iccid,
      q,
    );
  }

  async getOrder(orderId: string, userId?: string, token?: string) {
    const o = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { esims: true, payment: true },
    });
    const a = Buffer.from(token ?? '');
    const b = Buffer.from(o?.accessToken ?? '');
    const tokenOk =
      a.length > 0 && a.length === b.length && timingSafeEqual(a, b);
    if (!o || !((userId && o.userId === userId) || tokenOk))
      throw new NotFoundException(
        'Order not found. Sign in with your purchase email.',
      );
    return o;
  }

  listForUser(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { esims: true, payment: true },
    });
  }
  listRecent(status?: string, limit = 100) {
    return this.prisma.order.findMany({
      where: status ? { status: status as never } : {},
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { esims: true, payment: true },
    });
  }
}
