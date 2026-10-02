import { describe, it, expect } from 'vitest';
import { splitInvoiceAmounts } from '@/features/quotations/splitInvoiceAmounts';

const cents = (n) => Math.round(n * 100);

describe('splitInvoiceAmounts', () => {
  it('rounds the Advance to cents and makes the Final the remainder', () => {
    expect(splitInvoiceAmounts(33333.33)).toEqual({ advance: 25000, final: 8333.33 });
  });

  it('splits a round total exactly', () => {
    expect(splitInvoiceAmounts(100000)).toEqual({ advance: 75000, final: 25000 });
  });

  it('handles zero and cent-sized totals', () => {
    expect(splitInvoiceAmounts(0)).toEqual({ advance: 0, final: 0 });
    expect(splitInvoiceAmounts(0.01)).toEqual({ advance: 0.01, final: 0 });
    expect(splitInvoiceAmounts(0.02)).toEqual({ advance: 0.02, final: 0 });
    expect(splitInvoiceAmounts(0.03)).toEqual({ advance: 0.02, final: 0.01 });
  });

  it('rounds half up', () => {
    expect(splitInvoiceAmounts(0.1).advance).toBe(0.08);
    expect(splitInvoiceAmounts(0.14).advance).toBe(0.11);
  });

  it('always adds up to the total in cents and stays finite and non-negative', () => {
    for (let c = 0; c <= 5000; c += 7) {
      const { advance, final } = splitInvoiceAmounts(c / 100);
      expect(Number.isFinite(advance) && Number.isFinite(final)).toBe(true);
      expect(advance).toBeGreaterThanOrEqual(0);
      expect(final).toBeGreaterThanOrEqual(0);
      expect(cents(advance) + cents(final)).toBe(c);
    }
  });

  it('treats invalid input as zero', () => {
    expect(splitInvoiceAmounts(undefined)).toEqual({ advance: 0, final: 0 });
    expect(splitInvoiceAmounts(NaN)).toEqual({ advance: 0, final: 0 });
  });
});
