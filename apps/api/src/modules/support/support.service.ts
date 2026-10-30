import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class SupportService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: {
    userId?: string;
    esimId?: string;
    category?: string;
    message: string;
  }) {
    // Attach diagnostics only for an eSIM the signed-in caller owns.
    let diagnostics: Record<string, unknown> | undefined;
    if (input.esimId && input.userId) {
      const esim = await this.prisma.esim.findFirst({
        where: { id: input.esimId, userId: input.userId },
      });
      if (esim) {
        diagnostics = {
          iccid: esim.iccid,
          profileStatus: esim.profileStatus,
          remainingBytes: Number(esim.remainingBytes),
          expiresAt: esim.expiresAt,
        };
      }
    }
    const ticket = await this.prisma.ticket.create({
      data: {
        userId: input.userId,
        esimId: diagnostics ? input.esimId : undefined,
        category: input.category ?? 'general',
        message: input.message,
        diagnostics: diagnostics as Prisma.InputJsonValue | undefined,
      },
    });
    return { id: ticket.id, status: ticket.status };
  }

  listForUser(userId: string) {
    return this.prisma.ticket.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // --- admin ---
  listAll(status?: string) {
    return this.prisma.ticket.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  reply(id: string, reply: string) {
    return this.prisma.ticket.update({
      where: { id },
      data: { reply, status: 'RESOLVED' },
    });
  }
}
