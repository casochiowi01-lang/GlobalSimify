import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import {
  AppleSignInDto,
  GoogleSignInDto,
  RequestEmailOtpDto,
  RequestOtpDto,
  VerifyEmailOtpDto,
  VerifyOtpDto,
} from './auth.dto.js';
import { CurrentUser, JwtAuthGuard } from './jwt-auth.guard.js';
import type { AccessClaims } from './token.service.js';

const REFRESH_COOKIE = 'etx_rt';

/** Sending a code costs an email or SMS and can target any inbox, so it is limited hardest. */
const SEND_CODE_LIMIT = { default: { ttl: 60_000, limit: 5 } };
const VERIFY_CODE_LIMIT = { default: { ttl: 60_000, limit: 10 } };
const SIGN_IN_LIMIT = { default: { ttl: 60_000, limit: 20 } };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // ---- Google Sign-In ----
  @Post('google')
  @Throttle(SIGN_IN_LIMIT)
  async google(
    @Body() dto: GoogleSignInDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.googleSignIn(dto.idToken, ctx(req));
    this.setRefreshCookie(res, result.refreshToken);
    return { accessToken: result.accessToken, userId: result.userId };
  }

  // ---- Apple Sign-In ----
  @Post('apple')
  @Throttle(SIGN_IN_LIMIT)
  async apple(
    @Body() dto: AppleSignInDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.appleSignIn(dto.idToken, ctx(req));
    this.setRefreshCookie(res, result.refreshToken);
    return { accessToken: result.accessToken, userId: result.userId };
  }

  // ---- Email OTP (active) ----
  @Post('email/request')
  @Throttle(SEND_CODE_LIMIT)
  async requestEmailOtp(@Body() dto: RequestEmailOtpDto) {
    const { devCode } = await this.auth.requestEmailOtp(dto.email);
    return { sent: true, ...(devCode ? { devCode } : {}) };
  }

  @Post('email/verify')
  @Throttle(VERIFY_CODE_LIMIT)
  async verifyEmailOtp(
    @Body() dto: VerifyEmailOtpDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.verifyEmailOtp(
      dto.email,
      dto.code,
      ctx(req),
    );
    this.setRefreshCookie(res, result.refreshToken);
    return { accessToken: result.accessToken, userId: result.userId };
  }

  // ---- Phone OTP (on hold; enabled via AUTH_PHONE_OTP_ENABLED) ----
  @Post('otp/request')
  @Throttle(SEND_CODE_LIMIT)
  async requestOtp(@Body() dto: RequestOtpDto) {
    const { devCode } = await this.auth.requestOtp(dto.phone);
    // devCode is only present in non-production, to ease testing.
    return { sent: true, ...(devCode ? { devCode } : {}) };
  }

  @Post('otp/verify')
  @Throttle(VERIFY_CODE_LIMIT)
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.verifyOtp(dto.phone, dto.code, ctx(req));
    this.setRefreshCookie(res, result.refreshToken);
    return { accessToken: result.accessToken, userId: result.userId };
  }

  @Post('refresh')
  @Throttle(SIGN_IN_LIMIT)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = readRefresh(req);
    const pair = await this.auth.refresh(token, ctx(req));
    this.setRefreshCookie(res, pair.refreshToken);
    return { accessToken: pair.accessToken };
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(readRefresh(req));
    res.clearCookie(REFRESH_COOKIE, {
      path: '/api/v1/auth',
      domain:
        process.env.NODE_ENV === 'production' ? '.globalsimify.com' : undefined,
    });
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: AccessClaims) {
    return { userId: user.sub, role: user.role };
  }

  private setRefreshCookie(res: Response, token: string) {
    // The API (api.globalsimify.com) and web app (globalsimify.com) share the
    // same registrable domain, so scoping the cookie to `.globalsimify.com`
    // makes it FIRST-PARTY: SameSite=Lax is sent on the silent-refresh XHR and
    // it survives the full reload returning from Paystack — robust in every
    // browser (incl. Safari / third-party-cookie blocking). Dev is same-origin
    // localhost, so no domain is set there.
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      domain: isProd ? '.globalsimify.com' : undefined,
      path: '/api/v1/auth',
      maxAge: 30 * 24 * 3600 * 1000,
    });
  }
}

function ctx(req: Request) {
  return {
    userAgent: req.headers['user-agent'],
    ip: req.ip,
  };
}

function readRefresh(req: Request): string {
  const cookies = (req as { cookies?: unknown }).cookies as
    | Record<string, string>
    | undefined;
  return cookies?.[REFRESH_COOKIE] ?? '';
}
