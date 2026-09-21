import { toDateObj } from '@/shared/utils/dateUtils';

const docKey = (inv) => inv._firestoreId || inv.id;

// A single invoice that bills the whole contract (no Advance/Final split).
export function isFullSettlementInvoice(inv) {
  if (!inv) return false;
  const total = Number(inv.totalValue) || 0;
  return inv.type === 'Full' || (total > 0 && (Number(inv.amount) || 0) >= total);
}

/**
 * Whether paying `paidDocId` leaves the deal fully settled. That needs either
 * the latest Advance and the latest Final both paid, or one paid full-settlement
 * invoice. Uses the most recently created invoice of each kind, since nothing
 * enforces uniqueness and a stale one must not mask the current one.
 * @param {Object[]} siblingInvoices invoices belonging to the lead/deal, including the one being paid
 * @param {string} paidDocId document key of the invoice that was just paid
 */
export function isFullyPaid(siblingInvoices, paidDocId) {
  const latestByCreatedAt = (candidates) => candidates.reduce((latest, inv) => {
    if (!latest) return inv;
    const latestTime = toDateObj(latest.createdAt)?.getTime() ?? -Infinity;
    const invTime = toDateObj(inv.createdAt)?.getTime() ?? -Infinity;
    return invTime > latestTime ? inv : latest;
  }, null);
  const paidNow = (inv) => (!inv ? false : (docKey(inv) === paidDocId ? true : inv.status === 'Paid'));

  if ((siblingInvoices || []).some(inv => isFullSettlementInvoice(inv) && paidNow(inv))) return true;

  const advance = latestByCreatedAt((siblingInvoices || []).filter(inv => inv.type !== 'Final'));
  const final = latestByCreatedAt((siblingInvoices || []).filter(inv => inv.type === 'Final'));
  return Boolean(advance) && Boolean(final) && paidNow(advance) && paidNow(final);
}
