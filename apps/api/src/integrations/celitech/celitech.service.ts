import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { AppConfigService } from '../../config/config.module.js';
import { buildMockPackages } from './mock-data.js';
import { classifyDestination } from './geo.js';
import type {
  Consumption,
  EsimDevice,
  EsimHistoryEntry,
  EsimPackage,
  EsimProfile,
  ProvisionRequest,
} from './celitech.types.js';

interface Destination {
  name: string;
  destination: string;
  destinationISO2: string;
  supportedCountries: string[];
}
interface Package {
  id: string;
  destination: string;
  destinationISO2: string;
  dataLimitInGB: number;
  minDays: number;
  maxDays: number;
  priceInCents: number;
}
interface Purchase {
  id: string;
  referenceId?: string;
  startDate: string | null;
  endDate: string | null;
  esim: { iccid: string };
}
interface Profile {
  iccid: string;
  manualActivationCode: string;
  activationCode?: string;
  isTopUpAllowed?: boolean;
  status?: string;
  iosActivationLink?: string;
  androidActivationLink?: string;
}

/** Postpaid reseller adapter. Explicit production endpoints; no automatic POST retries.
 * Current wire fields are used directly because SDK v2 strips newer IDs/flags.
 * Email is omitted: GlobalSimify sends its own branded delivery via Resend.
 */
@Injectable()
export class CelitechService {
  private readonly logger = new Logger(CelitechService.name);
  private token?: { value: string; expires: number };
  private tokenPending?: Promise<string>;
  private cache?: { at: number; data: EsimPackage[] };
  private cataloguePending?: Promise<EsimPackage[]>;
  constructor(private readonly config: AppConfigService) {}
  get isMock() {
    return this.config.get('CELITECH_MODE') === 'mock';
  }
  get billingModel(): 'postpaid' {
    return 'postpaid';
  }

  private async accessToken(): Promise<string> {
    if (this.token && this.token.expires > Date.now() + 60000)
      return this.token.value;
    if (this.tokenPending) return this.tokenPending;
    this.tokenPending = (async () => {
      if (this.config.get('CELITECH_ENVIRONMENT') !== 'PRODUCTION')
        throw new Error('Unsupported CELITECH environment.');
      const client_id = this.config.get('CELITECH_CLIENT_ID');
      const client_secret = this.config.get('CELITECH_CLIENT_SECRET');
      if (!client_id || !client_secret)
        throw new Error('CELITECH credentials are not configured.');
      const r = await fetch('https://auth.celitech.net/oauth2/token', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id,
          client_secret,
        }),
        signal: AbortSignal.timeout(20000),
      });
      if (!r.ok) throw new Error('CELITECH authentication HTTP ' + r.status);
      const d = (await r.json()) as {
        access_token: string;
        expires_in: number;
      };
      if (!d.access_token || !(d.expires_in > 0))
        throw new Error('Invalid CELITECH token response.');
      this.token = {
        value: d.access_token,
        expires: Date.now() + d.expires_in * 1000,
      };
      return d.access_token;
    })();
    try {
      return await this.tokenPending;
    } finally {
      this.tokenPending = undefined;
    }
  }

  private async request<T>(path: string, body?: object): Promise<T> {
    const token = await this.accessToken();
    const r = await fetch('https://api.celitech.net/v1' + path, {
      method: body ? 'POST' : 'GET',
      headers: {
        authorization: 'Bearer ' + token,
        'content-type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30000),
    });
    if (r.status === 401) this.token = undefined;
    // Never log supplier response bodies: they may contain activation credentials.
    if (!r.ok)
      throw new Error(
        'CELITECH ' + (body ? 'write' : 'read') + ' HTTP ' + r.status,
      );
    return (await r.json()) as T;
  }

  private async packages(
    filters: Record<string, string> = {},
  ): Promise<Package[]> {
    const rows: Package[] = [];
    const seen = new Set<string>();
    let cursor: string | null = null;
    do {
      const q = new URLSearchParams({
        limit: '160',
        includeUnlimited: 'true',
        ...filters,
      });
      if (cursor) q.set('afterCursor', cursor);
      const page = await this.request<{
        packages: Package[];
        afterCursor: string | null;
      }>(`/packages?${q.toString()}`);
      if (!Array.isArray(page.packages))
        throw new Error('Invalid CELITECH catalogue response.');
      rows.push(...page.packages);
      cursor = page.afterCursor;
      if (cursor && seen.has(cursor))
        throw new Error('Repeated CELITECH catalogue cursor.');
      if (cursor) seen.add(cursor);
      if (seen.size > 2000)
        throw new Error(
          'Catalogue safety limit reached; refusing a partial catalogue.',
        );
    } while (cursor);
    return rows;
  }

  async getCatalogue(force = false): Promise<EsimPackage[]> {
    if (this.isMock) return buildMockPackages();
    if (!force && this.cache && Date.now() - this.cache.at < 21600000)
      return this.cache.data;
    if (this.cataloguePending) return this.cataloguePending;
    this.cataloguePending = this.fetchCatalogue();
    try {
      const data = await this.cataloguePending;
      this.cache = { data, at: Date.now() };
      return data;
    } catch (e) {
      if (this.cache && !force) {
        this.logger.warn(
          'Supplier refresh failed; retaining cache. Checkout still revalidates.',
        );
        return this.cache.data;
      }
      throw e;
    } finally {
      this.cataloguePending = undefined;
    }
  }

  private async fetchCatalogue() {
    const { destinations } = await this.request<{
      destinations: Destination[];
    }>('/destinations');
    const byCode = new Map(destinations.map((d) => [d.destination, d]));
    const byName = new Map(destinations.map((d) => [d.name.toLowerCase(), d]));
    const out = new Map<string, EsimPackage>();
    for (const p of await this.packages()) {
      const d = byCode.get(p.destination);
      if (!p.id || !d || !Number.isFinite(p.priceInCents) || p.priceInCents < 0)
        throw new Error('Invalid CELITECH package.');
      if (
        this.config.get('CELITECH_ALLOW_RESTRICTED') !== 'true' &&
        (p.dataLimitInGB === 0.5 || /region[ -]?4/i.test(d.name))
      )
        continue;
      const unlimited = p.dataLimitInGB === -1;
      if (
        unlimited &&
        (p.minDays !== p.maxDays || p.minDays < 3 || p.maxDays > 30)
      )
        continue;
      const id = unlimited ? 'live_' + p.destination + '_unlimited' : p.id;
      const { scope, region } = classifyDestination(
        d.destinationISO2 || p.destination,
        d.name,
      );
      if (out.has(id)) continue;
      out.set(id, {
        providerPackageId: id,
        supplierDestination: p.destination,
        destinationIso2: d.destinationISO2 || p.destination,
        destinationName: d.name,
        region,
        scope,
        dataGb: unlimited ? 0 : p.dataLimitInGB,
        unlimited,
        minDays: unlimited ? 3 : Math.max(1, p.minDays),
        validityDays: unlimited ? 30 : p.maxDays,
        priceUsd: p.priceInCents / 100 / (unlimited ? p.minDays : 1),
        priceBasis: unlimited ? 'DAY' : 'PACKAGE',
        countries: (d.supportedCountries ?? [d.name]).map((name) => ({
          name,
          iso: byName.get(name.toLowerCase())?.destinationISO2 ?? '',
          region,
        })),
      });
    }
    return [...out.values()];
  }

  /** Dated API quote is TOTAL package wholesale, not a per-day rate. */
  async quote(
    destination: string,
    dataGb: number,
    startDate: string,
    endDate: string,
    days: number,
  ) {
    const matches = (
      await this.packages({
        destination,
        dataLimitInGB: String(dataGb),
        startDate,
        endDate,
      })
    ).filter(
      (p) =>
        p.dataLimitInGB === dataGb &&
        (!p.destination || p.destination === destination) &&
        days >= Math.max(1, p.minDays) &&
        days <= p.maxDays,
    );
    if (matches.length !== 1)
      throw new BadRequestException(
        'Package unavailable for these dates. Refresh your selection.',
      );
    if (
      !matches[0].id ||
      !Number.isFinite(matches[0].priceInCents) ||
      matches[0].priceInCents <= 0
    )
      throw new BadRequestException(
        'Supplier price unavailable. Please try again later.',
      );
    return {
      priceUsd: matches[0].priceInCents / 100,
      packageId: matches[0].id,
    };
  }

  /** Lookup failure propagates; it must never cause a fresh billable purchase. */
  async findByReference(reference: string): Promise<EsimProfile | null> {
    if (this.isMock) return null;
    const { purchases, afterCursor } = await this.request<{
      purchases: Purchase[];
      afterCursor: string | null;
    }>(
      `/purchases?${new URLSearchParams({ referenceId: reference, limit: '100' }).toString()}`,
    );
    if (purchases.length > 1 || afterCursor)
      throw new Error(
        'Ambiguous supplier reference; manual reconciliation required.',
      );
    const p = purchases[0];
    if (!p) return null;
    if (p.referenceId !== reference || !p.esim?.iccid || !p.id)
      throw new Error('Supplier reference mismatch.');
    const { esim } = await this.request<{ esim: Profile }>(
      `/esim?${new URLSearchParams({ iccid: p.esim.iccid }).toString()}`,
    );
    return {
      ...this.profile(esim, p.id),
      startDate: p.startDate,
      endDate: p.endDate,
    };
  }

  async provision(req: ProvisionRequest): Promise<EsimProfile> {
    if (this.isMock) {
      const hex = createHash('sha256').update(req.referenceId).digest('hex');
      const iccid =
        '8944' +
        BigInt('0x' + hex.slice(0, 15))
          .toString()
          .padStart(15, '0')
          .slice(0, 15);
      return {
        providerPurchaseId: 'mock_' + hex.slice(0, 24),
        iccid,
        smdpAddress: 'mock.invalid',
        matchingId: hex.slice(0, 24),
        lpa: 'LPA:1$mock.invalid$' + hex.slice(0, 24),
        startDate: req.startDate,
        endDate: req.endDate,
      };
    }
    const rows = await this.request<
      {
        purchase: {
          id: string;
          startDate?: string | null;
          endDate?: string | null;
        };
        profile: Profile;
      }[]
    >('/purchases/v2', {
      destination: req.destinationIso,
      dataLimitInGB: req.dataGb,
      quantity: 1,
      startDate: req.startDate,
      endDate: req.endDate,
      referenceId: req.referenceId,
    });
    if (rows.length !== 1)
      throw new Error('Unexpected supplier count; reconcile before retry.');
    return {
      ...this.profile(rows[0].profile, rows[0].purchase.id),
      startDate: rows[0].purchase.startDate,
      endDate: rows[0].purchase.endDate,
    };
  }

  async topUp(
    args: ProvisionRequest & { iccid: string },
  ): Promise<EsimProfile> {
    if (this.isMock)
      return { ...(await this.provision(args)), iccid: args.iccid };
    const r = await this.request<{
      purchase: {
        id: string;
        startDate: string | null;
        endDate: string | null;
      };
      profile: { iccid: string };
    }>('/purchases/topup', {
      iccid: args.iccid,
      dataLimitInGB: args.dataGb,
      startDate: args.startDate,
      endDate: args.endDate,
      referenceId: args.referenceId,
    });
    if (!r.purchase?.id || r.profile?.iccid !== args.iccid)
      throw new Error('Invalid top-up result; reconcile before retry.');
    return {
      providerPurchaseId: r.purchase.id,
      iccid: args.iccid,
      lpa: '',
      smdpAddress: '',
      matchingId: '',
      startDate: r.purchase.startDate,
      endDate: r.purchase.endDate,
    };
  }

  async canTopUp(iccid: string) {
    if (this.isMock) return true;
    const { esim } = await this.request<{ esim: Profile }>(
      `/esim?${new URLSearchParams({ iccid }).toString()}`,
    );
    return esim.isTopUpAllowed === true;
  }
  async getPurchase(purchaseId: string) {
    if (this.isMock || purchaseId.startsWith('mock_')) return null;
    const r = await this.request<{ purchases: Purchase[] }>(
      `/purchases?${new URLSearchParams({ purchaseId }).toString()}`,
    );
    return r.purchases.find((p) => p.id === purchaseId) ?? null;
  }
  async getConsumption(purchaseId: string): Promise<Consumption | null> {
    if (this.isMock || purchaseId.startsWith('mock_')) return null;
    const r = await this.request<{
      dataUsageRemainingInGB: number;
      status: string;
    }>('/purchases/' + encodeURIComponent(purchaseId) + '/consumption');
    if (
      !Number.isFinite(r.dataUsageRemainingInGB) ||
      r.dataUsageRemainingInGB < -1
    )
      throw new Error('Invalid supplier balance.');
    return {
      remainingBytes:
        r.dataUsageRemainingInGB === -1
          ? -1
          : Math.round(r.dataUsageRemainingInGB * 1e9),
      status: r.status,
    };
  }
  async editPurchase(purchaseId: string, startDate: string, endDate: string) {
    if (this.isMock) return { startDate, endDate };
    if (purchaseId.startsWith('mock_'))
      throw new BadRequestException('Test eSIMs cannot be modified live.');
    const r = await this.request<{
      newStartDate: string | null;
      newEndDate: string | null;
    }>('/purchases/edit', { purchaseId, startDate, endDate });
    return { startDate: r.newStartDate, endDate: r.newEndDate };
  }
  async getDevice(iccid: string): Promise<EsimDevice | null> {
    if (this.isMock) return null;
    return (
      await this.request<{ device: EsimDevice }>(
        '/esim/' + encodeURIComponent(iccid) + '/device',
      )
    ).device;
  }
  async getHistory(iccid: string): Promise<EsimHistoryEntry[]> {
    if (this.isMock) return [];
    return (
      await this.request<{ esim: { history: EsimHistoryEntry[] } }>(
        '/esim/' + encodeURIComponent(iccid) + '/history',
      )
    ).esim.history;
  }
  private profile(p: Profile, id: string): EsimProfile {
    const [prefix, smdpAddress, matchingId] = (
      p.manualActivationCode ?? ''
    ).split('$');
    if (!id || !p.iccid || prefix !== 'LPA:1' || !smdpAddress || !matchingId)
      throw new Error('Invalid activation profile; reconcile before retry.');
    return {
      providerPurchaseId: id,
      iccid: p.iccid,
      smdpAddress,
      matchingId,
      lpa: p.manualActivationCode,
      qrBase64: p.activationCode,
      iosActivationLink: p.iosActivationLink,
      androidActivationLink: p.androidActivationLink,
    };
  }
}
