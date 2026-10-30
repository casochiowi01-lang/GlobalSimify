export interface CountryDto {
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

export interface ProductDto {
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
  minDays: number;
  supplierDestination: string;
  priceKes: number;
  speed: string[];
  coverageCount: number;
}

export interface SearchResultDto {
  type: 'country';
  iso: string;
  name: string;
  region: string;
  flagEmoji: string;
  seoSlug: string;
  fromPriceKes: number;
}
