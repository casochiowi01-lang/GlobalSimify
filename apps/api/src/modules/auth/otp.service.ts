import { Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomInt } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AppConfigService } from '../../config/config.module.js';
import { SmsService } from '../../integrations/sms/sms.service.js';
import { EmailService } from '../../integrations/email/email.service.js';

const OTP_TTL_MS = 5 * 60 * 1000;
/** Guesses allowed against a single code. */
const MAX_ATTEMPTS = 5;
/** Guesses allowed per identifier across all codes, so re-requesting codes cannot reset the budget. */
const MAX_FAILURES_PER_WINDOW = 10;
const FAILURE_WINDOW_MS = 60 * 60 * 1000;
const RESEND_COOLDOWN_MS = 30 * 1000;

export type OtpChannel = 'sms' | 'email';

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly sms: SmsService,
    private readonly email: EmailService,
  ) {}

  /**
   * Issue an OTP for an identifier (a phone number for SMS, or an email address
   * for email). The identifier is stored in the OtpChallenge `phone` column
   * (legacy name — it holds whichever identifier the channel uses).
   * Returns the dev code only in non-prod so the flow is testable without a
   * real gateway.
   */
  async issue(
    identifier: string,
    channel: OtpChannel,
  ): Promise<{ devCode?: string; cooldown: boolean }> {
    const recent = await this.prisma.otpChallenge.findFirst({
      where: { phone: identifier, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (
      recent &&
      Date.now() - recent.createdAt.getTime() < RESEND_COOLDOWN_MS
    ) {
      return { cooldown: true };
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const codeHash = await bcrypt.hash(code, 10);
    // Only the newest code is ever valid.
    await this.prisma.otpChallenge.updateMany({
      where: {
        phone: identifier,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { expiresAt: new Date() },
    });
    await this.prisma.otpChallenge.create({
      data: {
        phone: identifier,
        codeHash,
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      },
    });

    await this.deliver(identifier, code, channel);
    const isProd = this.config.isProduction;
    return { devCode: isProd ? undefined : code, cooldown: false };
  }

  /**
   * Returns true if the code is valid; consumes the challenge on success.
   *
   * Each guess claims an attempt atomically before the comparison, so
   * concurrent requests cannot exceed the per-code limit, and failures are
   * also capped per identifier across codes.
   */
  async verify(identifier: string, code: string): Promise<boolean> {
    // Attempts on codes that were never used successfully are failures.
    const recent = await this.prisma.otpChallenge.aggregate({
      where: {
        phone: identifier,
        consumedAt: null,
        createdAt: { gt: new Date(Date.now() - FAILURE_WINDOW_MS) },
      },
      _sum: { attempts: true },
    });
    if ((recent._sum.attempts ?? 0) >= MAX_FAILURES_PER_WINDOW) return false;

    const challenge = await this.prisma.otpChallenge.findFirst({
      where: {
        phone: identifier,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!challenge) return false;

    const slot = await this.prisma.otpChallenge.updateMany({
      where: { id: challenge.id, attempts: { lt: MAX_ATTEMPTS } },
      data: { attempts: { increment: 1 } },
    });
    if (slot.count !== 1) return false;
    if (!(await bcrypt.compare(code, challenge.codeHash))) return false;

    const consumed = await this.prisma.otpChallenge.updateMany({
      where: { id: challenge.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    return consumed.count === 1;
  }

  private async deliver(
    identifier: string,
    code: string,
    channel: OtpChannel,
  ): Promise<void> {
    if (channel === 'email') {
      await this.email.send({
        to: identifier,
        subject: `${code} is your GlobalSimify login code`,
        text: `Your GlobalSimify login code is ${code}. It expires in 5 minutes.`,
        html: `<p>Your GlobalSimify login code is:</p><p style="font-size:28px;font-weight:700;letter-spacing:4px">${code}</p><p>It expires in 5 minutes. If you didn't request this, you can ignore this email.</p>`,
      });
      return;
    }
    // SMS channel (phone-OTP, currently on hold).
    await this.sms.send(
      identifier,
      `${code} is your GlobalSimify login code. Valid for 5 minutes.`,
    );
  }
}
