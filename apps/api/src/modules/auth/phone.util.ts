import {
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js';

/**
 * Normalises a phone number to E.164 (e.g. +254712345678, +256772123456,
 * +14155552671) for ANY country, using Google's libphonenumber rules.
 *
 * - International inputs (with `+`) are parsed by their own country code.
 * - Bare local inputs (e.g. "0712345678") are interpreted using `defaultCountry`.
 * Returns null if the number isn't valid.
 */
export function normalizePhone(
  input: string,
  defaultCountry: CountryCode = 'KE',
): string | null {
  if (!input) return null;
  const parsed = parsePhoneNumberFromString(input.trim(), defaultCountry);
  return parsed && parsed.isValid() ? parsed.number : null;
}

/** Backwards-compatible Kenya helper (phone-OTP is on hold but retained). */
export function normalizeKenyanPhone(input: string): string | null {
  return normalizePhone(input, 'KE');
}
