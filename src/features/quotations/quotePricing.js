// Used when a referral lead's partner has no commission rate on file, so quoting is never
// blocked. Admins and Managers are told to check and update the partner's real rate.
export const DEFAULT_REFERRAL_COMMISSION_RATE = 30;

export function getQuotePricingTerms(lead) {
  if (!lead?.partnerId && lead?.source !== 'Referral') return { discountPct: 0, commissionRate: 0, commissionDefaulted: false };
  const rate = Number(lead.commissionRate) || 0;
  const commissionDefaulted = !(rate > 0);
  return { discountPct: 15, commissionRate: commissionDefaulted ? DEFAULT_REFERRAL_COMMISSION_RATE : rate, commissionDefaulted };
}
