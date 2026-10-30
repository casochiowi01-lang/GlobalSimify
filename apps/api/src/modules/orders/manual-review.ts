import type { Logger } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service.js';

/**
 * Park an order for a human. Used whenever an outcome is uncertain, so no
 * automatic retry can charge or purchase twice.
 */
export async function markForManualReview(
  prisma: PrismaService,
  logger: Logger,
  orderId: string,
  reason: string,
): Promise<void> {
  await prisma.order.update({
    where: { id: orderId },
    data: { status: 'MANUAL_REVIEW', failureReason: reason },
  });
  logger.warn(`Order ${orderId} requires manual review.`);
}
