import { describe, it, expect } from 'vitest';
import { normalizeString, levenshteinDistance, stringSimilarity, findCustomerDuplicates } from '@/utils/stringMatch';

describe('normalizeString', () => {
  it('lowercases, drops punctuation and collapses whitespace', () => {
    expect(normalizeString('  Print-To-Frame,  Pvt. Ltd! ')).toBe('printtoframe pvt ltd');
  });

  it('returns an empty string for falsy input', () => {
    expect(normalizeString(null)).toBe('');
    expect(normalizeString('')).toBe('');
  });
});

describe('levenshteinDistance', () => {
  it('is zero for equal strings after normalisation and the length for an empty side', () => {
    expect(levenshteinDistance('Kasun', 'kasun!')).toBe(0);
    expect(levenshteinDistance('', 'abc')).toBe(3);
    expect(levenshteinDistance('abc', '')).toBe(3);
  });

  it('counts single edits', () => {
    expect(levenshteinDistance('kitten', 'sitten')).toBe(1);
    expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
  });
});

describe('stringSimilarity', () => {
  it('scores identical, both-empty and one-empty inputs', () => {
    expect(stringSimilarity('Nimal', 'nimal')).toBe(1);
    expect(stringSimilarity('', '')).toBe(1);
    expect(stringSimilarity('Nimal', '')).toBe(0);
  });

  it('boosts a substring match to at least 0.75', () => {
    expect(stringSimilarity('Apex', 'Apex Designs Lanka')).toBeGreaterThanOrEqual(0.75);
  });

  it('falls back to edit distance for near misses and gives low scores to different names', () => {
    expect(stringSimilarity('Perera', 'Pereira')).toBeGreaterThan(0.8);
    expect(stringSimilarity('Perera', 'Zzzzzz')).toBeLessThan(0.3);
  });
});

describe('findCustomerDuplicates', () => {
  const customers = [
    { id: 1, name: 'Nimal Perera', phone: '+94 71 234 5678', email: 'nimal@example.com', company: 'Apex Designs' },
    { id: 2, name: 'Sunil Silva', phone: '077 999 8888', email: 'sunil@example.com' },
  ];

  it('returns nothing for an empty list or no candidate', () => {
    expect(findCustomerDuplicates(null, customers)).toEqual([]);
    expect(findCustomerDuplicates({ name: 'x' }, [])).toEqual([]);
  });

  it('matches a phone across spellings using the last nine digits', () => {
    const res = findCustomerDuplicates({ name: 'Someone Else', phone: '0712345678' }, customers);
    expect(res[0].customer.id).toBe(1);
    expect(res[0].score).toBe(1);
    expect(res[0].reasons).toContain('Exact phone match');
  });

  it('matches an email exactly at 0.95 and a close name below the phone score', () => {
    const byEmail = findCustomerDuplicates({ name: 'Zed', email: 'NIMAL@example.com' }, customers);
    expect(byEmail[0].score).toBe(0.95);
    const byName = findCustomerDuplicates({ name: 'Nimal Pereira' }, customers);
    expect(byName[0].customer.id).toBe(1);
    expect(byName[0].reasons.some(r => r.startsWith('Name similarity'))).toBe(true);
  });

  it('matches a company by business name or company and sorts the best match first', () => {
    const res = findCustomerDuplicates({ name: 'Nimal Perera', phone: '0712345678', company: 'Apex Designs' }, customers);
    expect(res.map(r => r.customer.id)).toEqual([1]);
    const scores = findCustomerDuplicates({ name: 'Sunil Silva', phone: '0779998888' }, customers).map(r => r.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it('honours the threshold', () => {
    expect(findCustomerDuplicates({ name: 'Nimal Perer' }, customers, 0.99)).toEqual([]);
  });
});
