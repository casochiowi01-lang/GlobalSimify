import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import webpush from 'web-push';
import QRCode from 'qrcode';
import { buildReceiptPdf } from './receipt-pdf.js';
import { buildEsimPdf, type EsimInstallation } from './esim-pdf.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AppConfigService } from '../../config/config.module.js';
import { EmailService } from '../../integrations/email/email.service.js';
import { WhatsAppService } from '../../integrations/whatsapp/whatsapp.service.js';
import {
  Events,
  type EsimExpiringEvent,
  type EsimProvisionedEvent,
  type PaymentCompletedEvent,
  type UsageThresholdEvent,
} from '../../common/events.js';

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);
  private pushEnabled = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly email: EmailService,
    private readonly whatsapp: WhatsAppService,
  ) {}

  onModuleInit(): void {
    const pub = this.config.get('VAPID_PUBLIC_KEY');
    const priv = this.config.get('VAPID_PRIVATE_KEY');
    if (pub && priv) {
      webpush.setVapidDetails(this.config.get('VAPID_SUBJECT'), pub, priv);
      this.pushEnabled = true;
    } else {
      this.logger.warn('VAPID keys absent — web push disabled.');
    }
  }

  get vapidPublicKey(): string | null {
    return this.config.get('VAPID_PUBLIC_KEY') ?? null;
  }

  async subscribe(
    userId: string,
    sub: { endpoint: string; keys: { p256dh: string; auth: string } },
    userAgent?: string,
  ) {
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: sub.endpoint },
      update: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
      create: {
        userId,
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
        userAgent,
      },
    });
    return { ok: true };
  }

  /** Send a web push to all of a user's subscriptions; prune dead ones. */
  async pushToUser(
    userId: string | null | undefined,
    payload: { title: string; body: string; url?: string },
  ): Promise<void> {
    if (!userId) return;
    await this.log(userId, 'push', payload.title, payload);
    if (!this.pushEnabled) return;
    const subs = await this.prisma.pushSubscription.findMany({
      where: { userId },
    });
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify(payload),
          );
        } catch (err) {
          const code = (err as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) {
            await this.prisma.pushSubscription.delete({ where: { id: s.id } });
          }
        }
      }),
    );
  }

  private async log(
    userId: string | null | undefined,
    channel: string,
    template: string,
    payload: unknown,
  ) {
    await this.prisma.notificationLog.create({
      data: {
        userId: userId ?? undefined,
        channel,
        template,
        payload: payload as object,
      },
    });
  }

  // --- event subscribers --------------------------------------------------

  /** Email receipt on successful payment (separate from eSIM delivery). */
  @OnEvent(Events.PaymentCompleted)
  async onPaymentCompleted(e: PaymentCompletedEvent): Promise<void> {
    if (!e.customerEmail) return;
    const claim = await this.prisma.payment.updateMany({
      where: {
        orderId: e.orderId,
        emailSentAt: null,
        OR: [
          { emailAttemptAt: null },
          { emailAttemptAt: { lt: new Date(Date.now() - 300000) } },
        ],
      },
      data: { emailAttemptAt: new Date() },
    });
    if (!claim.count) return;
    const amount = `${e.currency} ${e.amountUsd.toFixed(2)}`;
    const when = new Date().toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    const label = e.kind === 'TOPUP' ? 'Top-up' : 'Purchase';

    // Generate a PDF receipt to attach.
    let pdf: Buffer | undefined;
    try {
      pdf = await buildReceiptPdf({
        orderId: e.orderId,
        title: e.title,
        amount,
        method: e.method,
        reference: e.reference,
        dateText: when,
        kindLabel: label,
      });
    } catch {
      /* PDF is best-effort — still send the email without it */
    }
    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:520px;margin:auto">
        <h2 style="color:#0d9488">Payment received — thank you!</h2>
        <p>Here's your receipt from GlobalSimify.</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr><td style="padding:6px 0;color:#71717a">${label}</td><td style="text-align:right">${e.title}</td></tr>
          <tr><td style="padding:6px 0;color:#71717a">Amount</td><td style="text-align:right;font-weight:700">${amount}</td></tr>
          <tr><td style="padding:6px 0;color:#71717a">Method</td><td style="text-align:right">${e.method}</td></tr>
          ${e.reference ? `<tr><td style="padding:6px 0;color:#71717a">Reference</td><td style="text-align:right">${e.reference}</td></tr>` : ''}
          <tr><td style="padding:6px 0;color:#71717a">Date</td><td style="text-align:right">${when}</td></tr>
          <tr><td style="padding:6px 0;color:#71717a">Order</td><td style="text-align:right">${e.orderId}</td></tr>
        </table>
        <p style="color:#71717a;font-size:13px;margin-top:16px">${e.kind === 'TOPUP' ? 'Your existing eSIM will update after the top-up is applied. Keep using the same installed eSIM; no new QR code is needed.' : 'Your eSIM QR code is sent in a separate message after provisioning.'} Questions? Just reply to this email.</p>
      </div>`;
    const sent = await this.email.send({
      to: e.customerEmail,
      subject: `Receipt — ${e.title} (${amount})`,
      html,
      text: `Payment received. ${e.title} — ${amount} via ${e.method}. Order ${e.orderId}.`,
      attachments: pdf
        ? [
            {
              filename: `receipt-${e.orderId}.pdf`,
              content: pdf,
              contentType: 'application/pdf',
            },
          ]
        : undefined,
    });
    if (!sent) throw new Error('Receipt email will be retried.');
    await this.prisma.payment.update({
      where: { orderId: e.orderId },
      data: { emailSentAt: new Date() },
    });
    await this.log(e.userId, 'email', 'receipt', {
      orderId: e.orderId,
      amount,
    });
  }

  @OnEvent(Events.EsimProvisioned)
  async onProvisioned(e: EsimProvisionedEvent): Promise<void> {
    const esim = await this.prisma.esim.findUnique({
      where: { id: e.esimId },
      include: { order: true },
    });
    if (!esim) return;
    const claim = await this.prisma.esim.updateMany({
      where: {
        id: esim.id,
        emailSentAt: null,
        OR: [
          { emailAttemptAt: null },
          { emailAttemptAt: { lt: new Date(Date.now() - 300000) } },
        ],
      },
      data: { emailAttemptAt: new Date() },
    });
    if (!claim.count) return;

    const detailLines =
      `SM-DP+ Address: ${esim.smdpAddress}\n` +
      `Activation Code: ${esim.matchingId}\n` +
      `ICCID: ${esim.iccid}`;

    await this.deliverEmail(e, { ...esim, title: e.title }, detailLines);
    await this.prisma.esim.update({
      where: { id: esim.id },
      data: { emailSentAt: new Date() },
    });
    await this.log(e.userId, 'email', 'esim_delivery', { esimId: esim.id });
    // WhatsApp sharing is customer-initiated on the website. A checkout phone
    // number alone is not consent to transmit private activation credentials.

    await this.pushToUser(e.userId, {
      title: 'Your eSIM is ready 🎉',
      body: `${e.title} — tap to view your QR code.`,
      url: '/account/esims',
    });
  }

  /** Re-send the private installation email for an already-provisioned eSIM. */
  async resendEsim(esimId: string): Promise<void> {
    const esim = await this.prisma.esim.findUnique({
      where: { id: esimId },
      include: { order: true },
    });
    if (!esim) throw new NotFoundException('eSIM not found.');

    const e: EsimProvisionedEvent = {
      orderId: esim.orderId,
      esimId: esim.id,
      userId: esim.userId,
      customerPhone: esim.order.customerPhone,
      customerEmail: esim.order.customerEmail,
      title: esim.order.title,
      lpa: esim.lpa,
    };

    const detailLines =
      `SM-DP+ Address: ${esim.smdpAddress}\n` +
      `Activation Code: ${esim.matchingId}\n` +
      `ICCID: ${esim.iccid}`;

    await this.deliverEmail(e, { ...esim, title: e.title }, detailLines);
    await this.prisma.esim.update({
      where: { id: esim.id },
      data: { emailSentAt: new Date() },
    });
    await this.log(e.userId, 'email', 'esim_delivery_resend', {
      esimId: esim.id,
    });
  }

  private async deliverEmail(
    e: EsimProvisionedEvent,
    installation: EsimInstallation,
    detailLines: string,
  ): Promise<void> {
    if (!e.customerEmail)
      throw new Error('A purchase email is required for delivery.');
    const [qrPng, pdf] = await Promise.all([
      QRCode.toBuffer(installation.lpa, {
        width: 900,
        margin: 4,
        errorCorrectionLevel: 'M',
      }),
      buildEsimPdf(installation),
    ]);
    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:520px;margin:auto">
        <h2 style="color:#0d9488">Your eSIM is ready 🎉</h2>
        <p>Thanks for your purchase: <strong>${escapeHtml(e.title)}</strong>.</p>
        <p>Scan this QR code on <strong>Wi-Fi before you travel</strong>
           (Settings → Mobile/Cellular → Add eSIM):</p>
        <p style="text-align:center"><img src="cid:esimqr" alt="eSIM QR code" width="260" height="260" /></p>
        <p>Setting up on the same phone? Enter these manually:</p>
        <pre style="background:#f4f4f5;padding:12px;border-radius:8px;white-space:pre-wrap;word-break:break-all">${escapeHtml(detailLines)}</pre>
        <p>Your QR image and PDF installation guide are attached. You can also <a href="https://globalsimify.com/account/esims">view your eSIMs in your account</a> by signing in with the email used at checkout.</p>
        <p>Keep these files private. Share them only with the person who will use this eSIM.</p>
        <p style="color:#71717a;font-size:13px">Your package follows the travel dates selected at checkout. Installation alone does not change those dates.</p>
      </div>`;
    const sent = await this.email.send({
      to: e.customerEmail,
      subject: `Your GlobalSimify eSIM is ready — ${e.title}`,
      html,
      text: `Your eSIM (${e.title}) is ready.\n\n${detailLines}\n\nScan the attached QR on Wi-Fi before you travel. Your PDF installation guide is also attached. Sign in with your purchase email at https://globalsimify.com/account/esims to view it again. Keep your activation details private.`,
      attachments: [
        {
          filename: 'esim-qr.png',
          content: qrPng,
          cid: 'esimqr',
          contentType: 'image/png',
        },
        {
          filename: 'globalsimify-esim.pdf',
          content: pdf,
          contentType: 'application/pdf',
        },
      ],
    });
    if (!sent)
      throw new Error(
        'eSIM email was not accepted by the mail provider. It will be retried.',
      );
  }

  /** Database delivery markers survive process restarts. SMTP is at-least-once:
   * a crash after acceptance can resend an email, but never repurchase an eSIM. */
  @Cron(CronExpression.EVERY_MINUTE, { waitForCompletion: true })
  async retryEmails(orderId?: string, limit = 50) {
    if (!this.prisma.configured) return;
    const due = {
      OR: [
        { emailAttemptAt: null },
        { emailAttemptAt: { lt: new Date(Date.now() - 300000) } },
      ],
    };
    const esims = await this.prisma.esim.findMany({
      where: {
        ...(orderId ? { orderId } : {}),
        emailSentAt: null,
        packages: { some: { state: 'COMPLETE' } },
        ...due,
      },
      include: { order: true },
      take: limit,
      orderBy: { createdAt: 'asc' },
    });
    for (const e of esims) {
      try {
        await this.onProvisioned({
          esimId: e.id,
          orderId: e.orderId,
          userId: e.userId,
          customerEmail: e.order.customerEmail,
          customerPhone: e.order.customerPhone,
          title: e.order.title,
          lpa: e.lpa,
        });
      } catch {
        this.logger.warn('eSIM email ' + e.id + ' is pending retry.');
      }
    }
    const payments = await this.prisma.payment.findMany({
      where: {
        ...(orderId ? { orderId } : {}),
        state: 'COMPLETE',
        environment: { not: 'legacy' },
        emailSentAt: null,
        ...due,
      },
      include: { order: true },
      take: limit,
      orderBy: { createdAt: 'asc' },
    });
    for (const p of payments) {
      try {
        await this.onPaymentCompleted({
          orderId: p.orderId,
          userId: p.order.userId,
          customerEmail: p.order.customerEmail,
          title: p.order.title,
          amountUsd: Number(p.amountKes),
          currency: 'USD',
          method: p.method,
          reference: p.invoiceId,
          kind: p.order.kind,
        });
      } catch {
        this.logger.warn('Receipt ' + p.id + ' is pending retry.');
      }
    }
  }

  @OnEvent(Events.UsageThreshold)
  async onThreshold(e: UsageThresholdEvent): Promise<void> {
    const body =
      e.threshold >= 100
        ? `Your ${e.title} data is used up. Tap to top up.`
        : `You've used ${e.threshold}% of your ${e.title} data.`;
    await this.pushToUser(e.userId, {
      title: 'Data alert',
      body,
      url: '/account/esims',
    });
  }

  @OnEvent(Events.EsimExpiring)
  async onExpiring(e: EsimExpiringEvent): Promise<void> {
    await this.pushToUser(e.userId, {
      title: 'eSIM expiring soon',
      body: `Your ${e.title} plan expires in ${e.daysLeft} day(s).`,
      url: '/account/esims',
    });
  }
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  );
}
