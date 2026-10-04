import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../helpers/renderWithProviders';
import { makePartner } from '../helpers/factories';

vi.mock('@/services/firestoreSync', () => ({
  COLLECTIONS: { PARTNERS: 'partners', PARTNER_PUBLIC: 'partner_public', LEADS: 'leads', PARTNER_PAYOUTS: 'partner_payouts', PAYOUT_GUARDS: 'payout_guards', REFERRAL_CLAIMS: 'referral_claims', USERS: 'users', PARTNER_APPLICATIONS: 'partner_applications' },
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
  serverTimestamp: vi.fn(() => 'server-ts'),
  increment: vi.fn((n) => ({ increment: n })),
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
const { logActivity } = await import('@/services/auditLog');

const admin = { role: 'Admin', name: 'Admin', identifier: 'admin@example.com' };

beforeEach(() => vi.clearAllMocks());

describe('Partners monthly settlements', () => {
  // Flipped from the phantom-payout characterisation (partners D-1, FEA-1):
  // Disburse Payout now writes the payout, settles the leads and moves the
  // partner's balance in one batch.
  const partner = makePartner({ _firestoreId: 'P-1', partnerId: 'P-1', name: 'Lanka Art Studio', email: 'studio@example.com', commissionRate: 30, pending: 5000, settled: 100 });
  const deal = { id: 'D-1', _firestoreId: 'D-1', name: 'Deal Client', partnerId: 'P-1', source: 'Referral', stage: 'Completed', isDeal: true, originalLeadId: 'L-1', value: 1000, totalSqFt: 10 };
  const paidInvoices = [{ id: 'INV-ADV-1', leadId: 'L-1', amount: 750, status: 'Paid' }, { id: 'INV-FIN-1', leadId: 'D-1', amount: 250, status: 'Paid' }];

  const renderSettlements = ({ leads = [deal], invoices = paidInvoices, partners = [partner] } = {}) => {
    const setLeads = vi.fn();
    const setPartners = vi.fn();
    renderWithProviders(
      <Partners partners={partners} setPartners={setPartners} leads={leads} setLeads={setLeads} invoices={invoices} projects={[]} users={[]} setUsers={vi.fn()} currentUser={admin} />,
      { role: 'Admin' }
    );
    fireEvent.click(screen.getByRole('button', { name: /Monthly Settlements/i }));
    return { setLeads, setPartners, button: screen.getByRole('button', { name: /Disburse Payout/i }) };
  };

  it('writes the payout, settles the lead and moves the partner balance in exactly one batch', async () => {
    const { setLeads, setPartners, button } = renderSettlements();
    fireEvent.click(button);

    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(sync.batchWrite).toHaveBeenCalledTimes(1);
    const ops = sync.batchWrite.mock.calls[0][0];
    expect(ops).toHaveLength(4);
    const [payoutOp, guardOp, leadOp, partnerOp] = ops;
    expect(payoutOp).toEqual({
      type: 'set',
      collection: 'partner_payouts',
      docId: expect.any(String),
      data: {
        partnerId: 'P-1',
        partnerEmail: 'studio@example.com',
        partnerName: 'Lanka Art Studio',
        amount: 300,
        reference: expect.stringMatching(/^TXN-\d{6}$/),
        leadIds: ['D-1'],
        createdAt: expect.any(String),
        createdBy: 'admin@example.com',
      },
    });
    // MON-11: the create-only guard makes the server refuse a second payout of D-1.
    expect(guardOp).toEqual({
      type: 'set',
      collection: 'payout_guards',
      docId: 'D-1',
      data: { payoutId: payoutOp.docId, partnerId: 'P-1', reference: payoutOp.data.reference, createdAt: payoutOp.data.createdAt },
    });
    expect(leadOp).toEqual({ type: 'update', collection: 'leads', docId: 'D-1', data: { payoutStatus: 'Paid', payoutReference: payoutOp.data.reference } });
    // MON-14: deltas, not totals from the screen copy, so a concurrent payout of another referral is not lost.
    expect(partnerOp).toEqual({ type: 'update', collection: 'partners', docId: 'P-1', data: { pending: { increment: -300 }, settled: { increment: 300 } } });

    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining(payoutOp.data.reference));
    expect(logActivity).toHaveBeenCalledWith('admin@example.com', 'Admin', 'PAYOUT_DISBURSED', 'Partners', expect.stringContaining(payoutOp.data.reference));
    expect(setLeads).toHaveBeenCalledTimes(1);
    expect(setPartners).toHaveBeenCalledTimes(1);
    expect(setLeads.mock.calls[0][0]([deal])[0]).toMatchObject({ payoutStatus: 'Paid' });
    expect(setPartners.mock.calls[0][0]([partner])[0]).toMatchObject({ pending: 4700, settled: 400 });
    for (const fn of [sync.addDocument, sync.updateDocument, sync.setDocument, sync.deleteDocument]) {
      expect(fn).not.toHaveBeenCalled();
    }
  });

  it('writes nothing and says so when no commission is eligible', async () => {
    const { button } = renderSettlements({ invoices: [] });
    fireEvent.click(button);
    await waitFor(() => expect(toast.info).toHaveBeenCalledWith(expect.stringMatching(/No eligible commission/i)));
    expect(sync.batchWrite).not.toHaveBeenCalled();
    expect(logActivity).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('toasts the error and leaves local state unchanged when the batch fails', async () => {
    sync.batchWrite.mockRejectedValueOnce(new Error('permission-denied'));
    const { setLeads, setPartners, button } = renderSettlements();
    fireEvent.click(button);
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(setLeads).not.toHaveBeenCalled();
    expect(setPartners).not.toHaveBeenCalled();
    expect(logActivity).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  // MON-15: increments do not clamp, so a payout larger than the live pending balance is refused before any write.
  it('refuses a payout larger than the partner pending balance and writes nothing', async () => {
    const { setLeads, setPartners, button } = renderSettlements({ partners: [{ ...partner, pending: 200 }] });
    fireEvent.click(button);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/pending balance/i)));
    expect(sync.batchWrite).not.toHaveBeenCalled();
    expect(setLeads).not.toHaveBeenCalled();
    expect(setPartners).not.toHaveBeenCalled();
    expect(logActivity).not.toHaveBeenCalled();
  });

  it('explains a batch the server refused instead of a generic failure', async () => {
    sync.batchWrite.mockRejectedValueOnce(Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' }));
    const { button } = renderSettlements();
    fireEvent.click(button);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/refused/i)));
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('disables the button while the payout runs, so a double click writes one batch', async () => {
    let release;
    sync.batchWrite.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    const { button } = renderSettlements();
    fireEvent.click(button);
    await waitFor(() => expect(button).toBeDisabled());
    fireEvent.click(button);
    expect(sync.batchWrite).toHaveBeenCalledTimes(1);
    release();
    await waitFor(() => expect(button).not.toBeDisabled());
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

    await vi.waitFor(() => expect(sync.batchWrite).toHaveBeenCalled());
    const [partnerOp, publicOp] = sync.batchWrite.mock.calls[0][0];
    expect(partnerOp).toMatchObject({ type: 'update', collection: 'partners', docId: 'P-1' });
    const editable = ['name', 'contactPerson', 'phone', 'address', 'company', 'bankName', 'accountNumber', 'accountName', 'branchName', 'photoURL', 'documents'];
    expect(Object.keys(partnerOp.data).filter((k) => !editable.includes(k))).toEqual([]);
    // SEC-16: a set carrying the partners status, so a missing mirror is created (rules hold status to the record).
    expect(publicOp).toEqual({ type: 'set', collection: 'partner_public', docId: 'P-1', data: { name: partner.name, status: 'Active', logo: partner.photoURL || '' } });
    expect(sync.updateDocument).not.toHaveBeenCalled();
  });
});

// SEC-6: every partners write also writes partner_public/<doc id> in the same batch.
describe('Partners public profile mirror', () => {
  const renderAdmin = (partners = []) => renderWithProviders(
    <Partners partners={partners} setPartners={vi.fn()} leads={[]} setLeads={vi.fn()} invoices={[]} projects={[]} users={[]} setUsers={vi.fn()} currentUser={admin} />,
    { role: 'Admin' }
  );

  it('Register Partner creates the partner and its public mirror in one batch', async () => {
    renderAdmin();
    fireEvent.click(screen.getByRole('button', { name: /Register Partner/i }));
    fireEvent.change(screen.getByPlaceholderText('e.g. Design Ranga Framing'), { target: { name: 'name', value: 'Ranga Framing' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. P-1002 (auto-generated if empty)'), { target: { name: 'partnerId', value: 'P-1002' } });
    fireEvent.change(screen.getByPlaceholderText('studio@example.com'), { target: { name: 'email', value: 'Ranga@Example.com' } });
    fireEvent.click(screen.getAllByRole('button', { name: /^Register Partner$/ }).at(-1));

    await vi.waitFor(() => expect(sync.batchWrite).toHaveBeenCalledTimes(1));
    const [partnerOp, publicOp] = sync.batchWrite.mock.calls[0][0];
    expect(partnerOp).toMatchObject({ type: 'set', collection: 'partners', docId: 'P-1002', data: { name: 'Ranga Framing', email: 'ranga@example.com', partnerId: 'P-1002', createdAt: 'server-ts' } });
    expect(publicOp).toEqual({ type: 'set', collection: 'partner_public', docId: 'P-1002', data: { name: 'Ranga Framing', status: 'Active', logo: '' } });
    expect(sync.addDocument).not.toHaveBeenCalled();
  });

  it('a staff Edit save writes the partner and sets its mirror, status included', async () => {
    const partner = makePartner({ partnerId: 'P-1', _firestoreId: 'P-1', name: 'Lanka Art Studio', status: 'Inactive', photoURL: 'logo.png', accountNumber: '123' });
    renderAdmin([partner]);
    fireEvent.click(screen.getAllByRole('button', { name: /^Edit$/ })[0]);
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await vi.waitFor(() => expect(sync.batchWrite).toHaveBeenCalledTimes(1));
    const [partnerOp, publicOp] = sync.batchWrite.mock.calls[0][0];
    expect(partnerOp).toMatchObject({ type: 'update', collection: 'partners', docId: 'P-1' });
    expect(publicOp).toEqual({ type: 'set', collection: 'partner_public', docId: 'P-1', data: { name: 'Lanka Art Studio', status: 'Inactive', logo: 'logo.png' } });
    expect(sync.updateDocument).not.toHaveBeenCalled();
  });
});
