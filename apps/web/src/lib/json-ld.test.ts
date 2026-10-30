import { describe, expect, it } from 'vitest';
import { serializeJsonLd } from './json-ld';

describe('serializeJsonLd', () => {
  it('cannot close the surrounding script element', () => {
    const out = serializeJsonLd({ name: '</script><script>alert(1)</script>' });
    expect(out).not.toMatch(/<\/?script/i);
    expect(out).not.toContain('<');
    expect(out).not.toContain('>');
  });

  it('still parses back to the original data', () => {
    const data = {
      name: 'Bosnia & Herzegovina <eSIM>',
      note: 'line separator',
      price: 9.5,
    };
    expect(JSON.parse(serializeJsonLd(data))).toEqual(data);
  });
});
