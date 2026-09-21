import { describe, it, expect } from 'vitest';
import { getQuotePricingTerms, DEFAULT_REFERRAL_COMMISSION_RATE } from '@/utils/quotePricing';

describe('getQuotePricingTerms', () => {
  it('gives a direct lead no discount and no commission', () => {
    expect(getQuotePricingTerms({ source: 'Walk-in' })).toEqual({ discountPct: 0, commissionRate: 0, commissionDefaulted: false });
    expect(getQuotePricingTerms(undefined)).toEqual({ discountPct: 0, commissionRate: 0, commissionDefaulted: false });
  });

  it('gives a referral lead 15% and the partner rate on file', () => {
    expect(getQuotePricingTerms({ partnerId: 'P-1', commissionRate: 60 })).toEqual({ discountPct: 15, commissionRate: 60, commissionDefaulted: false });
    expect(getQuotePricingTerms({ source: 'Referral', commissionRate: '45' }).commissionRate).toBe(45);
  });

  it('falls back to LKR 30 per sq ft and flags it when the partner has no usable rate', () => {
    expect(DEFAULT_REFERRAL_COMMISSION_RATE).toBe(30);
    for (const commissionRate of [undefined, 0, -5, 'abc']) {
      expect(getQuotePricingTerms({ partnerId: 'P-1', commissionRate })).toEqual({ discountPct: 15, commissionRate: 30, commissionDefaulted: true });
    }
  });

  it('ignores any discount value carried on the lead: only staff with full control set that', () => {
    expect(getQuotePricingTerms({ source: 'Walk-in', discountPct: 40 }).discountPct).toBe(0);
    expect(getQuotePricingTerms({ partnerId: 'P-1', commissionRate: 50, discountPct: 40 }).discountPct).toBe(15);
  });
});
