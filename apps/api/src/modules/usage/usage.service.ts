import { Injectable, NotFoundException } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import QRCode from 'qrcode';
import { buildEsimPdf } from '../notifications/esim-pdf.js';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  Events,
  type UsageThresholdEvent,
  type EsimExpiringEvent,
} from '../../common/events.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CelitechService } from '../../integrations/celitech/celitech.service.js';

export interface UsageDto {
  initialBytes: number;
  remainingBytes: number;
  usedBytes: number;
  pctUsed: number;
  remainingLabel: string;
  totalLabel: string;
  expiresAt: string | null;
  daysLeft: number | null;
  unlimited?: boolean;
}
@Injectable()
export class UsageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly celitech: CelitechService,
    private readonly events: EventEmitter2,
  ) {}
  private async owned(id: string, userId?: string, token?: string) {
    const esim = await this.prisma.esim.findUnique({
      where: { id },
      include: { order: true },
    });
    const a = Buffer.from(token ?? ''),
      b = Buffer.from(esim?.order.accessToken ?? '');
    if (
      !esim ||
      !(
        (userId && esim.userId === userId) ||
        (a.length > 0 && a.length === b.length && timingSafeEqual(a, b))
      )
    )
      throw new NotFoundException('eSIM not found.');
    return esim;
  }
  async getQrPng(id: string, userId?: string, token?: string) {
    const e = await this.owned(id, userId, token);
    return QRCode.toBuffer(e.lpa, { width: 900, margin: 4 });
  }
  async getInstallationPdf(id: string, userId?: string, token?: string) {
    const e = await this.owned(id, userId, token);
    return buildEsimPdf({
      title: e.order.title,
      lpa: e.lpa,
      iccid: e.iccid,
      smdpAddress: e.smdpAddress,
      matchingId: e.matchingId,
    });
  }
  async getUsage(
    id: string,
    userId?: string,
    token?: string,
  ): Promise<UsageDto> {
    const e = await this.owned(id, userId, token);
    if (!e.usageUpdatedAt || Date.now() - e.usageUpdatedAt.getTime() > 60000) {
      try {
        await this.refresh(id);
      } catch {
        /* Retain the last confirmed balance on a supplier outage. */
      }
    }
    const current = await this.prisma.esim.findUniqueOrThrow({ where: { id } });
    const initial = Number(current.initialBytes),
      remaining = Number(current.remainingBytes),
      unlimited = initial === -1 || remaining === -1;
    const used = unlimited ? 0 : Math.max(0, initial - remaining);
    return {
      initialBytes: initial,
      remainingBytes: remaining,
      usedBytes: used,
      pctUsed: unlimited
        ? 0
        : initial > 0
          ? Math.min(100, Math.round((used / initial) * 100))
          : 0,
      unlimited,
      remainingLabel: unlimited ? 'Unlimited' : formatBytes(remaining),
      totalLabel: unlimited ? 'Unlimited' : formatBytes(initial),
      expiresAt: current.expiresAt?.toISOString() ?? null,
      daysLeft: current.expiresAt
        ? Math.max(
            0,
            Math.ceil((current.expiresAt.getTime() - Date.now()) / 86400000),
          )
        : null,
    };
  }
  async getDevice(id: string, userId?: string, token?: string) {
    const e = await this.owned(id, userId, token);
    return e.supplierMode === 'mock' ? null : this.celitech.getDevice(e.iccid);
  }
  async getHistory(id: string, userId?: string, token?: string) {
    const e = await this.owned(id, userId, token);
    return e.supplierMode === 'mock' ? [] : this.celitech.getHistory(e.iccid);
  }

  async refresh(id: string) {
    const esim = await this.prisma.esim.findUniqueOrThrow({
      where: { id },
      include: { packages: true },
    });
    if (esim.supplierMode !== (this.celitech.isMock ? 'mock' : 'live')) return; // Never query synthetic inventory live.
    const packages = esim.packages.filter((p) => p.state === 'COMPLETE');
    if (!packages.length) return; // Historical snapshots stay intact; no fabricated expiry.
    for (const p of packages) {
      if (!p.purchaseId || this.celitech.isMock) continue;
      const [usage, details] = await Promise.all([
        this.celitech.getConsumption(p.purchaseId),
        this.celitech.getPurchase(p.purchaseId),
      ]);
      if (!usage || !details) continue;
      await this.prisma.fulfilment.update({
        where: { id: p.id },
        data: {
          remainingBytes: BigInt(usage.remainingBytes),
          startsAt: details.startDate ? new Date(details.startDate) : null,
          expiresAt: details.endDate ? new Date(details.endDate) : null,
        },
      });
    }
    const fresh = await this.prisma.fulfilment.findMany({
      where: { esimId: id, state: 'COMPLETE' },
    });
    const usable = fresh.filter(
      (p) => !p.expiresAt || p.expiresAt.getTime() > Date.now(),
    );
    const unlimited = usable.some((p) => p.initialBytes === -1n);
    const initial = unlimited
      ? -1n
      : usable.reduce((n, p) => n + p.initialBytes, 0n);
    const remaining = unlimited
      ? -1n
      : usable.reduce((n, p) => n + p.remainingBytes, 0n);
    const known = usable
      .map((p) => p.expiresAt?.getTime())
      .filter((x): x is number => x !== undefined);
    const expiredDates = fresh.flatMap((p) =>
      p.expiresAt ? [p.expiresAt.getTime()] : [],
    );
    const expiresAt =
      usable.length && known.length === usable.length
        ? new Date(Math.max(...known))
        : !usable.length && expiredDates.length
          ? new Date(Math.max(...expiredDates))
          : null;
    await this.prisma.esim.update({
      where: { id },
      data: {
        initialBytes: initial,
        remainingBytes: remaining,
        unlimited,
        expiresAt,
        usageUpdatedAt: new Date(),
      },
    });
    await this.recordAlerts(id, Number(initial), Number(remaining));
  }

  async pollActive() {
    const rows = await this.prisma.esim.findMany({
      where: {
        supplierMode: this.celitech.isMock ? 'mock' : 'live',
        packages: { some: { state: 'COMPLETE' } },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      take: 100,
      orderBy: { usageUpdatedAt: { sort: 'asc', nulls: 'first' } },
    });
    for (const e of rows) {
      try {
        await this.refresh(e.id);
      } catch {
        /* Keep last known reading, retry next sweep. */
      }
    }
    return rows.length;
  }
  async processWebhooks(limit = 100) {
    const rows = await this.prisma.webhookEvent.findMany({
      where: {
        source: 'celitech',
        signatureOk: true,
        processedAt: null,
        nextAttemptAt: { lte: new Date() },
      },
      orderBy: { nextAttemptAt: 'asc' },
      take: limit,
    });
    for (const row of rows) {
      await this.prisma.webhookEvent.update({
        where: { id: row.id },
        data: { nextAttemptAt: new Date(Date.now() + 300000) },
      });
      const payload = row.raw as { purchaseId: string };
      const f = await this.prisma.fulfilment.findUnique({
        where: { purchaseId: payload.purchaseId },
        include: { esim: true },
      });
      // An event may arrive before the purchase response was persisted.
      if (!f?.esimId || f.esim?.supplierMode !== 'live') continue;
      try {
        await this.refresh(f.esimId);
        await this.prisma.webhookEvent.update({
          where: { id: row.id },
          data: { processedAt: new Date() },
        });
      } catch {
        /* durable row remains pending for retry */
      }
    }
  }
  async checkExpiring() {
    const rows = await this.prisma.esim.findMany({
      where: {
        expiryAlerted: false,
        expiresAt: { gt: new Date(), lte: new Date(Date.now() + 3 * 86400000) },
      },
      include: { order: true },
      take: 500,
    });
    for (const e of rows) {
      const claim = await this.prisma.esim.updateMany({
        where: { id: e.id, expiryAlerted: false },
        data: { expiryAlerted: true },
      });
      if (claim.count)
        await this.events.emitAsync(Events.EsimExpiring, {
          esimId: e.id,
          userId: e.userId,
          title: e.order.title,
          daysLeft: Math.ceil((e.expiresAt!.getTime() - Date.now()) / 86400000),
        } satisfies EsimExpiringEvent);
    }
  }
  private async recordAlerts(id: string, initial: number, remaining: number) {
    const pct =
      initial > 0
        ? Math.min(
            100,
            Math.max(0, Math.floor(((initial - remaining) / initial) * 100)),
          )
        : 0;
    const e = await this.prisma.esim.findUniqueOrThrow({
      where: { id },
      include: { order: true },
    });
    await this.prisma.usageSnapshot.create({
      data: {
        esimId: id,
        remainingBytes: BigInt(remaining),
        pctUsed: pct,
        source: 'poll',
      },
    });
    for (const threshold of [50, 80, 100] as const) {
      if (pct < threshold) continue;
      const claim = await this.prisma.esim.updateMany({
        where: { id, NOT: { alertedThresholds: { has: threshold } } },
        data: { alertedThresholds: { push: threshold } },
      });
      if (claim.count)
        await this.events.emitAsync(Events.UsageThreshold, {
          esimId: id,
          userId: e.userId,
          title: e.order.title,
          threshold,
          initialBytes: initial,
          remainingBytes: remaining,
        } satisfies UsageThresholdEvent);
    }
  }
  async applyUsage(
    esimId: string,
    _initial: number,
    _remaining: number,
    _source: 'poll' | 'webhook',
  ) {
    await this.refresh(esimId);
  }
}
function formatBytes(n: number) {
  return n >= 1e9 ? (n / 1e9).toFixed(2) + ' GB' : (n / 1e6).toFixed(0) + ' MB';
}
