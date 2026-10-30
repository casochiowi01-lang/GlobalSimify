import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';
import { CurrentUser, JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AccessClaims } from '../auth/token.service.js';
import { UsersService } from './users.service.js';

/**
 * Profile fields a user may change. Email is deliberately absent: it is the
 * login identity and the key that links guest orders and admin access, so it
 * can only be established by proving control of the inbox (one-time code).
 */
class UpdateProfileDto {
  @IsOptional() @IsString() @Length(1, 80) name?: string;
  @IsOptional() @IsString() @Length(2, 8) locale?: string;
}

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  me(@CurrentUser() user: AccessClaims) {
    return this.users.getProfile(user.sub);
  }

  @Patch('me')
  update(@CurrentUser() user: AccessClaims, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(user.sub, dto);
  }
}
