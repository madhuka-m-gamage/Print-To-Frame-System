import { matchesEntity } from '@/shared/utils/entityUtils';
import { isAcceptedQuote } from './quotationStatus';

/**
 * Amounts for the Final invoice raised when a deal completes. An Accepted
 * quotation (highest version) is the source of truth for the contract value;
 * without one the deal's own value is used. The 25% figure is the stored
 * balanceDue when present, otherwise grandTotal * 0.25.
 * @returns {{ quote: Object|null, totalValue: number, finalAmount: number, advancePaid: number, quotedTotal: number }}
 */
export function getFinalInvoiceAmounts(deal, quotations) {
  const linked = (quotations || []).filter(q => matchesEntity(q, deal));
  const byVersionDesc = (a, b) => (Number(b.version) || 1) - (Number(a.version) || 1);
  const accepted = linked.filter(q => isAcceptedQuote(q.status)).sort(byVersionDesc)[0] || null;
  const quote = accepted || linked[0] || null;

  const quotedTotal = accepted ? Number(accepted.grandTotal) || 0 : 0;
  const totalValue = quotedTotal > 0 ? quotedTotal : Number(deal.value) || 0;
  const storedBalance = accepted ? Number(accepted.balanceDue) || 0 : 0;
  const finalAmount = storedBalance > 0 ? storedBalance : totalValue * 0.25;

  return { quote, totalValue, finalAmount, advancePaid: totalValue * 0.75, quotedTotal };
}

/**
 * Partner commission for a completed deal. Area-based when the deal has real
 * square footage, otherwise estimated from value at 850 per sq ft (the same
 * fallback the Partners ledger uses). Only real square footage is added to the
 * partner's running total.
 * @returns {{ commissionAmount: number, sqFtToAdd: number }}
 */
export function calculateDealCommission(deal, agent) {
  const sqFt = Number(deal.totalSqFt) || 0;
  const effectiveSqFt = sqFt > 0 ? sqFt : 0;
  // Always the partner's current live rate, never a snapshot on the deal.
  const commRate = Number(agent?.commissionRate) > 0 ? Number(agent.commissionRate) : 53.5;
  const commissionAmount = effectiveSqFt > 0
    ? effectiveSqFt * commRate
    : (Number(deal.value) / 850) * commRate || 0;
  return { commissionAmount, sqFtToAdd: effectiveSqFt };
}
