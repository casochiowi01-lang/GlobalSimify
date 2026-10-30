import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsObject, IsUrl, Matches } from 'class-validator';
import type { Request } from 'express';
import { CurrentUser, JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AccessClaims } from '../auth/token.service.js';
import { NotificationsService } from './notifications.service.js';

/**
 * Browser push services (Chrome/Edge via FCM, Firefox, Safari, legacy Edge).
 * Restricting endpoints to these hosts stops the server being used to POST to
 * arbitrary URLs.
 */
const PUSH_SERVICE_ENDPOINT =
  /^https:\/\/(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)\//;

class SubscribeDto {
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @Matches(PUSH_SERVICE_ENDPOINT, {
    message: 'endpoint must be a browser push service URL',
  })
  endpoint!: string;
  @IsObject() keys!: { p256dh: string; auth: string };
}

@ApiTags('push')
@Controller('push')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get('vapid-public-key')
  vapidKey() {
    return { publicKey: this.notifications.vapidPublicKey };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('subscribe')
  subscribe(
    @CurrentUser() user: AccessClaims,
    @Body() dto: SubscribeDto,
    @Req() req: Request,
  ) {
    return this.notifications.subscribe(
      user.sub,
      dto,
      req.headers['user-agent'],
    );
  }
}
