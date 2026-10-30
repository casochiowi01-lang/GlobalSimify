/**
 * Typed client for the GlobalSimify backend. Works on both the server (RSC
 * data fetching) and the client (search island). Shapes mirror the backend
 * catalog DTOs.
 */

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/api/v1';

export interface Country {
  iso: string;
  name: string;
  region: string;
  flagEmoji: string;
  seoSlug: string;
  scope: 'COUNTRY' | 'REGION' | 'GLOBAL';
  popularRank: number | null;
  fromPriceKes: number;
  productCount: number;
}

export interface Product {
  id: string;
  providerPackageId: string;
  destIso: string;
  destName: string;
  destSlug: string;
  region: string;
  scope: 'COUNTRY' | 'REGION' | 'GLOBAL';
  title: string;
  dataMb: number;
  unlimited: boolean;
  dataLabel: string;
  validityDays: number;
  minDays?: number;
  priceKes: number;
  speed: string[];
  coverageCount: number;
}

export interface CountryWithProducts extends Country {
  products: Product[];
}

export interface SearchResult {
  type: 'country';
  iso: string;
  name: string;
  region: string;
  flagEmoji: string;
  seoSlug: string;
  fromPriceKes: number;
}

export interface EsimView {
  id: string;
  iccid: string;
  smdpAddress: string;
  matchingId: string;
  lpa: string;
  dataMb: number;
  validityDays: number;
  profileStatus: string;
  destIso?: string;
}

export type OrderStatus =
  | 'DRAFT'
  | 'AWAITING_PAYMENT'
  | 'PAID'
  | 'PROVISIONING'
  | 'PROVISIONED'
  | 'COMPLETED'
  | 'PAYMENT_FAILED'
  | 'PROVISION_FAILED'
  | 'REFUND_PENDING'
  | 'REFUNDED'
  | 'MANUAL_REVIEW'
  | 'CANCELLED';

export interface UsageDto {
  initialBytes: number;
  remainingBytes: number;
  usedBytes: number;
  pctUsed: number;
  remainingLabel: string;
  totalLabel: string;
  expiresAt: string | null;
  daysLeft: number | null;
}

export interface OrderView {
  id: string;
  status: OrderStatus;
  kind?: 'PURCHASE' | 'TOPUP';
  targetIccid?: string | null;
  title: string;
  totalKes: number;
  currency: string;
  customerPhone: string;
  failureReason: string | null;
  createdAt: string;
  esim: EsimView | null;
  esims?: EsimView[];
  quantity?: number;
}

async function get<T>(path: string, revalidate = 300): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    // ISR-style caching for catalogue reads; tune per route.
    next: { revalidate },
    headers: { accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`API ${res.status} for ${path}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  countries: (region?: string) =>
    get<Country[]>(
      `/countries${region ? `?region=${encodeURIComponent(region)}` : ''}`,
    ),
  country: (slugOrIso: string) =>
    get<CountryWithProducts>(`/countries/${encodeURIComponent(slugOrIso)}`),
  products: (dest?: string) =>
    get<Product[]>(
      `/products${dest ? `?dest=${encodeURIComponent(dest)}` : ''}`,
    ),
  product: (id: string) => get<Product>(`/products/${encodeURIComponent(id)}`),
  search: (q: string) =>
    get<SearchResult[]>(`/search?q=${encodeURIComponent(q)}`, 0),
  validatePromo: async (code: string, amountKes: number) => {
    const res = await fetch(`${API_BASE}/promotions/validate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code, amountKes }),
    });
    return res.json() as Promise<{
      valid: boolean;
      discountKes: number;
      reason?: string;
    }>;
  },
};
