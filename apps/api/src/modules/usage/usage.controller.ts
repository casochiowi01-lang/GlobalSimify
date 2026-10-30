import {
  Controller,
  Get,
  Param,
  Res,
  UseGuards,
  Headers,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { OptionalJwtGuard, OptionalUserId } from '../auth/jwt-auth.guard.js';
import { UsageService } from './usage.service.js';

@ApiTags('usage')
@Controller()
export class UsageController {
  constructor(private readonly usage: UsageService) {}

  // Celitech has no usage webhooks — usage is polled on demand here.
  @UseGuards(OptionalJwtGuard)
  @Get('esims/:id/usage')
  get(
    @Param('id') id: string,
    @OptionalUserId() userId?: string,
    @Headers('x-order-token') token?: string,
  ) {
    return this.usage.getUsage(id, userId, token);
  }

  // Device the eSIM is installed on (null until installed).
  @UseGuards(OptionalJwtGuard)
  @Get('esims/:id/device')
  device(
    @Param('id') id: string,
    @OptionalUserId() userId?: string,
    @Headers('x-order-token') token?: string,
  ) {
    return this.usage.getDevice(id, userId, token);
  }

  // Status timeline (RELEASED → INSTALLED → ENABLED → …).
  @UseGuards(OptionalJwtGuard)
  @Get('esims/:id/history')
  history(
    @Param('id') id: string,
    @OptionalUserId() userId?: string,
    @Headers('x-order-token') token?: string,
  ) {
    return this.usage.getHistory(id, userId, token);
  }

  // Private QR: ownership or the order capability is required, not just an ID.
  @Get('esims/:id/qr.png')
  @UseGuards(OptionalJwtGuard)
  async qr(
    @Param('id') id: string,
    @Res() res: Response,
    @OptionalUserId() userId?: string,
    @Headers('x-order-token') token?: string,
    @Query('access') legacyToken?: string,
  ): Promise<void> {
    const png = await this.usage.getQrPng(id, userId, token || legacyToken);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.type('png').send(png);
  }

  @Get('esims/:id/installation.pdf')
  @UseGuards(OptionalJwtGuard)
  async installation(
    @Param('id') id: string,
    @Res() res: Response,
    @OptionalUserId() userId?: string,
    @Headers('x-order-token') token?: string,
  ): Promise<void> {
    const pdf = await this.usage.getInstallationPdf(id, userId, token);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="globalsimify-esim.pdf"',
    );
    res.type('application/pdf').send(pdf);
  }
}
