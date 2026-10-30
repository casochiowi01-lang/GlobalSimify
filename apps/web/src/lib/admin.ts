// Types for the admin console. All monetary values are USD (platform currency),
// despite legacy `*Kes` naming on the backend; formatMoney renders them as $.

export type Role = 'CUSTOMER' | 'PARTNER' | 'ADMIN';
export type AccountStatus = 'ACTIVE' | 'BLOCKED';

export interface AdminDashboard {
  revenue: number;
  cogs: number;
  grossProfit: number;
  marginPct: number;
  paidOrders: number;
  esimsIssued: number;
  customers: number;
  currency: string;
  ordersByStatus: { status: string; count: number }[];
  topDestinations: { destination: string; revenue: number; orders: number }[];
  supplier: { name: string; billingModel: string };
}

export interface AdminOrder {
  id: string;
  status: string;
  kind: string;
  title: string;
  customerEmail: string | null;
  customerPhone: string | null;
  customerName: string | null;
  createdAt: string;
  currency: string;
  revenue: number;
  cogs: number;
  profit: number;
  promoCode: string | null;
  failureReason: string | null;
  esim: { id: string; iccid: string } | null;
  payment: { state: string; method: string } | null;
}

export interface AdminUser {
  id: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  role: Role;
  status: AccountStatus;
  createdAt: string;
  orders: number;
  esims: number;
}

export interface PricingConfig {
  marginPct: number;
  fxBufferPct: number;
  processorFeePct: number;
  roundTo: number;
  fxRate: number;
  fxApproved: boolean;
  fxConfirmedAt: string | null;
  fxExpiresAt: string | null;
}

export interface AnalyticsPoint {
  period: string;
  revenue: number;
  cogs: number;
  profit: number;
  orders: number;
}

export interface AnalyticsResponse {
  from: string;
  to: string;
  granularity: string;
  currency: string;
  series: AnalyticsPoint[];
}

export interface EsimLookup {
  found: boolean;
  esim?: {
    id: string;
    iccid: string;
    smdpAddress: string;
    matchingId: string;
    lpa: string;
    profileStatus: string;
    dataMb: number;
    validityDays: number;
    remainingBytes: number;
    initialBytes: number;
    expiresAt: string | null;
  };
  order?: AdminOrder | null;
  customer?: {
    id: string;
    email: string | null;
    name: string | null;
    phone: string | null;
  } | null;
  device?: {
    oem: string;
    hardwareName: string;
    hardwareModel: string;
    eid: string;
  } | null;
  history?: { status: string; statusDate: string }[];
}

export interface Promo {
  id: string;
  code: string;
  kind: string;
  value: string | number;
  minSpendKes: string | number | null;
  maxUses: number | null;
  usedCount: number;
  active: boolean;
  validTo: string | null;
}

const STATUS_TONE: Record<string, string> = {
  COMPLETED: 'bg-teal-100 text-teal-800',
  PROVISIONED: 'bg-teal-100 text-teal-800',
  PAID: 'bg-amber-100 text-amber-800',
  PROVISIONING: 'bg-amber-100 text-amber-800',
  AWAITING_PAYMENT: 'bg-amber-100 text-amber-800',
  DRAFT: 'bg-zinc-100 text-zinc-600',
  PAYMENT_FAILED: 'bg-red-100 text-red-800',
  PROVISION_FAILED: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-red-100 text-red-800',
  REFUNDED: 'bg-zinc-200 text-zinc-700',
  REFUND_PENDING: 'bg-zinc-200 text-zinc-700',
  MANUAL_REVIEW: 'bg-purple-100 text-purple-800',
  NEW: 'bg-amber-100 text-amber-800',
  CONTACTED: 'bg-teal-100 text-teal-800',
  CLOSED: 'bg-zinc-200 text-zinc-700',
};

export function statusTone(status: string): string {
  return STATUS_TONE[status] ?? 'bg-zinc-100 text-zinc-700';
}
