import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../helpers/renderWithProviders';
import { makePartner } from '../helpers/factories';

vi.mock('@/services/firestoreSync', () => ({
  COLLECTIONS: { PARTNERS: 'partners', LEADS: 'leads', REFERRAL_CLAIMS: 'referral_claims', USERS: 'users', PARTNER_APPLICATIONS: 'partner_applications' },
  subscribeToCollection: vi.fn(() => () => {}),
  subscribeToQuery: vi.fn(() => () => {}),
  addDocument: vi.fn(async () => {}),
  updateDocument: vi.fn(async () => {}),
  deleteDocument: vi.fn(async () => {}),
  setDocument: vi.fn(async () => {}),
  batchWrite: vi.fn(async () => {}),
}));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => ({})),
  getDoc: vi.fn(async () => ({ exists: () => false })),
  setDoc: vi.fn(async () => {}),
  onSnapshot: vi.fn((_ref, onNext) => {
    onNext({ exists: () => true, data: () => globalThis.__TEST_PERMISSIONS__ });
    return () => {};
  }),
  collection: vi.fn((_db, name) => ({ name })),
  query: vi.fn((ref, ...constraints) => ({ ref, constraints })),
  where: vi.fn((field, op, value) => ({ field, op, value })),
}));
vi.mock('@/shared/utils/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
  showToast: vi.fn(),
}));
vi.mock('@/services/auditLog', () => ({ logActivity: vi.fn(async () => {}) }));
vi.mock('@/services/mailer', () => ({ sendTemplatedEmail: vi.fn(async () => {}) }));
vi.mock('@/features/admin/adminUsers', () => ({
  deleteUserAccount: vi.fn(async () => {}),
  resetUserPassword: vi.fn(async () => {}),
}));
vi.mock('firebase/storage', () => ({ ref: vi.fn(), uploadBytes: vi.fn(), getDownloadURL: vi.fn() }));
vi.mock('@/features/partners/PartnerQRModal', () => ({ default: () => null }));

const { default: Partners } = await import('@/features/partners/Partners');
const sync = await import('@/services/firestoreSync');
const { toast } = await import('@/shared/utils/toast');

const admin = { role: 'Admin', name: 'Admin', identifier: 'admin@example.com' };

beforeEach(() => vi.clearAllMocks());

describe('Partners monthly settlements', () => {
  // Characterisation: docs/02_modules/partners/FINDINGS.md D-1 (phantom payout).
  // "Disburse Payout" only raises a success toast: nothing is written, no
  // payout record is created and the partner's pending balance is untouched.
  // Flips in Phase 7 4.1, which writes a partner_payouts document and settles
  // the leads in one batch.
  it('shows a success toast on Disburse Payout but writes nothing', () => {
    const partner = makePartner({ partnerId: 'P-1', name: 'Lanka Art Studio', pending: 5000 });
    renderWithProviders(
      <Partners partners={[partner]} setPartners={vi.fn()} leads={[]} setLeads={vi.fn()} invoices={[]} projects={[]} users={[]} setUsers={vi.fn()} currentUser={admin} />,
      { role: 'Admin' }
    );
    fireEvent.click(screen.getByRole('button', { name: /Monthly Settlements/i }));
    fireEvent.click(screen.getByRole('button', { name: /Disburse Payout/i }));

    expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/settlement processed for Lanka Art Studio \(Ref: TXN-\d{6}\)/));
    for (const fn of [sync.addDocument, sync.updateDocument, sync.setDocument, sync.deleteDocument, sync.batchWrite]) {
      expect(fn).not.toHaveBeenCalled();
    }
  });
});

describe('Partners referral eligibility', () => {
  it('does not list a converted lead stub, so its Completed stage cannot mark a commission as payable', () => {
    const partner = makePartner({ partnerId: 'P-1', name: 'Lanka Art Studio' });
    const stub = { id: 'L-1', name: 'Stub Client', partnerId: 'P-1', source: 'Referral', stage: 'Completed', convertedToDeal: true, isDeal: false };
    const deal = { id: 'D-1', name: 'Deal Client', partnerId: 'P-1', source: 'Referral', stage: 'Waiting', convertedToDeal: false, isDeal: true, originalLeadId: 'L-1' };
    renderWithProviders(
      <Partners partners={[partner]} setPartners={vi.fn()} leads={[stub, deal]} setLeads={vi.fn()} invoices={[]} projects={[]} users={[]} setUsers={vi.fn()} currentUser={admin} />,
      { role: 'Admin' }
    );
    expect(screen.getAllByText(/Deal Client/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Stub Client/)).toBeNull();
  });

  const renderDeal = (deal, invoices) => renderWithProviders(
    <Partners partners={[makePartner({ partnerId: 'P-1', name: 'Lanka Art Studio', commissionRate: 30 })]} setPartners={vi.fn()} leads={[deal]} setLeads={vi.fn()} invoices={invoices} projects={[]} users={[]} setUsers={vi.fn()} currentUser={admin} />,
    { role: 'Admin' }
  );
  const deal = { id: 'D-1', name: 'Deal Client', partnerId: 'P-1', source: 'Referral', stage: 'Completed', isDeal: true, originalLeadId: 'L-1', value: 1000, totalSqFt: 10 };

  it('a Completed deal is not payable until its invoices, keyed by the original lead id, are paid', () => {
    renderDeal(deal, [{ id: 'INV-ADV-1', leadId: 'L-1', amount: 750, status: 'Paid' }, { id: 'INV-FIN-1', leadId: 'D-1', amount: 250, status: 'Unpaid' }]);
    expect(screen.queryByText(/Eligible for Payout/)).toBeNull();
  });

  it('a Completed deal becomes payable once both invoices, under either id, are paid', () => {
    renderDeal(deal, [{ id: 'INV-ADV-1', leadId: 'L-1', amount: 750, status: 'Paid' }, { id: 'INV-FIN-1', leadId: 'D-1', amount: 250, status: 'Paid' }]);
    expect(screen.getAllByText(/Eligible for Payout/).length).toBeGreaterThan(0);
  });
});

// SEC-7: the rules let a Partner read only its own claims and edit only its profile fields.
describe('Partners for a signed-in Partner', () => {
  const partnerUser = { role: 'Partner', name: 'Lanka Art Studio', identifier: 'partner@example.com', partnerId: 'P-1' };
  const renderAsPartner = (partner) => renderWithProviders(
    <Partners partners={[partner]} setPartners={vi.fn()} leads={[]} setLeads={vi.fn()} invoices={[]} projects={[]} users={[]} setUsers={vi.fn()} currentUser={partnerUser} />,
    { role: 'Partner' }
  );

  it('reads referral claims with a query on its own partnerEmail, not the whole collection', () => {
    renderAsPartner(makePartner({ partnerId: 'P-1', email: 'partner@example.com' }));
    expect(sync.subscribeToCollection).not.toHaveBeenCalledWith('referral_claims', expect.anything());
    expect(sync.subscribeToQuery).toHaveBeenCalledWith(
      { ref: { name: 'referral_claims' }, constraints: [{ field: 'partnerEmail', op: '==', value: 'partner@example.com' }] },
      expect.any(Function)
    );
  });

  it('saves only the editable profile fields, never the commission rate or status', async () => {
    const partner = makePartner({ partnerId: 'P-1', _firestoreId: 'P-1', email: 'partner@example.com', commissionRate: 38, status: 'Active' });
    renderAsPartner(partner);
    fireEvent.click(screen.getAllByRole('button', { name: /^Edit$/ })[0]);
    expect(screen.queryByText(/Commission Rate \(LKR \/ SqFt\)/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await vi.waitFor(() => expect(sync.updateDocument).toHaveBeenCalled());
    const [collectionName, docId, payload] = sync.updateDocument.mock.calls[0];
    expect(collectionName).toBe('partners');
    expect(docId).toBe('P-1');
    const editable = ['name', 'contactPerson', 'phone', 'address', 'company', 'bankName', 'accountNumber', 'accountName', 'branchName', 'photoURL', 'documents'];
    expect(Object.keys(payload).filter((k) => !editable.includes(k))).toEqual([]);
  });
});
