import { describe, it, expect } from 'vitest';
import { getLeadPartnerId, findPartnerForLead, partnerFieldsFor, pricingLeadView } from '@/features/partners/partnerLink';
import { getQuotePricingTerms } from '@/features/quotations/quotePricing';

const p1 = { partnerId: 'P-1', id: 'doc1', name: 'Lanka Art Studio', commissionRate: 42 };
const noRate = { partnerId: 'P-2', name: 'No Rate Studio' };

describe('getLeadPartnerId', () => {
  it('reads partnerId, then agentId, and treats "Direct" and blanks as no partner', () => {
    expect(getLeadPartnerId({ partnerId: 'P-1', agentId: 'P-9' })).toBe('P-1');
    expect(getLeadPartnerId({ agentId: 'P-1' })).toBe('P-1');
    expect(getLeadPartnerId({ agentId: 'Direct' })).toBe('');
    expect(getLeadPartnerId({})).toBe('');
    expect(getLeadPartnerId(undefined)).toBe('');
  });
});

describe('findPartnerForLead', () => {
  it('finds the partner by either link field and either partner key', () => {
    expect(findPartnerForLead({ agentId: 'P-1' }, [p1])).toBe(p1);
    expect(findPartnerForLead({ partnerId: 'doc1' }, [p1])).toBe(p1);
    expect(findPartnerForLead({ partnerId: 'P-404' }, [p1])).toBeNull();
    expect(findPartnerForLead({ agentId: 'Direct' }, [p1])).toBeNull();
  });
});

describe('partnerFieldsFor', () => {
  it('fills every partner field, including the partner rate', () => {
    expect(partnerFieldsFor(p1)).toEqual({ agentId: 'P-1', partnerId: 'P-1', partnerName: 'Lanka Art Studio', agentName: 'Lanka Art Studio', commissionRate: 42 });
  });

  it('gives a rate of 0 when the partner has none, so quoting can flag and default it', () => {
    expect(partnerFieldsFor(noRate).commissionRate).toBe(0);
  });

  it('clears every field when there is no partner', () => {
    expect(partnerFieldsFor(null)).toEqual({ agentId: '', partnerId: '', partnerName: '', agentName: '', commissionRate: 0 });
  });
});

describe('pricingLeadView with getQuotePricingTerms', () => {
  const referral = { source: 'Referral', agentId: 'P-1', commissionRate: 53.5 };

  it('quotes with the partner current rate, not the rate saved on the lead', () => {
    const terms = getQuotePricingTerms(pricingLeadView(referral, { source: 'Referral', agentId: 'P-1' }, [p1]));
    expect(terms).toMatchObject({ discountPct: 15, commissionRate: 42, commissionDefaulted: false });
  });

  it('defaults and flags the rate when the linked partner has none', () => {
    const terms = getQuotePricingTerms(pricingLeadView({ source: 'Referral', agentId: 'P-2' }, { source: 'Referral', agentId: 'P-2' }, [noRate]));
    expect(terms).toMatchObject({ commissionRate: 30, commissionDefaulted: true });
  });

  it('picks up an agent chosen on the card before the lead is saved', () => {
    const terms = getQuotePricingTerms(pricingLeadView({ source: 'Referral' }, { source: 'Referral', agentId: 'P-1' }, [p1]));
    expect(terms.commissionRate).toBe(42);
  });

  it('gives a direct lead neither discount nor commission, even with a stale partner on it', () => {
    const terms = getQuotePricingTerms(pricingLeadView({ source: 'Referral', agentId: 'P-1' }, { source: 'Manual', agentId: '', partnerId: '' }, [p1]));
    expect(terms).toEqual({ discountPct: 0, commissionRate: 0, commissionDefaulted: false });
  });
});
