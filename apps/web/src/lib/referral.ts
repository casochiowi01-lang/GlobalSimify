/** Cookie set by `/r/<code>` links so a later purchase credits the partner. */
export const REFERRAL_COOKIE = 'etx_ref';
export const REFERRAL_COOKIE_MAX_AGE_S = 30 * 24 * 60 * 60;

/** Remember a partner code for 30 days so checkout can attribute the sale. */
export function writeReferralCode(code: string): void {
  document.cookie = `${REFERRAL_COOKIE}=${encodeURIComponent(code)}; path=/; max-age=${REFERRAL_COOKIE_MAX_AGE_S}; samesite=lax`;
}

/** The partner code from the referral cookie, if present (browser only). */
export function readReferralCode(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const entry = document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${REFERRAL_COOKIE}=`));
  if (!entry) return undefined;
  return decodeURIComponent(entry.slice(REFERRAL_COOKIE.length + 1));
}
