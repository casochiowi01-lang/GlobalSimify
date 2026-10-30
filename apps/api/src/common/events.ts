/** Domain events published on the in-process event bus (decouples modules). */

export const Events = {
  PaymentCompleted: 'payment.completed',
  EsimProvisioned: 'esim.provisioned',
  UsageThreshold: 'usage.threshold',
  EsimExpiring: 'esim.expiring',
} as const;

export interface PaymentCompletedEvent {
  orderId: string;
  userId?: string | null;
  customerEmail?: string | null;
  title: string;
  amountUsd: number;
  currency: string;
  method: string; // MPESA | CARD
  reference?: string | null; // e.g. M-Pesa receipt
  kind: string; // PURCHASE | TOPUP
}

export interface EsimProvisionedEvent {
  orderId: string;
  esimId: string;
  userId?: string | null;
  customerPhone: string;
  customerEmail?: string | null;
  title: string;
  lpa: string;
}

export interface UsageThresholdEvent {
  esimId: string;
  userId?: string | null;
  threshold: 50 | 80 | 100;
  title: string;
  remainingBytes: number;
  initialBytes: number;
}

export interface EsimExpiringEvent {
  esimId: string;
  userId?: string | null;
  title: string;
  daysLeft: number;
}
