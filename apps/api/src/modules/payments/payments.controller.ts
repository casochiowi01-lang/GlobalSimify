import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
  UseGuards,
  type RawBodyRequest,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  Matches,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import {
  CurrentUser,
  JwtAuthGuard,
  OptionalJwtGuard,
  OptionalUserId,
} from '../auth/jwt-auth.guard.js';
import type { AccessClaims } from '../auth/token.service.js';
import { PaymentsService } from './payments.service.js';

class CheckoutMpesaDto {
  @IsString() productId!: string;
  @IsString() @Length(7, 20) phone!: string;
  @IsEmail() email!: string;
  @IsBoolean() compatAttested!: boolean;
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  // Chosen validity in days (used to price unlimited per-day plans).
  @IsOptional() @IsInt() @Min(1) @Max(365) validityDays?: number;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) startDate?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) endDate?: string;
  @IsOptional() @IsInt() @Min(1) @Max(5) quantity?: number;
  @IsNumber() @Min(0) expectedTotal!: number;
  @IsOptional() @IsNumber() @Min(0) expectedChargeAmount?: number;
  @IsOptional() @IsString() idempotencyKey?: string;
  @IsOptional() @IsString() partnerCode?: string;
  @IsOptional() @IsString() promoCode?: string;
}

class TopUpDto {
  @IsOptional() @IsString() esimId?: string;
  @IsOptional() @IsString() iccid?: string;
  @IsString() productId!: string;
  @IsOptional() @IsIn(['mpesa', 'card']) method?: 'mpesa' | 'card';
  @IsOptional() @IsString() idempotencyKey?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) startDate?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) endDate?: string;
  @IsNumber() @Min(0) expectedTotal!: number;
  @IsOptional() @IsNumber() @Min(0) expectedChargeAmount?: number;
}

class QuoteDto {
  @IsString() productId!: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) startDate?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) endDate?: string;
  @IsOptional() @IsInt() @Min(1) @Max(5) quantity?: number;
  @IsOptional() @IsString() promoCode?: string;
}

@ApiTags('payments')
@Controller()
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}
  @UseGuards(OptionalJwtGuard)
  @Post('payments/quote')
  quote(@Body() dto: QuoteDto, @OptionalUserId() userId?: string) {
    return this.payments.quote(dto, userId);
  }

  @UseGuards(OptionalJwtGuard)
  @Post('payments/mpesa')
  async checkout(
    @Body() dto: CheckoutMpesaDto,
    @OptionalUserId() userId?: string,
  ) {
    return this.payments.checkoutMpesa({ ...dto, userId });
  }

  @UseGuards(OptionalJwtGuard)
  @Post('payments/card')
  async card(@Body() dto: CheckoutMpesaDto, @OptionalUserId() userId?: string) {
    return this.payments.checkoutCard({ ...dto, userId });
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('payments/topup')
  async topup(@CurrentUser() user: AccessClaims, @Body() dto: TopUpDto) {
    const { method, ...rest } = dto;
    return this.payments.checkoutTopUp(
      { ...rest, userId: user.sub },
      method === 'card' ? 'CARD' : 'MPESA',
    );
  }

  // Paystack webhook (signed → verified via HMAC-SHA512 over the raw body).
  // Handles charge.success (payments) and refund.* (refunds) events.
  @Post('webhooks/paystack')
  @HttpCode(200)
  async paystackWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-paystack-signature') signature: string | undefined,
    @Body()
    body: {
      event?: string;
      data?: { reference?: string; id?: number | string; status?: string };
    },
  ) {
    return this.payments.handleWebhook(body, {
      rawBody: req.rawBody,
      signature,
    });
  }
}
