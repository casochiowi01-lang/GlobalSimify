import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AppConfigService } from '../../config/config.module.js';
import { OtpService } from './otp.service.js';
import { TokenService } from './token.service.js';
import { normalizeKenyanPhone } from './phone.util.js';

export interface AuthContext {
  userAgent?: string;
  ip?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

// Apple's public keys for verifying Sign in with Apple id_tokens.
const APPLE_JWKS = createRemoteJWKSet(
  new URL('https://appleid.apple.com/auth/keys'),
);

/** A rotated refresh token replayed within this window is treated as a benign multi-tab race. */
const REFRESH_REUSE_GRACE_MS = 30_000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private googleClient?: OAuth2Client;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly otp: OtpService,
    private readonly tokens: TokenService,
  ) {}

  // ---- Google Sign-In -------------------------------------------------

  async googleSignIn(
    idToken: string,
    ctx: AuthContext,
  ): Promise<TokenPair & { userId: string }> {
    const clientId = this.config.get('GOOGLE_CLIENT_ID');
    if (!clientId)
      throw new BadRequestException('Google sign-in is not configured.');

    this.googleClient ??= new OAuth2Client(clientId);
    let email: string | undefined;
    let name: string | undefined;
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: clientId,
      });
      const payload = ticket.getPayload();
      if (payload?.email_verified) {
        email = payload.email?.toLowerCase();
        name = payload.name;
      }
    } catch {
      throw new UnauthorizedException('Could not verify Google sign-in.');
    }
    if (!email)
      throw new UnauthorizedException('Google account email not verified.');

    let user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await this.prisma.user.create({ data: { email, name } });
      await this.prisma.userConsent.createMany({
        data: [
          { userId: user.id, purpose: 'terms' },
          { userId: user.id, purpose: 'privacy' },
        ],
      });
    }
    await this.linkAnonymousOrders(user.id, email);
    const role = await this.ensureAdminRole(user);
    return {
      ...(await this.startSession(user.id, role, ctx)),
      userId: user.id,
    };
  }

  // ---- Apple Sign-In --------------------------------------------------

  async appleSignIn(
    idToken: string,
    ctx: AuthContext,
  ): Promise<TokenPair & { userId: string }> {
    const clientId = this.config.get('APPLE_CLIENT_ID');
    if (!clientId)
      throw new BadRequestException('Apple sign-in is not configured.');

    let email: string | undefined;
    try {
      const { payload } = await jwtVerify(idToken, APPLE_JWKS, {
        issuer: 'https://appleid.apple.com',
        audience: clientId,
      });
      // Apple's email_verified can be a boolean or the string "true".
      const verified =
        payload.email_verified === true || payload.email_verified === 'true';
      if (verified && typeof payload.email === 'string') {
        email = payload.email.toLowerCase();
      }
    } catch {
      throw new UnauthorizedException('Could not verify Apple sign-in.');
    }
    if (!email)
      throw new UnauthorizedException('Apple account email not available.');

    return this.upsertEmailUserSession(email, undefined, ctx);
  }

  /** Shared: find-or-create a user by email (with consents) and open a session. */
  private async upsertEmailUserSession(
    email: string,
    name: string | undefined,
    ctx: AuthContext,
  ): Promise<TokenPair & { userId: string }> {
    let user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await this.prisma.user.create({ data: { email, name } });
      await this.prisma.userConsent.createMany({
        data: [
          { userId: user.id, purpose: 'terms' },
          { userId: user.id, purpose: 'privacy' },
        ],
      });
    }
    await this.linkAnonymousOrders(user.id, email);
    const role = await this.ensureAdminRole(user);
    return {
      ...(await this.startSession(user.id, role, ctx)),
      userId: user.id,
    };
  }

  // ---- Email OTP (active login channel) --------------------------------

  async requestEmailOtp(rawEmail: string): Promise<{ devCode?: string }> {
    const email = normalizeEmail(rawEmail);
    if (!email) throw new BadRequestException('Enter a valid email address.');
    const { devCode, cooldown } = await this.otp.issue(email, 'email');
    if (cooldown) {
      throw new BadRequestException(
        'Please wait a moment before requesting another code.',
      );
    }
    return { devCode };
  }

  async verifyEmailOtp(
    rawEmail: string,
    code: string,
    ctx: AuthContext,
  ): Promise<TokenPair & { userId: string }> {
    const email = normalizeEmail(rawEmail);
    if (!email) throw new BadRequestException('Invalid email address.');

    const ok = await this.otp.verify(email, code);
    if (!ok) throw new UnauthorizedException('Invalid or expired code.');

    let user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await this.prisma.user.create({ data: { email } });
      await this.prisma.userConsent.createMany({
        data: [
          { userId: user.id, purpose: 'terms' },
          { userId: user.id, purpose: 'privacy' },
        ],
      });
    }
    await this.linkAnonymousOrders(user.id, email);
    const role = await this.ensureAdminRole(user);
    return {
      ...(await this.startSession(user.id, role, ctx)),
      userId: user.id,
    };
  }

  // ---- Phone OTP (ON HOLD — feature-flagged for future use) ------------

  async requestOtp(rawPhone: string): Promise<{ devCode?: string }> {
    this.assertPhoneOtpEnabled();
    const phone = normalizeKenyanPhone(rawPhone);
    if (!phone) {
      throw new BadRequestException('Enter a valid Kenyan phone number.');
    }
    const { devCode, cooldown } = await this.otp.issue(phone, 'sms');
    if (cooldown) {
      throw new BadRequestException(
        'Please wait a moment before requesting another code.',
      );
    }
    return { devCode };
  }

  private assertPhoneOtpEnabled(): void {
    if (!this.config.get('AUTH_PHONE_OTP_ENABLED')) {
      throw new BadRequestException(
        'Phone login is currently unavailable. Use email.',
      );
    }
  }

  async verifyOtp(
    rawPhone: string,
    code: string,
    ctx: AuthContext,
  ): Promise<TokenPair & { userId: string }> {
    this.assertPhoneOtpEnabled();
    const phone = normalizeKenyanPhone(rawPhone);
    if (!phone) throw new BadRequestException('Invalid phone number.');

    const ok = await this.otp.verify(phone, code);
    if (!ok) throw new UnauthorizedException('Invalid or expired code.');

    let user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user) {
      // New sign-up — record acceptance of terms & privacy (Kenya DPA evidence).
      user = await this.prisma.user.create({ data: { phone } });
      await this.prisma.userConsent.createMany({
        data: [
          { userId: user.id, purpose: 'terms' },
          { userId: user.id, purpose: 'privacy' },
        ],
      });
    }

    return {
      ...(await this.startSession(user.id, user.role, ctx)),
      userId: user.id,
    };
  }

  async refresh(refreshToken: string, ctx: AuthContext): Promise<TokenPair> {
    if (!refreshToken)
      throw new UnauthorizedException('Missing refresh token.');
    const hash = this.tokens.hash(refreshToken);
    const session = await this.prisma.session.findFirst({
      where: { refreshHash: hash },
      include: { user: true },
    });

    if (
      session?.revokedAt &&
      Date.now() - session.revokedAt.getTime() > REFRESH_REUSE_GRACE_MS
    ) {
      // A refresh token was replayed after rotation: assume it was stolen and
      // end every session for the account.
      await this.prisma.session.updateMany({
        where: { userId: session.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      this.logger.warn(
        `Refresh token reuse for user ${session.userId}; all sessions revoked.`,
      );
    }
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Session expired. Please log in again.');
    }

    // Rotate: revoke the used token, issue a fresh pair.
    const claimed = await this.prisma.session.updateMany({
      where: { id: session.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (!claimed.count)
      throw new UnauthorizedException('Session already refreshed.');
    return this.startSession(session.userId, session.user.role, ctx);
  }

  async logout(refreshToken: string): Promise<void> {
    if (!refreshToken) return;
    const hash = this.tokens.hash(refreshToken);
    await this.prisma.session.updateMany({
      where: { refreshHash: hash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private adminEmails(): Set<string> {
    return new Set(
      this.config
        .get('ADMIN_EMAILS')
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    );
  }

  /**
   * Promote a user to ADMIN if their email is in the bootstrap allowlist
   * (ADMIN_EMAILS). Returns the effective role to sign into the session.
   */
  private async ensureAdminRole(user: {
    id: string;
    email: string | null;
    role: string;
  }): Promise<string> {
    if (
      user.email &&
      user.role !== 'ADMIN' &&
      this.adminEmails().has(user.email.toLowerCase())
    ) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { role: 'ADMIN' },
      });
      return 'ADMIN';
    }
    return user.role;
  }

  /** Retroactively assign anonymous orders/eSIMs placed with this email to the user account. */
  private async linkAnonymousOrders(
    userId: string,
    email: string,
  ): Promise<void> {
    if (!this.prisma.configured) return;
    await this.prisma.order.updateMany({
      where: {
        customerEmail: { equals: email, mode: 'insensitive' },
        userId: null,
      },
      data: { userId },
    });
    await this.prisma.esim.updateMany({
      where: {
        userId: null,
        order: { customerEmail: { equals: email, mode: 'insensitive' } },
      },
      data: { userId },
    });
  }

  private async startSession(
    userId: string,
    _role: string,
    ctx: AuthContext,
  ): Promise<TokenPair> {
    const account = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, status: true },
    });
    if (!account || account.status !== 'ACTIVE')
      throw new UnauthorizedException(
        'Account access is unavailable. Contact support.',
      );
    const { token, hash } = this.tokens.newRefreshToken();
    await this.prisma.session.create({
      data: {
        userId,
        refreshHash: hash,
        userAgent: ctx.userAgent?.slice(0, 255),
        ip: ctx.ip,
        expiresAt: new Date(Date.now() + this.tokens.refreshTtlMs()),
      },
    });
    const accessToken = await this.tokens.signAccess(userId, account.role);
    return { accessToken, refreshToken: token };
  }
}

function normalizeEmail(input: string): string | null {
  const email = (input ?? '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}
