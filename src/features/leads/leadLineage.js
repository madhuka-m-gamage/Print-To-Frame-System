// A Deal is the same lead continuing, linked by originalLeadId / convertedDealId. Invoices
// (keyed by leadId) may carry either id, so every lookup matches against the whole lineage.
export const getLineageIds = (record) =>
  [record?.id, record?.originalLeadId, record?.convertedDealId].filter(Boolean);

export const invoicesForLineage = (record, invoices = []) => {
  const ids = new Set(getLineageIds(record));
  return invoices.filter((inv) => inv.leadId && ids.has(inv.leadId));
};
