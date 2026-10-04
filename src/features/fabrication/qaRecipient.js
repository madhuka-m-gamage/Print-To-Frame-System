import { phonesMatch } from '@/shared/utils/validation';

const lower = (v) => String(v ?? '').trim().toLowerCase();

// Lead conversion gives the customer and the job different AUTO- NICs, so NIC alone misses
// converted jobs; customerId (lower-cased email, else NIC) is the stable link.
export function resolveQaRecipient(job, customers) {
  const list = customers || [];
  const nic = job.clientNIC || job.customerNic;
  const customerId = lower(job.customerId);
  return (
    (nic && list.find(c => c.nic === nic)) ||
    (customerId && list.find(c => lower(c.email) === customerId || lower(c.nic) === customerId)) ||
    (job.leadId && list.find(c => c.leadId === job.leadId || c.originalLeadId === job.leadId)) ||
    (job.customerPhone && list.find(c => phonesMatch(c.phone, job.customerPhone))) ||
    null
  );
}
