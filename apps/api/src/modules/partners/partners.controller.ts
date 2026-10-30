import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';
import { CurrentUser, JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles, RolesGuard } from '../auth/roles.guard.js';
import type { AccessClaims } from '../auth/token.service.js';
import { PartnersService } from './partners.service.js';

class ApplyDto {
  @IsString() @Length(2, 80) name!: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() mpesaNumber?: string;
}

@ApiTags('partners')
@Controller()
export class PartnersController {
  constructor(private readonly partners: PartnersService) {}

  @Post('partners/apply')
  apply(@Body() dto: ApplyDto) {
    return this.partners.apply(dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PARTNER', 'ADMIN')
  @Get('partner/stats')
  stats(@CurrentUser() user: AccessClaims) {
    return this.partners.statsForUser(user.sub);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PARTNER', 'ADMIN')
  @Post('partner/payout')
  payout(@CurrentUser() user: AccessClaims) {
    return this.partners.requestPayout(user.sub);
  }
}
