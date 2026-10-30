import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';
import {
  CurrentUser,
  JwtAuthGuard,
  OptionalJwtGuard,
  OptionalUserId,
} from '../auth/jwt-auth.guard.js';
import type { AccessClaims } from '../auth/token.service.js';
import { SupportService } from './support.service.js';

class CreateTicketDto {
  @IsOptional() @IsString() esimId?: string;
  @IsOptional() @IsString() category?: string;
  @IsString() @Length(3, 1000) message!: string;
}

@ApiTags('support')
@Controller('tickets')
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @UseGuards(OptionalJwtGuard)
  @Post()
  create(@Body() dto: CreateTicketDto, @OptionalUserId() userId?: string) {
    return this.support.create({ ...dto, userId });
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get()
  mine(@CurrentUser() user: AccessClaims) {
    return this.support.listForUser(user.sub);
  }
}
