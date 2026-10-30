import { Injectable, BadRequestException } from '@nestjs/common';
import { travelWindow } from '../../integrations/celitech/travel-window.js';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { OrdersService } from '../orders/orders.service.js';
import { RefundsService } from '../orders/refunds.service.js';
import { ProvisioningQueue } from '../orders/provisioning.queue.js';
import { CelitechService } from '../../integrations/celitech/celitech.service.js';
import { CatalogService } from '../catalog/catalog.service.js';
import { PricingService } from '../pricing/pricing.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import {
  UsersService,
  type AdminRole,
  type AdminStatus,
} from '../users/users.service.js';

// Order statuses that represent realized (paid) revenue.
const PAID_STATUSES = ['PAID', 'PROVISIONING', 'PROVISIONED', 'COMPLETED'];

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    private readonly provisioning: ProvisioningQueue,
    private readonly celitech: CelitechService,
    private readonly catalog: CatalogService,
    private readonly pricing: PricingService,
    private readonly settings: SettingsService,
    private readonly users: UsersService,
    private readonly notifications: NotificationsService,
    private readonly refunds: RefundsService,
  ) {}

  /** Resend an order's eSIM (email + WhatsApp) on behalf of a customer. */
  async resendEsim(orderId: string) {
    const esims = await this.prisma.esim.findMany({ where: { orderId } });
    if (!esims.length)
      return { ok: false, reason: 'No eSIM for this order yet.' };
    for (const esim of esims) await this.notifications.resendEsim(esim.id);
    return { ok: true };
  }

  async dashboard() {
    // Revenue + COGS are computed straight from the order rows (platform
    // currency is USD): revenue = totalKes, COGS = baseUsd × quantity. This
    // avoids depending on ledger account-name conventions.
    const [ordersByStatus, esimCount, customerCount, totalsRows, topRows] =
      await Promise.all([
        this.prisma.order.groupBy({ by: ['status'], _count: true }),
        this.prisma.esim.count(),
        this.prisma.user.count({ where: { role: 'CUSTOMER' } }),
        this.prisma.$queryRaw<
          Array<{ revenue: number; cogs: number; orders: bigint }>
        >(
          Prisma.sql`
            SELECT COALESCE(SUM("totalKes"), 0)::float8 AS revenue,
                   COALESCE(SUM("baseUsd" * "quantity"), 0)::float8 AS cogs,
                   COUNT(*) AS orders
            FROM "orders"
            WHERE "status" = ANY(${PAID_STATUSES})`,
        ),
        this.prisma.$queryRaw<
          Array<{ destination: string; revenue: number; orders: bigint }>
        >(
          Prisma.sql`
            SELECT "title" AS destination,
                   COALESCE(SUM("totalKes"), 0)::float8 AS revenue,
                   COUNT(*) AS orders
            FROM "orders"
            WHERE "status" = ANY(${PAID_STATUSES})
            GROUP BY "title" ORDER BY revenue DESC LIMIT 6`,
        ),
      ]);

    const t = totalsRows[0] ?? { revenue: 0, cogs: 0, orders: 0n };
    const revenue = round2(Number(t.revenue));
    const cogs = round2(Number(t.cogs));
    const grossProfit = round2(revenue - cogs);
    const marginPct = revenue > 0 ? round2((grossProfit / revenue) * 100) : 0;

    return {
      revenue,
      cogs,
      grossProfit,
      marginPct,
      paidOrders: Number(t.orders),
      esimsIssued: esimCount,
      customers: customerCount,
      currency: 'USD',
      ordersByStatus: ordersByStatus.map((o) => ({
        status: o.status,
        count: o._count,
      })),
      topDestinations: topRows.map((r) => ({
        destination: r.destination,
        revenue: round2(Number(r.revenue)),
        orders: Number(r.orders),
      })),
      supplier: { name: 'Celitech', billingModel: this.celitech.billingModel },
    };
  }

  /** Revenue / COGS / profit bucketed over time for the analytics charts. */
  async analytics(fromISO?: string, toISO?: string, granularity = 'day') {
    const gran = ['day', 'week', 'month'].includes(granularity)
      ? granularity
      : 'day';
    const to = toISO ? new Date(toISO) : new Date();
    const from = fromISO
      ? new Date(fromISO)
      : new Date(to.getTime() - 30 * 86_400_000);
    const rows = await this.prisma.$queryRaw<
      Array<{ period: Date; revenue: number; cogs: number; orders: bigint }>
    >(Prisma.sql`
      SELECT date_trunc(${gran}, "createdAt") AS period,
             COALESCE(SUM("totalKes"), 0)::float8 AS revenue,
             COALESCE(SUM("baseUsd" * "quantity"), 0)::float8 AS cogs,
             COUNT(*) AS orders
      FROM "orders"
      WHERE "status" = ANY(${PAID_STATUSES})
        AND "createdAt" >= ${from} AND "createdAt" <= ${to}
      GROUP BY 1 ORDER BY 1`);
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      granularity: gran,
      currency: 'USD',
      series: rows.map((r) => {
        const revenue = round2(Number(r.revenue));
        const cogs = round2(Number(r.cogs));
        return {
          period: r.period,
          revenue,
          cogs,
          profit: round2(revenue - cogs),
          orders: Number(r.orders),
        };
      }),
    };
  }

  /** Double-entry reconciliation: ledger totals vs payments vs refunds. */
  async reconciliation() {
    const entries = await this.prisma.ledgerEntry.groupBy({
      by: ['account', 'direction'],
      _sum: { amountKes: true },
    });
    const ledger: Record<string, { debit: number; credit: number }> = {};
    for (const e of entries) {
      ledger[e.account] ??= { debit: 0, credit: 0 };
      ledger[e.account][e.direction as 'debit' | 'credit'] = Number(
        e._sum.amountKes ?? 0,
      );
    }
    const paymentsCompleted = Number(
      (
        await this.prisma.payment.aggregate({
          where: { state: 'COMPLETE' },
          _sum: { amountKes: true },
        })
      )._sum.amountKes ?? 0,
    );
    const refundsTotal = Number(
      (
        await this.prisma.refund.aggregate({
          where: { state: 'completed' },
          _sum: { amountKes: true },
        })
      )._sum.amountKes ?? 0,
    );
    const revenueLedger = ledger['customer_revenue']?.credit ?? 0;
    const cogs = ledger['cogs']?.debit ?? 0;

    return {
      ledger,
      paymentsCompletedKes: paymentsCompleted,
      refundsKes: refundsTotal,
      revenueLedgerKes: revenueLedger,
      cogsKes: cogs,
      grossMarginKes: revenueLedger - cogs - refundsTotal,
      // Revenue recorded in the ledger should equal completed payments.
      balanced: Math.abs(revenueLedger - paymentsCompleted) < 1,
    };
  }

  retryProvision(orderId: string) {
    // Enqueue on the durable queue (falls back to in-process without Redis).
    return this.provisioning.enqueue(orderId).then(() => ({ ok: true }));
  }

  refund(orderId: string) {
    return this.refunds
      .refundOrder(orderId, 'admin_manual')
      .then(() => ({ ok: true }));
  }

  async listOrders(status?: string) {
    const rows = await this.orders.listRecent(status);
    return rows.map((o) => this.withProfit(o));
  }

  /** Enrich a raw order with revenue / COGS / profit (all USD). */
  private withProfit(
    o: Awaited<ReturnType<OrdersService['listRecent']>>[number],
  ) {
    const revenue = o.payment?.state === 'COMPLETE' ? Number(o.totalKes) : 0;
    const cogs =
      o.kind === 'TOPUP'
        ? o.status === 'COMPLETED'
          ? Number(o.baseUsd)
          : 0
        : Number(o.baseUsd) * (o.esims?.length ?? 0);
    return {
      id: o.id,
      status: o.status,
      kind: o.kind,
      title: o.title,
      customerEmail: o.customerEmail,
      customerPhone: o.customerPhone,
      customerName: o.customerName,
      createdAt: o.createdAt,
      currency: o.currency,
      revenue: round2(revenue),
      cogs: round2(cogs),
      profit: round2(revenue - cogs),
      promoCode: o.promoCode,
      failureReason: o.failureReason,
      esim: o.esims?.[0]
        ? { id: o.esims[0].id, iccid: o.esims[0].iccid }
        : null,
      esims: o.esims?.map((e) => ({ id: e.id, iccid: e.iccid })) ?? [],
      quantity: o.quantity,
      supplierMode: o.supplierMode,
      paymentEnvironment: o.payment?.environment,
      payment: o.payment
        ? { state: o.payment.state, method: o.payment.method }
        : null,
    };
  }

  // --- troubleshooting lookups --------------------------------------------

  /** Look up an eSIM by ICCID with its order/customer + live device/history. */
  async lookupByIccid(iccid: string) {
    const esim = await this.prisma.esim.findUnique({
      where: { iccid: iccid.trim() },
      include: { order: true, user: true },
    });
    if (!esim) return { found: false as const };
    const [device, history] = await Promise.all([
      esim.supplierMode === 'live'
        ? this.celitech.getDevice(esim.iccid).catch(() => null)
        : null,
      esim.supplierMode === 'live'
        ? this.celitech.getHistory(esim.iccid).catch(() => [])
        : [],
    ]);
    return {
      found: true as const,
      esim: {
        id: esim.id,
        iccid: esim.iccid,
        smdpAddress: esim.smdpAddress,
        matchingId: esim.matchingId,
        lpa: esim.lpa,
        profileStatus: esim.profileStatus,
        dataMb: esim.dataMb,
        validityDays: esim.validityDays,
        remainingBytes: Number(esim.remainingBytes),
        initialBytes: Number(esim.initialBytes),
        expiresAt: esim.expiresAt,
      },
      order: esim.order ? this.withProfit(esim.order as never) : null,
      customer: esim.user
        ? {
            id: esim.user.id,
            email: esim.user.email,
            name: esim.user.name,
            phone: esim.user.phone,
          }
        : null,
      device,
      history,
    };
  }

  /** Look up a customer's orders by email or phone (troubleshooting). */
  async lookupOrders(args: { email?: string; phone?: string }) {
    const where = args.email
      ? {
          customerEmail: {
            equals: args.email.trim().toLowerCase(),
            mode: 'insensitive' as const,
          },
        }
      : args.phone
        ? { customerPhone: { contains: args.phone.trim() } }
        : null;
    if (!where) return [];
    const rows = await this.prisma.order.findMany({
      where,
      include: { esims: true, payment: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return rows.map((o) => this.withProfit(o as never));
  }

  // --- users / admins ------------------------------------------------------

  listUsers(search?: string) {
    return this.users.listForAdmin(search);
  }
  createUser(input: {
    email: string;
    name?: string;
    phone?: string;
    role?: AdminRole;
  }) {
    return this.users.adminCreate(input);
  }
  updateUser(id: string, data: { role?: AdminRole; status?: AdminStatus }) {
    return this.users.adminUpdate(id, data);
  }

  // --- pricing / reselling margin -----------------------------------------

  getPricing() {
    return this.pricing.effective(true);
  }

  /** Write the runtime pricing knobs (percent values as fractions, e.g. 0.4). */
  async setPricing(input: {
    marginPct?: number;
    fxBufferPct?: number;
    processorFeePct?: number;
    roundTo?: number;
  }) {
    const map: Array<[keyof typeof input, string]> = [
      ['marginPct', 'pricing.marginPct'],
      ['fxBufferPct', 'pricing.fxBufferPct'],
      ['processorFeePct', 'pricing.processorFeePct'],
      ['roundTo', 'pricing.roundTo'],
    ];
    await this.settings.setMany(
      map.flatMap(([field, key]) =>
        typeof input[field] === 'number' ? [{ key, value: input[field] }] : [],
      ),
    );
    // Re-price the in-memory catalogue so displayed prices reflect the change.
    await this.catalog.build();
    return this.pricing.effective(true);
  }

  /** Rebuild + re-price the catalogue from the supplier (admin refresh). */
  async refreshCatalog() {
    await this.catalog.build();
    return { ok: true, products: this.catalog.listProducts().length };
  }

  /**
   * Reschedule an order's eSIM validity window via Celitech (e.g. the trip
   * moved before activation). Looks up the eSIM's provider purchase id.
   */
  async reschedule(orderId: string, startDate: string, endDate: string) {
    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { fulfilments: true },
    });
    if (
      order.status !== 'COMPLETED' ||
      !order.startDate ||
      !order.fulfilments.length
    )
      throw new BadRequestException(
        'Only reconciled, completed orders can be rescheduled.',
      );
    if (order.supplierMode !== (this.celitech.isMock ? 'mock' : 'live'))
      throw new BadRequestException(
        'Supplier environment does not match this order.',
      );
    const today = new Date().toISOString().slice(0, 10);
    if (order.startDate <= today && startDate !== order.startDate)
      throw new BadRequestException(
        'An active package must keep its original start date.',
      );
    const window = travelWindow(
      startDate,
      endDate,
      order.unlimited,
      order.validityDays,
      new Date(order.startDate < today ? order.startDate : today),
    );
    if (
      (order.unlimited && window.days !== order.validityDays) ||
      (!order.unlimited && window.days > 30 !== order.validityDays > 30)
    )
      throw new BadRequestException(
        'Changing the paid duration tier requires a separately paid top-up.',
      );
    let updated = 0;
    for (const f of order.fulfilments) {
      if (!f.purchaseId || !f.esimId || f.state !== 'COMPLETE')
        throw new BadRequestException(
          'Reconcile every eSIM before rescheduling.',
        );
      const applied = await this.celitech.editPurchase(
        f.purchaseId,
        startDate,
        endDate,
      );
      if (!applied.startDate || !applied.endDate)
        throw new BadRequestException(
          'Supplier dates were not confirmed. Reconcile before retrying.',
        );
      await this.prisma.fulfilment.update({
        where: { id: f.id },
        data: {
          startsAt: new Date(applied.startDate),
          expiresAt: new Date(
            applied.endDate.length === 10
              ? applied.endDate + 'T23:59:59Z'
              : applied.endDate,
          ),
        },
      });
      await this.prisma.esim.update({
        where: { id: f.esimId },
        data: { usageUpdatedAt: null, expiryAlerted: false },
      });
      updated++;
    }
    await this.prisma.order.update({
      where: { id: orderId },
      data: { startDate, endDate, validityDays: window.days },
    });
    return { ok: true, startDate, endDate, updated };
  }
}
