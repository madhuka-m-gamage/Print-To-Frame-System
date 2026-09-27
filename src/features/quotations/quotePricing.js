// The one default partner commission (LKR per sq ft, owner decision DEC-1): used for new
// partners and whenever a partner has no rate on file, so quoting and payouts are never blocked.
export const DEFAULT_REFERRAL_COMMISSION_RATE = 38;

export function getQuotePricingTerms(lead) {
  if (!lead?.partnerId && lead?.source !== 'Referral') return { discountPct: 0, commissionRate: 0, commissionDefaulted: false };
  const rate = Number(lead.commissionRate) || 0;
  const commissionDefaulted = !(rate > 0);
  return { discountPct: 15, commissionRate: commissionDefaulted ? DEFAULT_REFERRAL_COMMISSION_RATE : rate, commissionDefaulted };
}

// Area recovered from a saved quote's commission amount, using the rate that quote was priced at.
export function sqFtFromPricing(pricing) {
  const amount = Number(pricing?.costSalesAmount) || 0;
  if (!(amount > 0)) return 0;
  return amount / (Number(pricing.commissionRate) || DEFAULT_REFERRAL_COMMISSION_RATE);
}
