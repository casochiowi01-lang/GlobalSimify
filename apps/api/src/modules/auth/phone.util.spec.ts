import { normalizePhone, normalizeKenyanPhone } from './phone.util.js';

describe('normalizePhone (multi-country)', () => {
  it('normalises Kenyan local numbers (default country)', () => {
    expect(normalizePhone('0712345678')).toBe('+254712345678');
    expect(normalizePhone('0712 345 678')).toBe('+254712345678');
    expect(normalizePhone('+254712345678')).toBe('+254712345678');
  });

  it('parses international numbers by their own country code', () => {
    expect(normalizePhone('+256772123456')).toBe('+256772123456'); // Uganda
    expect(normalizePhone('+14155552671')).toBe('+14155552671'); // USA
  });

  it('uses the provided default country for bare local numbers', () => {
    expect(normalizePhone('0772123456', 'UG')).toBe('+256772123456');
  });

  it('rejects invalid numbers', () => {
    expect(normalizePhone('123')).toBeNull();
    expect(normalizePhone('')).toBeNull();
  });

  it('Kenya helper still works', () => {
    expect(normalizeKenyanPhone('0712345678')).toBe('+254712345678');
  });
});
