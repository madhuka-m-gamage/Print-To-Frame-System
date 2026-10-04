import { COLLECTIONS } from '@/services/firestoreSync';

// SEC-6: batchWrite ops for partner_public/<partners doc id>, the world-readable mirror the
// referral form reads. Only name, status and logo: never commission, contact or bank fields.
// Always a set, so the owning Partner can create a missing mirror; the rules hold its status
// to the partners record (SEC-16). A null partner deletes the mirror.
export function partnerPublicOps(partnerId, partner) {
  const target = { collection: COLLECTIONS.PARTNER_PUBLIC, docId: partnerId };
  if (!partner) return [{ type: 'delete', ...target }];
  return [{ type: 'set', ...target, data: { name: partner.name || '', status: partner.status || 'Active', logo: partner.photoURL || '' } }];
}
