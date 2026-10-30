import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CelitechService } from '../../integrations/celitech/celitech.service.js';
import type { EsimPackage } from '../../integrations/celitech/celitech.types.js';
import { PricingService } from '../pricing/pricing.service.js';
import type { CountryDto, ProductDto, SearchResultDto } from './catalog.dto.js';

/**
 * In-memory catalogue read model. Built once at boot from the Celitech adapter
 * and the pricing engine. (When a database is configured, a Catalog-Sync
 * worker will persist this; the read API stays the same.) The storefront reads
 * exclusively from here — it never hits Celitech on a page load.
 */
@Injectable()
export class CatalogService implements OnModuleInit {
  private readonly logger = new Logger(CatalogService.name);
  private products: ProductDto[] = [];
  private countries: CountryDto[] = [];
  private building = false;
  private builtAt: Date | null = null;
  get availability() {
    return {
      available: this.products.length > 0,
      products: this.products.length,
      lastBuiltAt: this.builtAt,
    };
  }
  private readonly byId = new Map<string, ProductDto>();
  // Wholesale USD cost per product id — server-side only, never exposed.
  private readonly baseUsdById = new Map<string, number>();

  // Search aliases → destination ISO, for the Kenyan-traveller vocabulary.
  private readonly aliases: Record<string, string> = {
    dubai: 'AE',
    uae: 'AE',
    emirates: 'AE',
    'abu dhabi': 'AE',
    uk: 'GB',
    england: 'GB',
    britain: 'GB',
    london: 'GB',
    usa: 'US',
    america: 'US',
    'united states': 'US',
    'new york': 'US',
    europe: 'EU',
    schengen: 'EU',
    eu: 'EU',
    global: 'GX',
    worldwide: 'GX',
    world: 'GX',
    turkey: 'TR',
    istanbul: 'TR',
    'saudi arabia': 'SA',
    ksa: 'SA',
    mecca: 'SA',
    jeddah: 'SA',
    bangkok: 'TH',
    thailand: 'TH',
    'south africa': 'ZA',
    johannesburg: 'ZA',
    'cape town': 'ZA',
  };

  private readonly popularOrder = [
    'AE',
    'GB',
    'EU',
    'US',
    'SA',
    'QA',
    'CN',
    'IN',
    'TR',
    'ZA',
    'TH',
    'GX',
  ];

  constructor(
    private readonly celitech: CelitechService,
    private readonly pricing: PricingService,
  ) {}

  onModuleInit(): void {
    // Bind the HTTP port while the initial supplier catalogue loads.
    void this.build();
  }

  /** On-demand refresh keeps a sleeping instance's displayed estimates current. */
  async ensureFresh(): Promise<void> {
    if (!this.builtAt || Date.now() - this.builtAt.getTime() > 60000)
      await this.build();
  }

  /**
   * Rebuild the in-memory catalogue (also used by an admin refresh later).
   * Never throws: a supplier/DB hiccup at boot must not stop the server from
   * binding its port and serving /health. Builds into locals and swaps them in
   * atomically, so a failure leaves the previous catalogue intact.
   */
  @Cron(CronExpression.EVERY_MINUTE, { waitForCompletion: true })
  async build(): Promise<void> {
    if (this.building) return;
    this.building = true;
    try {
      const packages = await this.celitech.getCatalogue();
      const products: ProductDto[] = [];
      const baseUsd = new Map<string, number>();
      for (const pkg of packages) {
        const { retailKes } = await this.pricing.priceUsd(pkg.priceUsd);
        products.push(this.toProduct(pkg, retailKes));
        baseUsd.set(pkg.providerPackageId, pkg.priceUsd);
      }
      this.products = products;
      this.baseUsdById.clear();
      for (const [k, v] of baseUsd) this.baseUsdById.set(k, v);
      this.byId.clear();
      for (const p of products) this.byId.set(p.id, p);
      this.countries = this.buildCountries(products);
      this.builtAt = new Date();
      this.logger.log(
        `Catalogue built: ${products.length} products across ${this.countries.length} destinations (mode=${this.celitech.isMock ? 'mock' : 'live'}).`,
      );
    } catch (err) {
      this.logger.error(
        `Catalogue build failed (serving existing/empty until next refresh): ${(err as Error).message}`,
      );
    } finally {
      this.building = false;
    }
  }

  listCountries(region?: string): CountryDto[] {
    const list = region
      ? this.countries.filter(
          (c) => c.region.toLowerCase() === region.toLowerCase(),
        )
      : this.countries;
    return [...list].sort(sortByPopularity);
  }

  getCountry(iso: string): CountryDto | undefined {
    const up = iso.toUpperCase();
    return (
      this.countries.find((c) => c.iso === up) ??
      this.countries.find((c) => c.seoSlug === iso.toLowerCase())
    );
  }

  listProducts(destIso?: string): ProductDto[] {
    const list = destIso
      ? this.products.filter((p) => p.destIso === destIso.toUpperCase())
      : this.products;
    return [...list].sort((a, b) => a.priceKes - b.priceKes);
  }

  getProduct(id: string): ProductDto | undefined {
    return this.byId.get(id);
  }

  /** Server-side wholesale cost for order price snapshotting. */
  getBaseUsd(id: string): number | undefined {
    return this.baseUsdById.get(id);
  }

  search(q: string, limit = 8): SearchResultDto[] {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    // Any alias key containing the typed term contributes its destination,
    // so "du" → dubai → AE works for autocomplete.
    const aliasIsos = new Set<string>();
    for (const [alias, iso] of Object.entries(this.aliases)) {
      if (alias.includes(term)) aliasIsos.add(iso);
    }
    const matches = this.countries.filter(
      (c) =>
        aliasIsos.has(c.iso) ||
        c.name.toLowerCase().includes(term) ||
        c.iso.toLowerCase() === term ||
        c.region.toLowerCase().includes(term),
    );
    const startsWith = (c: CountryDto) =>
      c.name.toLowerCase().startsWith(term) ||
      Object.entries(this.aliases).some(
        ([a, iso]) => iso === c.iso && a.startsWith(term),
      );
    matches.sort((a, b) => {
      const sa = startsWith(a) ? 0 : 1;
      const sb = startsWith(b) ? 0 : 1;
      if (sa !== sb) return sa - sb;
      return sortByPopularity(a, b);
    });
    return matches.slice(0, limit).map((c) => ({
      type: 'country',
      iso: c.iso,
      name: c.name,
      region: c.region,
      flagEmoji: c.flagEmoji,
      seoSlug: c.seoSlug,
      fromPriceKes: c.fromPriceKes,
    }));
  }

  // --- internal mapping ---------------------------------------------------

  private toProduct(pkg: EsimPackage, retailKes: number): ProductDto {
    const region = pkg.scope === 'GLOBAL' ? 'Global' : (pkg.region ?? 'Other');
    const unlimited = !!pkg.unlimited;
    // For unlimited, retailKes is the PER-DAY price and dataMb is 0.
    const dataMb = unlimited ? 0 : Math.round(pkg.dataGb * 1000);
    return {
      id: pkg.providerPackageId,
      providerPackageId: pkg.providerPackageId,
      destIso: pkg.destinationIso2,
      destName: pkg.destinationName,
      destSlug: slugify(pkg.destinationName),
      region,
      scope: pkg.scope,
      title: unlimited
        ? `Unlimited data · ${pkg.destinationName}`
        : `${pkg.dataGb}GB · ${pkg.validityDays} days · ${pkg.destinationName}`,
      dataMb,
      unlimited,
      dataLabel: unlimited ? 'Unlimited' : `${pkg.dataGb} GB`,
      validityDays: pkg.validityDays,
      minDays:
        pkg.minDays ?? (pkg.unlimited ? 3 : pkg.validityDays > 30 ? 31 : 1),
      supplierDestination: pkg.supplierDestination ?? pkg.destinationIso2,
      priceKes: retailKes,
      speed: pkg.speed ?? [],
      coverageCount: Math.max(1, pkg.countries.length),
    };
  }

  private buildCountries(products: ProductDto[]): CountryDto[] {
    const map = new Map<string, CountryDto>();
    for (const p of products) {
      const existing = map.get(p.destIso);
      if (existing) {
        existing.fromPriceKes = Math.min(existing.fromPriceKes, p.priceKes);
        existing.productCount += 1;
      } else {
        const rank = this.popularOrder.indexOf(p.destIso);
        map.set(p.destIso, {
          iso: p.destIso,
          name: p.destName,
          region: p.region,
          flagEmoji: isoToFlag(p.destIso),
          seoSlug: slugify(p.destName),
          scope: p.scope,
          popularRank: rank >= 0 ? rank : null,
          fromPriceKes: p.priceKes,
          productCount: 1,
        });
      }
    }
    return [...map.values()];
  }
}

function sortByPopularity(a: CountryDto, b: CountryDto): number {
  const ar = a.popularRank ?? 999;
  const br = b.popularRank ?? 999;
  if (ar !== br) return ar - br;
  return a.name.localeCompare(b.name);
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function isoToFlag(iso: string): string {
  if (iso === 'GX') return '🌍';
  if (iso.length !== 2 || !/^[A-Z]{2}$/.test(iso)) return '🏳️';
  const A = 0x1f1e6;
  return String.fromCodePoint(
    A + (iso.charCodeAt(0) - 65),
    A + (iso.charCodeAt(1) - 65),
  );
}
