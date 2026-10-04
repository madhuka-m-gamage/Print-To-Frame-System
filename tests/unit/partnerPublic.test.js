import { describe, it, expect, vi } from 'vitest';

vi.mock('@/services/firebase', () => ({ db: {}, handleFirestoreError: vi.fn(), OperationType: {} }));

const { partnerPublicOps } = await import('@/features/partners/partnerPublic');

describe('partnerPublicOps (SEC-6)', () => {
  const partner = {
    name: 'Lanka Art Studio', status: 'Inactive', photoURL: 'data:image/png;base64,x', email: 'p@example.com',
    commissionRate: 38, bankName: 'B', accountNumber: '1', accountName: 'A', branchName: 'Br', pending: 10, settled: 5,
  };

  it('sets only name, status and logo on partner_public/<partners doc id>, for staff and the owning Partner alike (SEC-16)', () => {
    expect(partnerPublicOps('P-1', partner)).toEqual([
      { type: 'set', collection: 'partner_public', docId: 'P-1', data: { name: 'Lanka Art Studio', status: 'Inactive', logo: 'data:image/png;base64,x' } },
    ]);
  });

  it('defaults status to Active and logo to empty, never a fallback avatar', () => {
    expect(partnerPublicOps('P-2', { name: 'X' })[0].data).toEqual({ name: 'X', status: 'Active', logo: '' });
  });

  it('deletes the mirror when given no partner', () => {
    expect(partnerPublicOps('P-1', null)).toEqual([{ type: 'delete', collection: 'partner_public', docId: 'P-1' }]);
  });
});
