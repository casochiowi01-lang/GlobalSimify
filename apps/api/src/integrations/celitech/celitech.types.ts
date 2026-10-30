/**
 * Normalised view of the Celitech catalogue + provisioning. The rest of the app
 * depends only on these types, so the supplier stays contained to this folder.
 *
 * Celitech specifics (verified against the current OpenAPI spec at
 * https://api.celitech.com/swagger.yaml; base URL https://api.celitech.net/v1,
 * OAuth2 client-credentials token at https://auth.celitech.net/oauth2/token):
 *  - Catalogue = destinations { name, destination, destinationISO2,
 *    supportedCountries[] } + packages { id, destination, dataLimitInGB,
 *    minDays, maxDays, priceInCents }. Date-filtered prices are trip totals.
 *  - Provisioning = createPurchaseV2({ destination, dataLimitInGB, quantity,
 *    startDate, endDate, email, referenceId }) → [{ purchase.id, profile:{ iccid,
 *    activationCode (base64 QR), manualActivationCode (LPA), iosActivationLink,
 *    androidActivationLink } }]. smdpAddress is parsed from the LPA.
 *  - Top-up = topUpEsim({ iccid, dataLimitInGB, ... }) → { purchase, profile }.
 *  - Usage = getPurchaseConsumption(purchaseId) → { dataUsageRemainingInGB,
 *    status }; polling plus optional signed webhooks. -1 denotes unlimited.
 *  - Billing = postpaid (Stripe invoice). No prepaid wallet/float.
 *  - referenceId is correlation, not a guarantee of supplier-side idempotency.
 */

export interface EsimCountry {
  iso: string; // ISO-3166 alpha-2
  name: string;
  region: string | null;
}

export interface EsimPackage {
  /** Supplier package ID, or a stable local ID for a grouped unlimited product. */
  providerPackageId: string;
  supplierDestination?: string;
  minDays?: number;
  priceBasis?: 'DAY' | 'PACKAGE';
  speed?: string[];
  destinationIso2: string;
  destinationName: string;
  region: string | null;
  dataGb: number;
  validityDays: number;
  /** Wholesale USD. For an unlimited plan this is the PER-DAY rate. */
  priceUsd: number;
  /** True for unlimited-data plans (priceUsd is per-day; dataGb is 0). */
  unlimited?: boolean;
  scope: 'COUNTRY' | 'REGION' | 'GLOBAL';
  countries: EsimCountry[];
}

export interface ProvisionRequest {
  destinationIso: string; // ISO2 or ISO3
  dataGb: number;
  validityDays: number;
  referenceId: string; // unique per fulfilment; ambiguous writes require reconciliation
  startDate?: string;
  endDate?: string;
  email?: string;
}

export interface EsimProfile {
  providerPurchaseId: string; // Celitech purchase.id — needed for consumption
  iccid: string;
  smdpAddress: string;
  matchingId: string;
  lpa: string; // LPA:1$<smdp>$<matchingId> (manualActivationCode)
  qrBase64?: string; // Celitech activationCode (base64 QR image), if available
  iosActivationLink?: string; // one-tap iOS install link, if available
  androidActivationLink?: string; // one-tap Android install link, if available
  startDate?: string | null;
  endDate?: string | null;
}

export interface Consumption {
  remainingBytes: number;
  status: string;
}

/** Device an eSIM has been installed on (known only after install). */
export interface EsimDevice {
  oem: string;
  hardwareName: string;
  hardwareModel: string;
  eid: string;
}

/** One entry in an eSIM's status timeline (e.g. RELEASED → INSTALLED → ENABLED). */
export interface EsimHistoryEntry {
  status: string;
  statusDate: string;
}
