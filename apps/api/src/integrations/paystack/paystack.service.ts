import { Injectable, Logger } from '@nestjs/common';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { AppConfigService } from '../../config/config.module.js';

export type PaystackTxnState = 'PENDING' | 'COMPLETE' | 'FAILED' | 'CANCELED';

export interface InitResult {
  /** Paystack transaction reference (stored as Payment.invoiceId). */
  reference: string;
  /** Hosted checkout URL to redirect the customer to (M-Pesa + card). */
  checkoutUrl: string;
}

export interface VerifyResult {
  reference: string;
  amountSubunit?: number;
  currency?: string;
  environment?: string;
  state: PaystackTxnState;
  channel?: string;
  feesKes?: number;
  netKes?: number;
}

/**
 * Boundary to Paystack (Kenya). Mock mode tracks transactions in memory and
 * auto-completes them shortly after initiation, so the full pay → provision
 * flow is testable without a real account or billable charges.
 *
 * Live mode uses the Paystack REST API. Amounts are sent in the currency
 * SUBUNIT (KES × 100). Webhooks are authenticated by HMAC-SHA512 signature
 * (see {@link verifySignature}); we also re-verify each transaction against the
 * verify endpoint before fulfilling.
 */
@Injectable()
export class PaystackService {
  private readonly logger = new Logger(PaystackService.name);
  private readonly baseUrl = 'https://api.paystack.co';
  private readonly mockTxns = new Map<
    string,
    { state: PaystackTxnState; amountKes: number }
  >();

  constructor(private readonly config: AppConfigService) {}

  get mode(): 'mock' | 'live' {
    return this.config.get('PAYSTACK_MODE');
  }
  get isMock(): boolean {
    return this.mode === 'mock';
  }
  get environment(): 'mock' | 'test' | 'live' {
    if (this.isMock) return 'mock';
    if (this.secret.startsWith('sk_test_')) return 'test';
    if (this.secret.startsWith('sk_live_')) return 'live';
    throw new Error('Unrecognized Paystack credential environment.');
  }

  private get secret(): string {
    const s = this.config.get('PAYSTACK_SECRET_KEY');
    if (!s) throw new Error('PAYSTACK_SECRET_KEY missing.');
    return s;
  }

  /**
   * Initialize a transaction. `amountKes` is the integer KES to charge;
   * Paystack expects the subunit (×100). `channels` restricts the methods shown
   * (e.g. ['mobile_money'] for M-Pesa, ['card'] for card). Returns the hosted
   * checkout URL to redirect the customer to.
   */
  async initializeTransaction(args: {
    reference: string;
    amountKes: number;
    email: string;
    callbackUrl: string;
    channels?: string[];
    phone?: string;
  }): Promise<InitResult> {
    if (this.isMock) {
      const reference = args.reference;
      this.mockTxns.set(reference, {
        state: 'PENDING',
        amountKes: args.amountKes,
      });
      // Simulate the customer completing payment ~1.2s later.
      setTimeout(() => {
        const t = this.mockTxns.get(reference);
        if (t) t.state = 'COMPLETE';
      }, 1200);
      this.logger.warn(
        `💳 [MOCK PAYSTACK] KES ${args.amountKes} (${(args.channels ?? ['all']).join(',')}) → ${reference}`,
      );
      // Mock skips the hosted page — caller redirects straight to the order screen.
      return { reference, checkoutUrl: args.callbackUrl };
    }
    const res = await fetch(`${this.baseUrl}/transaction/initialize`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.secret}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        email: args.email,
        reference: args.reference,
        amount: Math.round(args.amountKes * 100), // KES → subunit
        currency: 'KES',
        callback_url: args.callbackUrl,
        channels: args.channels,
        metadata: args.phone ? { phone: args.phone } : undefined,
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) {
      throw new Error(`Paystack initialize failed: HTTP ${res.status}`);
    }
    const body = (await res.json()) as {
      status?: boolean;
      data?: { authorization_url?: string; reference?: string };
    };
    const ref = body.data?.reference;
    const url = body.data?.authorization_url;
    if (!body.status || !ref || !url) {
      throw new Error('Paystack initialize returned no checkout URL.');
    }
    return { reference: ref, checkoutUrl: url };
  }

  /** Verify a transaction — the source of truth before fulfilling. */
  async verifyTransaction(reference: string): Promise<VerifyResult> {
    if (this.isMock) {
      const t = this.mockTxns.get(reference);
      if (!t) return { reference, state: 'FAILED' };
      return {
        reference,
        state: t.state,
        channel: 'mock',
        feesKes: 0,
        netKes: t.amountKes,
        amountSubunit: Math.round(t.amountKes * 100),
        currency: 'KES',
        environment: 'mock',
      };
    }
    const res = await fetch(
      `${this.baseUrl}/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: { authorization: `Bearer ${this.secret}` },
        signal: AbortSignal.timeout(20000),
      },
    );
    if (!res.ok) throw new Error(`Paystack verify failed: HTTP ${res.status}`);
    const body = (await res.json()) as {
      data?: {
        status?: string;
        amount?: number;
        fees?: number;
        channel?: string;
        reference?: string;
        currency?: string;
        domain?: string;
      };
    };
    const d = body.data;
    if (!d) throw new Error('Paystack verify returned no data.');
    const amountKes = (d.amount ?? 0) / 100;
    const feesKes = d.fees !== undefined ? d.fees / 100 : undefined;
    return {
      reference: d.reference ?? '',
      amountSubunit: d.amount,
      currency: d.currency,
      environment: d.domain,
      state: mapTxnState(d.status),
      channel: d.channel,
      feesKes,
      netKes: feesKes !== undefined ? amountKes - feesKes : amountKes,
    };
  }

  /**
   * Refund a transaction. We always issue a FULL refund (Paystack refunds the
   * full captured amount when `amount` is omitted), which is exactly what the
   * auto-refund and admin-refund paths need — so the (KES) amount arg is unused.
   */
  async refund(
    reference: string,
    _amountKes?: number,
    reason = 'Service could not be delivered',
  ): Promise<{ ref: string; status: string }> {
    if (this.isMock) {
      this.logger.warn(`↩️ [MOCK PAYSTACK REFUND] ${reference}`);
      return {
        ref: `mock_rf_${randomBytes(6).toString('hex')}`,
        status: 'pending',
      };
    }
    const res = await fetch(`${this.baseUrl}/refund`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.secret}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ transaction: reference, merchant_note: reason }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) {
      throw new Error(`Paystack refund failed: HTTP ${res.status}`);
    }
    const body = (await res.json()) as {
      data?: { id?: number | string; status?: string };
    };
    if (!body.data?.id)
      throw new Error(
        'Paystack refund returned no reference; reconcile manually.',
      );
    return {
      ref: String(body.data.id),
      status: normalizeRefundState(body.data?.status ?? 'pending'),
    };
  }

  /** Poll a refund's status. */
  async getRefundStatus(refundId: string): Promise<{ status: string }> {
    if (this.isMock) return { status: 'completed' };
    const res = await fetch(
      `${this.baseUrl}/refund/${encodeURIComponent(refundId)}`,
      {
        headers: { authorization: `Bearer ${this.secret}` },
        signal: AbortSignal.timeout(20000),
      },
    );
    if (!res.ok)
      throw new Error(`Paystack refund status failed: HTTP ${res.status}`);
    const body = (await res.json()) as { data?: { status?: string } };
    return { status: normalizeRefundState(body.data?.status ?? 'pending') };
  }

  /**
   * Verify a webhook came from Paystack: HMAC-SHA512 of the RAW request body
   * using the secret key, compared (constant-time) to x-paystack-signature.
   */
  verifySignature(rawBody: Buffer, signature?: string): boolean {
    if (this.isMock) return false;
    if (!signature) return false;
    const secret = this.config.get('PAYSTACK_SECRET_KEY');
    if (!secret) return false;
    const expected = createHmac('sha512', secret).update(rawBody).digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  /**
   * Partner payout. DEFERRED: Paystack Transfers to M-Pesa (Kenya) require the
   * Transfers feature to be enabled/approved on the account, so for launch we
   * record the payout for MANUAL settlement (admin pays out, then marks it
   * complete) rather than moving money automatically.
   */
  sendMoney(args: { phone: string; amountKes: number; name?: string }): {
    trackingId: string;
    pending: boolean;
  } {
    this.logger.warn(
      `🏦 [PAYOUT QUEUED — settle manually] ${args.phone} ← KES ${args.amountKes} (${args.name ?? ''})`,
    );
    return {
      trackingId: `manual_${randomBytes(6).toString('hex')}`,
      pending: true,
    };
  }
}

function mapTxnState(status?: string): PaystackTxnState {
  switch (status) {
    case 'success':
      return 'COMPLETE';
    case 'failed':
      return 'FAILED';
    case 'reversed':
      return 'CANCELED';
    default:
      return 'PENDING'; // ongoing | pending | processing | abandoned | queued
  }
}

/** Map Paystack refund statuses to our vocabulary: pending|processing|completed|failed. */
function normalizeRefundState(status: string): string {
  const v = status.toLowerCase();
  return v === 'processed' ? 'completed' : v;
}
