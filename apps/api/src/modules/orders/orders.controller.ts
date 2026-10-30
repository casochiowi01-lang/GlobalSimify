import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
  Headers,
  Header,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  CurrentUser,
  JwtAuthGuard,
  OptionalJwtGuard,
  OptionalUserId,
} from '../auth/jwt-auth.guard.js';
import type { AccessClaims } from '../auth/token.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { OrdersService } from './orders.service.js';

function publicOrder(o: Awaited<ReturnType<OrdersService['getOrder']>>) {
  return {
    id: o.id,
    status: o.status,
    kind: o.kind, // PURCHASE | TOPUP — top-ups apply to an existing eSIM
    targetIccid: o.targetIccid, // set for TOPUP orders
    title: o.title,
    totalKes: Number(o.totalKes),
    currency: o.currency,
    customerPhone: o.customerPhone,
    failureReason: o.failureReason,
    createdAt: o.createdAt,
    quantity: o.quantity,
    esims: o.esims.map((e) => ({
      ...e,
      initialBytes: Number(e.initialBytes),
      remainingBytes: Number(e.remainingBytes),
      destIso: o.destinationIso,
    })),
    esim: o.esims[0]
      ? {
          ...o.esims[0],
          initialBytes: Number(o.esims[0].initialBytes),
          remainingBytes: Number(o.esims[0].remainingBytes),
          destIso: o.destinationIso,
        }
      : null,
  };
}

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly notifications: NotificationsService,
  ) {}

  @UseGuards(OptionalJwtGuard)
  @Get(':id')
  @Header('Cache-Control', 'no-store')
  async get(
    @Param('id') id: string,
    @OptionalUserId() userId?: string,
    @Headers('x-order-token') token?: string,
  ) {
    return publicOrder(await this.orders.getOrder(id, userId, token));
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get()
  @Header('Cache-Control', 'private, no-store')
  async mine(@CurrentUser() user: AccessClaims) {
    const list = await this.orders.listForUser(user.sub);
    return list.map(publicOrder);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(':id/resend')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  async resend(@Param('id') id: string, @CurrentUser() user: AccessClaims) {
    const order = await this.orders.getOrder(id, user.sub);
    if (!order.esims.length)
      throw new BadRequestException('No eSIM to resend yet.');
    for (const esim of order.esims)
      await this.notifications.resendEsim(esim.id);
    return { ok: true };
  }
}
