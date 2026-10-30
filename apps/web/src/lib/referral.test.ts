import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  REFERRAL_COOKIE,
  readReferralCode,
  writeReferralCode,
} from './referral';

/** A minimal cookie jar with browser-like assignment semantics. */
function stubCookies(initial = '') {
  const jar = new Map<string, string>();
  for (const pair of initial.split('; ').filter(Boolean)) {
    const [name, ...rest] = pair.split('=');
    jar.set(name, rest.join('='));
  }
  vi.stubGlobal('document', {
    get cookie() {
      return [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
    },
    set cookie(value: string) {
      const [pair] = value.split(';');
      const [name, ...rest] = pair.split('=');
      jar.set(name.trim(), rest.join('='));
    },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('referral cookie', () => {
  it('round-trips a partner code, including characters that need encoding', () => {
    stubCookies('theme=dark');
    writeReferralCode('safari & co');
    expect(readReferralCode()).toBe('safari & co');
  });

  it('ignores other cookies whose names share a prefix', () => {
    stubCookies(`${REFERRAL_COOKIE}_old=stale; other=1`);
    expect(readReferralCode()).toBeUndefined();
  });

  it('returns undefined during server rendering', () => {
    expect(readReferralCode()).toBeUndefined();
  });
});
