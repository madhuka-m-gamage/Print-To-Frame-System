// A Deal is the same lead continuing, linked by originalLeadId / convertedDealId. Invoices
// (keyed by leadId) may carry either id, so every lookup matches against the whole lineage.
export const getLineageIds = (record) =>
  [record?.id, record?.originalLeadId, record?.convertedDealId].filter(Boolean);

export const invoicesForLineage = (record, invoices = []) => {
  const ids = new Set(getLineageIds(record));
  return invoices.filter((inv) => inv.leadId && ids.has(inv.leadId));
};

export const logisticsJobForLineage = (record, jobs = []) => {
  const ids = new Set(getLineageIds(record));
  return (jobs || []).find((job) => job.leadId && ids.has(job.leadId)) || null;
};

export const lineageIdsForLeadId = (leadId, leads = []) => {
  const related = leads.filter((l) => getLineageIds(l).includes(leadId));
  const record = related.find((l) => l.isDeal) || related[0];
  return record ? getLineageIds(record) : [leadId];
};

export const invoiceLineageFields = (record) =>
  record?.isDeal
    ? { leadId: record.originalLeadId || record.id, dealId: record.id }
    : { leadId: record?.id || record?._firestoreId, dealId: record?.convertedDealId || '' };

const findById = (leads, id) => (id ? leads.find((l) => l.id === id || l._firestoreId === id) : null);

export const leadForInvoice = (invoice, leads = []) =>
  findById(leads, invoice?.dealId) || findById(leads, invoice?.leadId) || null;
