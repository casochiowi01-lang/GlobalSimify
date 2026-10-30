import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { PaystackService } from '../../integrations/paystack/paystack.service.js';

const MIN_PAYOUT_KES = 500;
const PAYABLE_STATES = ['ACCRUED', 'PAYABLE'];

@Injectable()
export class PartnersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paystack: PaystackService,
  ) {}

  async apply(input: { name: string; email?: string; mpesaNumber?: string }) {
    const slug = await this.uniqueSlug(input.name);
    const partner = await this.prisma.partner.create({
      data: {
        name: input.name,
        email: input.email,
        mpesaNumber: input.mpesaNumber,
        slug,
      },
    });
    return { id: partner.id, slug: partner.slug, status: partner.status };
  }

  // Commission accrual happens transactionally with order completion in OrdersService.

  async statsForUser(userId: string) {
    const partner = await this.prisma.partner.findUnique({ where: { userId } });
    if (!partner) throw new NotFoundException('No partner account linked.');
    const commissions = await this.prisma.commission.findMany({
      where: { partnerId: partner.id },
    });
    const sum = (s: string) =>
      commissions
        .filter((c) => c.state === s)
        .reduce((t, c) => t + Number(c.amountKes), 0);
    return {
      partner: {
        name: partner.name,
        slug: partner.slug,
        status: partner.status,
        commissionPct: Number(partner.commissionPct),
        mpesaNumber: partner.mpesaNumber,
      },
      conversions: commissions.length,
      payableKes: sum('ACCRUED') + sum('PAYABLE'),
      paidKes: sum('PAID'),
      totalKes: commissions.reduce((t, c) => t + Number(c.amountKes), 0),
      referralLink: `/r/${partner.slug}`,
    };
  }

  async requestPayout(userId: string) {
    const partner = await this.prisma.partner.findUnique({ where: { userId } });
    if (!partner) throw new NotFoundException('No partner account linked.');
    if (!partner.mpesaNumber) {
      throw new BadRequestException(
        'Add your M-Pesa number before requesting a payout.',
      );
    }
    const mpesaNumber = partner.mpesaNumber;
    // Automated Paystack Transfers to M-Pesa need the Transfers feature on the
    // account; until then payouts are recorded as pending for manual settlement.
    return this.prisma.$transaction(async (tx) => {
      const eligible = await tx.commission.findMany({
        where: { partnerId: partner.id, state: { in: PAYABLE_STATES } },
      });
      const amount = eligible.reduce((t, c) => t + Number(c.amountKes), 0);
      if (amount < MIN_PAYOUT_KES) {
        throw new BadRequestException(
          `Minimum payout is KES ${MIN_PAYOUT_KES}.`,
        );
      }
      const payout = await tx.payout.create({
        data: { partnerId: partner.id, amountKes: new Prisma.Decimal(amount) },
      });
      // Claim with the state filter: a concurrent request that read the same
      // commissions finds them already claimed and rolls back.
      const claimed = await tx.commission.updateMany({
        where: {
          id: { in: eligible.map((c) => c.id) },
          state: { in: PAYABLE_STATES },
        },
        data: { state: 'PAID', payoutId: payout.id },
      });
      if (claimed.count !== eligible.length) {
        throw new ConflictException('A payout request is already in progress.');
      }
      const { trackingId } = this.paystack.sendMoney({
        phone: mpesaNumber,
        amountKes: amount,
        name: partner.name,
      });
      await tx.payout.update({
        where: { id: payout.id },
        data: { state: 'pending', trackingId },
      });
      return { requestedKes: amount, trackingId, status: 'pending' as const };
    });
  }

  // --- admin -------------------------------------------------------------

  list() {
    return this.prisma.partner.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async approve(
    partnerId: string,
    opts: { userId?: string; commissionPct?: number },
  ) {
    const partner = await this.prisma.partner.update({
      where: { id: partnerId },
      data: {
        status: 'ACTIVE',
        ...(opts.userId ? { userId: opts.userId } : {}),
        ...(opts.commissionPct !== undefined
          ? { commissionPct: new Prisma.Decimal(opts.commissionPct) }
          : {}),
      },
    });
    if (opts.userId) {
      await this.prisma.user.update({
        where: { id: opts.userId },
        data: { role: 'PARTNER' },
      });
    }
    return partner;
  }

  private async uniqueSlug(name: string): Promise<string> {
    const base =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 32) || 'partner';
    let slug = base;
    let i = 1;
    while (await this.prisma.partner.findUnique({ where: { slug } })) {
      slug = `${base}-${i++}`;
    }
    return slug;
  }
}
