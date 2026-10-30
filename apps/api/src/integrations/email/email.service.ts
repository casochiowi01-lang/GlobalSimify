import { Injectable, Logger } from '@nestjs/common';
import type { Transporter } from 'nodemailer';
import { AppConfigService } from '../../config/config.module.js';

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  cid?: string; // inline content-id (e.g. embed a QR in the HTML)
  contentType?: string;
}

/**
 * Provider-agnostic transactional email via SMTP (nodemailer). Works with any
 * provider — Resend, SendGrid, SES, Postmark, Mailgun, Gmail — by setting their
 * SMTP host/port/user/pass. `mock` mode logs instead of sending.
 *
 * Best-effort: failures are logged, never thrown.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  // Created lazily so mock mode never loads nodemailer.
  private transporter?: Transporter;

  constructor(private readonly config: AppConfigService) {}

  get isMock(): boolean {
    return this.config.get('EMAIL_PROVIDER') === 'mock';
  }

  async send(args: {
    to: string;
    subject: string;
    html: string;
    text?: string;
    attachments?: EmailAttachment[];
  }): Promise<boolean> {
    if (this.isMock) {
      this.logger.warn(
        `📧 [MOCK EMAIL] to=${args.to} subject="${args.subject}"` +
          (args.attachments?.length
            ? ` (+${args.attachments.length} attachment)`
            : ''),
      );
      return true;
    }
    try {
      const tx = await this.transport();
      await tx.sendMail({
        from: this.config.get('EMAIL_FROM'),
        to: args.to,
        subject: args.subject,
        html: args.html,
        text: args.text,
        attachments: args.attachments,
      });
      return true;
    } catch (err) {
      this.logger.error(
        `Email to ${args.to} failed: ${(err as Error).message}`,
      );
      return false;
    }
  }

  private async transport(): Promise<Transporter> {
    if (this.transporter) return this.transporter;
    const host = this.config.get('SMTP_HOST');
    const user = this.config.get('SMTP_USER');
    const pass = this.config.get('SMTP_PASS');
    if (!host || !user || !pass)
      throw new Error('SMTP_HOST/USER/PASS missing.');
    const nodemailer = await import('nodemailer');
    const port = Number(this.config.get('SMTP_PORT') ?? 587);
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 30000,
      auth: { user, pass },
    });
    return this.transporter;
  }
}
