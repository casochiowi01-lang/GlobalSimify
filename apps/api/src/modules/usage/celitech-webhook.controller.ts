import {
  BadRequestException,
  Controller,
  Post,
  Req,
  ServiceUnavailableException,
  UnauthorizedException,
  type RawBodyRequest,
} from '@nestjs/common';
import type { Request } from 'express';
import { Webhook } from 'svix';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AppConfigService } from '../../config/config.module.js';

/** Accept only signed raw deliveries; persist before acknowledging. The worker
 * refreshes authoritative balances, so out-of-order events never restore data. */
@Controller('webhooks/celitech')
export class CelitechWebhookController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
  ) {}
  @Post()
  async accept(@Req() req: RawBodyRequest<Request>) {
    const secret = this.config.get('CELITECH_WEBHOOK_SECRET');
    if (!secret)
      throw new ServiceUnavailableException('Webhook is not configured.');
    if (!req.rawBody) throw new UnauthorizedException('Raw body required.');
    const id = req.header('svix-id'),
      timestamp = req.header('svix-timestamp'),
      signature = req.header('svix-signature');
    if (!id || !timestamp || !signature)
      throw new UnauthorizedException('Missing signature.');
    let payload: { purchaseId?: unknown; notificationPercentage?: unknown };
    try {
      new Webhook(secret).verify(req.rawBody.toString('utf8'), {
        'svix-id': id,
        'svix-timestamp': timestamp,
        'svix-signature': signature,
      });
      payload = JSON.parse(req.rawBody.toString('utf8')) as typeof payload;
    } catch {
      throw new UnauthorizedException('Invalid webhook signature.');
    }
    if (
      typeof payload.purchaseId !== 'string' ||
      ![50, 80].includes(Number(payload.notificationPercentage))
    )
      throw new BadRequestException('Unsupported usage event.');
    await this.prisma.webhookEvent.upsert({
      where: { source_externalId: { source: 'celitech', externalId: id } },
      update: {},
      create: {
        source: 'celitech',
        externalId: id,
        signatureOk: true,
        raw: {
          purchaseId: payload.purchaseId,
          threshold: Number(payload.notificationPercentage),
        },
      },
    });
    return { accepted: true };
  }
}
