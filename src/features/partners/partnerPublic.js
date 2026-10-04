import { COLLECTIONS } from '@/services/firestoreSync';

// SEC-6: batchWrite ops for partner_public/<partners doc id>, the world-readable mirror the
// referral form reads. Only name, status and logo: never commission, contact or bank fields.
// The owning Partner may change name and logo only (rules), so it updates without status;
// a null partner deletes the mirror.
export function partnerPublicOps(partnerId, partner, { asOwner = false } = {}) {
  const target = { collection: COLLECTIONS.PARTNER_PUBLIC, docId: partnerId };
  if (!partner) return [{ type: 'delete', ...target }];
  const ownerFields = { name: partner.name || '', logo: partner.photoURL || '' };
  return [asOwner
    ? { type: 'update', ...target, data: ownerFields }
    : { type: 'set', ...target, data: { name: ownerFields.name, status: partner.status || 'Active', logo: ownerFields.logo } }];
}
