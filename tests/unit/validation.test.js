import { describe, it, expect } from 'vitest';
import { validatePhone, formatPhone, normalizePhone, phonesMatch, validateEmail, stripEmojis, sanitizeTechnicalScope } from '@/utils/validation';

describe('validatePhone', () => {
  it('accepts +947 followed by eight digits, with or without spaces', () => {
    expect(validatePhone('+94712345678')).toBe(true);
    expect(validatePhone('+94 71 234 5678')).toBe(true);
  });

  it('rejects local 07 numbers, landlines and wrong lengths', () => {
    expect(validatePhone('0712345678')).toBe(false);
    expect(validatePhone('+94112345678')).toBe(false);
    expect(validatePhone('+9471234567')).toBe(false);
    expect(validatePhone('')).toBe(false);
  });
});

describe('formatPhone', () => {
  it('converts a leading 07 to +947 and groups the digits', () => {
    expect(formatPhone('0712345678')).toBe('+9471 2345 678');
  });

  it('strips everything except digits and a plus sign', () => {
    expect(formatPhone('+94 (71) 234-5678')).toBe('+9471 2345 678');
  });

  it('leaves short input ungrouped and never throws on empty input', () => {
    expect(formatPhone('')).toBe('');
    expect(formatPhone('+94')).toBe('+94');
    // Quirk recorded as-is: five characters already trigger grouping, leaving a trailing space.
    expect(formatPhone('+9471')).toBe('+9471 ');
  });

  it('formats +94 and 07 spellings the same for display', () => {
    expect(formatPhone('+94712345678')).toBe(formatPhone('0712345678'));
  });
});

describe('normalizePhone and phonesMatch', () => {
  it('reduces every common Sri Lankan spelling to the same digits', () => {
    const canonical = '94712345678';
    for (const v of ['+94 71 234 5678', '+9471 2345 678', '0712345678', '071-234-5678', '94712345678', '712345678', '(+94) 71 234 5678']) {
      expect(normalizePhone(v)).toBe(canonical);
    }
  });

  it('returns an empty string for missing input', () => {
    expect(normalizePhone('')).toBe('');
    expect(normalizePhone(undefined)).toBe('');
    expect(normalizePhone(null)).toBe('');
  });

  it('matches spaced and unspaced spellings, and never matches on empty values', () => {
    expect(phonesMatch('+94 71 234 5678', '+94712345678')).toBe(true);
    expect(phonesMatch('0712345678', '+94712345678')).toBe(true);
    expect(phonesMatch('0712345678', '0712345679')).toBe(false);
    expect(phonesMatch('', '')).toBe(false);
    expect(phonesMatch(undefined, '')).toBe(false);
  });
});

describe('validateEmail', () => {
  it('treats an empty value as valid because the field is optional', () => {
    expect(validateEmail('')).toBe(true);
    expect(validateEmail(undefined)).toBe(true);
  });

  it('accepts ordinary addresses and rejects malformed ones', () => {
    expect(validateEmail('a@b.co')).toBe(true);
    expect(validateEmail('no-at-sign')).toBe(false);
    expect(validateEmail('a@b')).toBe(false);
    expect(validateEmail('a b@c.co')).toBe(false);
  });
});

describe('stripEmojis and sanitizeTechnicalScope', () => {
  it('removes emojis and collapses the spaces they leave behind', () => {
    expect(stripEmojis('Frame 🖼 ready ✅ today')).toBe('Frame ready today');
  });

  it('normalises bullet markers to a dash', () => {
    expect(stripEmojis('• one\n* two\n- three')).toBe('- one\n- two\n- three');
  });

  it('returns an empty string for non-strings and empty input', () => {
    expect(stripEmojis(null)).toBe('');
    expect(stripEmojis(42)).toBe('');
    expect(sanitizeTechnicalScope('')).toBe('');
    expect(sanitizeTechnicalScope(undefined)).toBe('');
  });

  it('sanitizeTechnicalScope applies the same clean-up', () => {
    expect(sanitizeTechnicalScope('Box iron 🔧 1.5"')).toBe('Box iron 1.5"');
  });
});
