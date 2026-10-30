/**
 * Geography helpers for classifying Celitech destinations.
 *
 * Celitech returns a `destinationISO2` per package. Real countries use a valid
 * ISO-3166-1 alpha-2 code; multi-country bundles use a non-ISO code (e.g. a
 * region/global pseudo-code). We classify by that distinction so the catalogue
 * surfaces COUNTRY vs REGION vs GLOBAL correctly, and we group countries into a
 * continent/region for browsing ("regions available").
 */

import { PRICELIST } from './pricelist.data.js';

function mapOf(region: string, codes: string): Record<string, string> {
  return Object.fromEntries(
    codes
      .trim()
      .split(/\s+/)
      .map((c) => [c, region]),
  );
}

// ISO-3166-1 alpha-2 → broad region. Covers the commonly-travelled set; codes
// not listed fall back to 'Other' (still classified COUNTRY if a valid 2-letter
// ISO is detected via ISO_ALPHA2 below).
const COUNTRY_REGION: Record<string, string> = {
  ...mapOf(
    'Africa',
    'DZ AO BJ BW BF BI CM CV CF TD KM CG CD CI DJ EG GQ ER SZ ET GA GM GH GN GW KE LS LR LY MG MW ML MR MU MA MZ NA NE NG RW ST SN SC SL SO ZA SS SD TZ TG TN UG ZM ZW',
  ),
  ...mapOf(
    'Europe',
    'AL AD AT BY BE BA BG HR CY CZ DK EE FI FR DE GR HU IS IE IT LV LI LT LU MT MD MC ME NL MK NO PL PT RO RU SM RS SK SI ES SE CH UA GB VA XK GI',
  ),
  ...mapOf(
    'Asia',
    'AF AM AZ BD BT BN KH CN GE HK IN ID JP KZ KG LA MO MY MV MN MM NP KP PK PH SG KR LK TW TJ TH TL TM UZ VN',
  ),
  ...mapOf('Middle East', 'BH IR IQ IL JO KW LB OM PS QA SA SY TR AE YE'),
  ...mapOf('North America', 'CA US MX GT BZ SV HN NI CR PA'),
  ...mapOf('Caribbean', 'AG BS BB CU DM DO GD HT JM KN LC VC TT PR'),
  ...mapOf('South America', 'AR BO BR CL CO EC GY PY PE SR UY VE'),
  ...mapOf('Oceania', 'AU FJ KI MH FM NR NZ PW PG WS SB TO TV VU GU'),
};

export const ISO_ALPHA2 = new Set([
  ...Object.keys(COUNTRY_REGION),
  ...'AX AS AI AQ AW BL BM BQ BV CC CK CW CX EH FK FO GF GG GL GP GS HM IM IO JE KY MF MP MQ MS NC NF NU PF PM PN RE SH SJ SX TC TF TK UM VG VI WF YT'.split(
    ' ',
  ),
]);

export function regionForCountry(iso2: string): string {
  return (
    COUNTRY_REGION[iso2.toUpperCase()] ??
    PRICELIST.find(
      (e) => e.scope === 'COUNTRY' && e.iso2 === iso2.toUpperCase(),
    )?.region ??
    'Other'
  );
}

export type DestinationScope = 'COUNTRY' | 'REGION' | 'GLOBAL';

/**
 * Classify a Celitech destination by its code + display name:
 *  - name mentions global/worldwide → GLOBAL
 *  - code is a valid ISO-3166 alpha-2 country → COUNTRY (+ its region)
 *  - otherwise it's a multi-country bundle → REGION
 */
export function classifyDestination(
  code: string,
  name: string,
): { scope: DestinationScope; region: string | null } {
  const c = (code || '').toUpperCase();
  const n = (name || '').toLowerCase();
  const regional = PRICELIST.find(
    (e) =>
      e.scope !== 'COUNTRY' &&
      e.name.toLowerCase().replace(/[^a-z0-9]/g, '') ===
        n.replace(/[^a-z0-9]/g, ''),
  );
  if (regional) return { scope: regional.scope, region: regional.region };
  if (/\b(global|worldwide|world)\b/.test(n)) {
    return { scope: 'GLOBAL', region: 'Global' };
  }
  if (ISO_ALPHA2.has(c)) {
    return { scope: 'COUNTRY', region: regionForCountry(c) };
  }
  return { scope: 'REGION', region: name || 'Regional' };
}
