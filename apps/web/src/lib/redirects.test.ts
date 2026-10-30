import { describe, expect, it } from 'vitest';
import { postLoginPath } from './redirects';

describe('postLoginPath', () => {
  it('honours a same-origin next path', () => {
    expect(postLoginPath('?next=/account/profile', 'CUSTOMER')).toBe(
      '/account/profile',
    );
    expect(postLoginPath('?next=%2Forder%2F123%3Fx%3D1', undefined)).toBe(
      '/order/123?x=1',
    );
  });

  it.each([
    ['protocol-relative', '?next=//evil.example'],
    ['backslash protocol-relative', '?next=/%5Cevil.example'],
    ['absolute URL', '?next=https://evil.example'],
    ['relative path', '?next=account'],
    ['javascript URL', '?next=javascript:alert(1)'],
  ])('rejects a %s next value', (_label, search) => {
    expect(postLoginPath(search, 'CUSTOMER')).toBe('/account/esims');
  });

  it('defaults admins to the admin panel and everyone else to their eSIMs', () => {
    expect(postLoginPath('', 'ADMIN')).toBe('/admin');
    expect(postLoginPath('', 'CUSTOMER')).toBe('/account/esims');
    expect(postLoginPath('', undefined)).toBe('/account/esims');
  });
});
