import { ftToMm } from './cutListEngine';

export const NON_BILLABLE = 'NON_BILLABLE';

// The size a lead was measured at (feet, saved with its pricing) is the single source: it flows to
// the deal and to the fabrication job and is not re-entered downstream.
export function dimensionsFromLead(record) {
  const length = Number(record?.pricingMetadata?.dimensions?.length);
  const height = Number(record?.pricingMetadata?.dimensions?.height);
  if (!(length > 0) || !(height > 0)) return null;
  return {
    frameWidth: Math.round(ftToMm(length)),
    frameHeight: Math.round(ftToMm(height)),
    totalSqFt: Math.round(length * height * 10) / 10,
  };
}

// A manually created fabrication job is either extra work on an existing deal (billed through that
// deal, no price entered here) or explicitly non-billable internal work. Nothing else is allowed.
export function resolveManualJobLink(link, deals = []) {
  if (link === NON_BILLABLE) return { ok: true, billable: false, fields: { billable: false, origin: 'manual' } };
  const deal = deals.find((d) => d.id === link);
  if (!deal) return { ok: false, error: 'Link the job to a deal, or mark it non-billable.' };
  const dims = dimensionsFromLead(deal);
  return {
    ok: true,
    billable: true,
    deal,
    dims,
    fields: {
      billable: true,
      origin: 'manual',
      dealId: deal.id,
      leadId: deal.originalLeadId || deal.id,
      customerName: deal.name || '',
      customerPhone: deal.phone || '',
      company: deal.company || '',
      customerId: String(deal.email || '').trim().toLowerCase(),
      ...(dims ? { ...dims, dimensionsLocked: true } : {}),
    },
  };
}
