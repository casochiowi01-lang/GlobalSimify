import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { randomBytes, createHash } from 'node:crypto';
import { AppConfigService } from '../../config/config.module.js';
import { PrismaService } from '../../prisma/prisma.service.js';

export interface AccessClaims {
  sub: string; // user id
  role: string;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: AppConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async signAccess(userId: string, role: string): Promise<string> {
    return this.jwt.signAsync(
      { sub: userId, role },
      {
        secret: this.config.get('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get(
          'JWT_ACCESS_TTL',
        ) as JwtSignOptions['expiresIn'],
      },
    );
  }

  async verifyAccess(token: string): Promise<AccessClaims> {
    const claims = await this.jwt.verifyAsync<AccessClaims>(token, {
      secret: this.config.get('JWT_ACCESS_SECRET'),
      algorithms: ['HS256'],
    });
    const account = await this.prisma.user.findUnique({
      where: { id: claims.sub },
      select: { role: true, status: true },
    });
    if (!account || account.status !== 'ACTIVE')
      throw new UnauthorizedException('Account access is unavailable.');
    return { sub: claims.sub, role: account.role };
  }

  /** Opaque refresh token (stored hashed server-side). */
  newRefreshToken(): { token: string; hash: string } {
    const token = randomBytes(32).toString('base64url');
    return { token, hash: this.hash(token) };
  }

  hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  refreshTtlMs(): number {
    // crude parse of "30d" / "15m" / "3600s"
    const ttl = this.config.get('JWT_REFRESH_TTL');
    const m = /^(\d+)([smhd])$/.exec(ttl);
    if (!m) return 30 * 24 * 3600 * 1000;
    const n = Number(m[1]);
    const mult = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[m[2]]!;
    return n * mult;
  }
}
