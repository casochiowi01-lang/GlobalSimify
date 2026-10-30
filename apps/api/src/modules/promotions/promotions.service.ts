import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';

export interface PromoPreview {
  valid: boolean;
  code: string;
  discountKes: number;
  reason?: string;
}

@Injectable()
export class PromotionsService {
  private readonly logger = new Logger(PromotionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Validate a code against a subtotal and compute the discount (no side effects). */
  async preview(rawCode: string, subtotalKes: number): Promise<PromoPreview> {
    const code = rawCode.trim().toUpperCase();
    if (!code) return { valid: false, code, discountKes: 0, reason: 'No code' };

    const promo = await this.prisma.promotion.findUnique({ where: { code } });
    const now = new Date();
    if (!promo || !promo.active) {
      return { valid: false, code, discountKes: 0, reason: 'Invalid code' };
    }
    if (promo.validFrom && promo.validFrom > now) {
      return { valid: false, code, discountKes: 0, reason: 'Not yet active' };
    }
    if (promo.validTo && promo.validTo < now) {
      return { valid: false, code, discountKes: 0, reason: 'Expired' };
    }
    if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
      return {
        valid: false,
        code,
        discountKes: 0,
        reason: 'Usage limit reached',
      };
    }
    if (promo.minSpendKes && subtotalKes < Number(promo.minSpendKes)) {
      return {
        valid: false,
        code,
        discountKes: 0,
        reason: `Minimum spend KES ${Number(promo.minSpendKes)}`,
      };
    }

    const value = Number(promo.value);
    let discount =
      promo.kind === 'PERCENT' ? (subtotalKes * value) / 100 : value;
    discount = Math.min(Math.round(discount), subtotalKes);
    return { valid: true, code, discountKes: discount };
  }

  /**
   * Record a redemption after a successful payment. Never fails the payment:
   * a missed increment only under-counts usage, so it is logged for follow-up.
   */
  async redeem(rawCode: string): Promise<void> {
    const code = rawCode.trim().toUpperCase();
    try {
      await this.prisma.promotion.update({
        where: { code },
        data: { usedCount: { increment: 1 } },
      });
    } catch (err) {
      this.logger.warn(
        `Could not record redemption of promo ${code}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // --- admin -------------------------------------------------------------

  async create(data: {
    code: string;
    kind: 'PERCENT' | 'FIXED';
    value: number;
    minSpendKes?: number;
    maxUses?: number;
    validTo?: string;
  }) {
    return this.prisma.promotion.create({
      data: {
        code: data.code.trim().toUpperCase(),
        kind: data.kind,
        value: new Prisma.Decimal(data.value),
        minSpendKes:
          data.minSpendKes !== undefined
            ? new Prisma.Decimal(data.minSpendKes)
            : null,
        maxUses: data.maxUses ?? null,
        validTo: data.validTo ? new Date(data.validTo) : null,
      },
    });
  }

  list() {
    return this.prisma.promotion.findMany({ orderBy: { createdAt: 'desc' } });
  }
}
