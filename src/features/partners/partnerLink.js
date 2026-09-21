// A lead or deal is linked to a partner by `partnerId` (the public referral form writes it) or by
// `agentId` (the lead card's agent dropdown wrote only that). 'Direct' is the referral form's
// placeholder for "no partner". Every place that needs the partner resolves it through here.
const NO_PARTNER = new Set(['', 'Direct']);

export function getLeadPartnerId(record) {
  const id = record?.partnerId || record?.agentId || '';
  return NO_PARTNER.has(id) ? '' : id;
}

export function findPartnerForLead(record, partners = []) {
  const id = getLeadPartnerId(record);
  if (!id) return null;
  return partners.find((p) => p.partnerId === id || p.id === id) || null;
}

// The fields a lead carries once a partner is chosen (or none). The rate is the partner's
// current rate, 0 when the partner has none, so quoting can flag and default it.
export function partnerFieldsFor(partner) {
  if (!partner) return { agentId: '', partnerId: '', partnerName: '', agentName: '', commissionRate: 0 };
  const id = partner.partnerId || partner.id;
  const rate = Number(partner.commissionRate);
  return {
    agentId: id,
    partnerId: id,
    partnerName: partner.name || '',
    agentName: partner.name || '',
    commissionRate: rate > 0 ? rate : 0,
  };
}

// The lead as pricing should see it: the partner chosen on the card (even before saving) and that
// partner's current rate, falling back to a rate saved on the lead only when no partner is found.
export function pricingLeadView(lead, formData, partners = []) {
  const partnerId = getLeadPartnerId({ partnerId: formData.partnerId ?? lead.partnerId, agentId: formData.agentId });
  const partner = findPartnerForLead({ partnerId }, partners);
  return {
    ...lead,
    source: formData.source,
    partnerId,
    commissionRate: partner ? Number(partner.commissionRate) || 0 : (formData.commissionRate ?? lead.commissionRate),
  };
}

