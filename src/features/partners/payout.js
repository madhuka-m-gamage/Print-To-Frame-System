const roundCents = (n) => Math.round(n * 100) / 100;

const isPayable = (referral) =>
  referral.commState === 'Eligible for Payout'
  && !referral.convertedToDeal
  && referral.payoutStatus !== 'Paid'
  && referral.payoutStatus !== 'Settled';

// referrals are the rows getPartnerReferrals builds in Partners.jsx (commState,
// calculatedCommAmount already derived).
export function buildPayout(referrals, partner) {
  if (!partner || !Array.isArray(referrals)) return { leads: [], amount: 0, leadIds: [] };
  const leads = referrals.filter(isPayable);
  const amount = roundCents(leads.reduce((sum, l) => sum + (Number(l.calculatedCommAmount) || 0), 0));
  return { leads, amount, leadIds: leads.map(l => l.id) };
}
