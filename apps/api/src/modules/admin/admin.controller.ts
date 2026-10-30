import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles, RolesGuard } from '../auth/roles.guard.js';
import { AdminService } from './admin.service.js';
import { PaymentsService } from '../payments/payments.service.js';
import { PromotionsService } from '../promotions/promotions.service.js';
import { PartnersService } from '../partners/partners.service.js';
import { SupportService } from '../support/support.service.js';
import { SettingsService } from '../settings/settings.service.js';

class CreatePromoDto {
  @IsString() code!: string;
  @IsIn(['PERCENT', 'FIXED']) kind!: 'PERCENT' | 'FIXED';
  @IsNumber() value!: number;
  @IsOptional() @IsNumber() minSpendKes?: number;
  @IsOptional() @IsNumber() maxUses?: number;
  @IsOptional() @IsString() validTo?: string;
}

class ApprovePartnerDto {
  @IsOptional() @IsString() userId?: string;
  @IsOptional() @IsNumber() commissionPct?: number;
}

class SettingDto {
  @IsString() key!: string;
  value!: unknown;
}

class RescheduleDto {
  @IsString() startDate!: string; // yyyy-MM-dd
  @IsString() endDate!: string; // yyyy-MM-dd (max 90 days after start)
}

class CreateUserDto {
  @IsEmail() email!: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsIn(['CUSTOMER', 'PARTNER', 'ADMIN']) role?:
    | 'CUSTOMER'
    | 'PARTNER'
    | 'ADMIN';
}

class UpdateUserDto {
  @IsOptional() @IsIn(['CUSTOMER', 'PARTNER', 'ADMIN']) role?:
    | 'CUSTOMER'
    | 'PARTNER'
    | 'ADMIN';
  @IsOptional() @IsIn(['ACTIVE', 'BLOCKED']) status?: 'ACTIVE' | 'BLOCKED';
}

class PricingDto {
  @IsOptional() @IsNumber() @Min(0) @Max(5) marginPct?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(1) fxBufferPct?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(0.99) processorFeePct?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) roundTo?: number;
}

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly payments: PaymentsService,
    private readonly promotions: PromotionsService,
    private readonly partners: PartnersService,
    private readonly support: SupportService,
    private readonly settings: SettingsService,
  ) {}

  @Get('dashboard')
  dashboard() {
    return this.admin.dashboard();
  }

  @Get('reconciliation')
  reconciliation() {
    return this.admin.reconciliation();
  }

  /** Force an immediate money-path reconciliation pass (also runs on a schedule). */
  @Post('reconcile')
  reconcile() {
    return this.payments.reconcile();
  }

  @Get('orders')
  orders(@Query('status') status?: string) {
    return this.admin.listOrders(status);
  }

  @Post('orders/:id/retry')
  retry(@Param('id') id: string) {
    return this.admin.retryProvision(id);
  }

  @Post('orders/:id/refund')
  refund(@Param('id') id: string) {
    return this.admin.refund(id);
  }

  /** Reschedule an order's eSIM validity window via Celitech (pre-activation). */
  @Post('orders/:id/reschedule')
  reschedule(@Param('id') id: string, @Body() dto: RescheduleDto) {
    return this.admin.reschedule(id, dto.startDate, dto.endDate);
  }

  /** Resend an order's eSIM to the customer (email + WhatsApp). */
  @Post('orders/:id/resend')
  resend(@Param('id') id: string) {
    return this.admin.resendEsim(id);
  }

  // --- analytics -----------------------------------------------------------

  /** Revenue / COGS / profit time-series for the charts. */
  @Get('analytics')
  analytics(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('granularity') granularity?: string,
  ) {
    return this.admin.analytics(from, to, granularity);
  }

  // --- troubleshooting -----------------------------------------------------

  /** Look up an eSIM by ICCID (device + status history included). */
  @Get('esims')
  lookupEsim(@Query('iccid') iccid: string) {
    return this.admin.lookupByIccid(iccid);
  }

  /** Look up a customer's orders by email or phone. */
  @Get('lookup/orders')
  lookupOrders(@Query('email') email?: string, @Query('phone') phone?: string) {
    return this.admin.lookupOrders({ email, phone });
  }

  // --- users / admins ------------------------------------------------------

  @Get('users')
  listUsers(@Query('search') search?: string) {
    return this.admin.listUsers(search);
  }

  @Post('users')
  createUser(@Body() dto: CreateUserDto) {
    return this.admin.createUser(dto);
  }

  @Patch('users/:id')
  updateUser(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.admin.updateUser(id, dto);
  }

  // --- pricing / reselling margin -----------------------------------------

  @Get('pricing')
  getPricing() {
    return this.admin.getPricing();
  }

  @Post('pricing')
  setPricing(@Body() dto: PricingDto) {
    return this.admin.setPricing(dto);
  }

  /** Rebuild + re-price the catalogue from the supplier. */
  @Post('catalog/refresh')
  refreshCatalog() {
    return this.admin.refreshCatalog();
  }

  @Get('promotions')
  listPromos() {
    return this.promotions.list();
  }

  @Post('promotions')
  createPromo(@Body() dto: CreatePromoDto) {
    return this.promotions.create(dto);
  }

  @Get('partners')
  listPartners() {
    return this.partners.list();
  }

  @Post('partners/:id/approve')
  approvePartner(@Param('id') id: string, @Body() dto: ApprovePartnerDto) {
    return this.partners.approve(id, dto);
  }

  @Get('tickets')
  tickets(@Query('status') status?: string) {
    return this.support.listAll(status);
  }

  @Post('tickets/:id/reply')
  reply(@Param('id') id: string, @Body() body: { reply: string }) {
    return this.support.reply(id, body.reply);
  }

  @Get('settings')
  getSettings() {
    return this.settings.list();
  }

  @Post('settings')
  setSetting(@Body() dto: SettingDto) {
    return this.settings.set(dto.key, dto.value);
  }
}
