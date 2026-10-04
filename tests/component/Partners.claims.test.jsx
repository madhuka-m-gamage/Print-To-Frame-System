import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { renderWithProviders } from '../helpers/renderWithProviders';
import { makePartner } from '../helpers/factories';

// FEA-2 (partners D-12): "Verify & Credit Commission" opens a resolve modal; an Admin links
// the claim to an existing lead or converts it into a new Referral lead.

const CLAIM = {
  _firestoreId: 'C-1', id: 'C-1', status: 'Pending Verification', clientName: 'Walk-in Client', clientPhone: '+94 71 111 2222',
  partnerId: 'P-1', partnerName: 'Lanka Art Studio', partnerEmail: 'studio@example.com', referralDate: '2026-10-01', notes: 'Met at the fair',
};

vi.mock('@/services/firestoreSync', () => ({
  COLLECTIONS: { PARTNERS: 'partners', PARTNER_PUBLIC: 'partner_public', LEADS: 'leads', PARTNER_PAYOUTS: 'partner_payouts', REFERRAL_CLAIMS: 'referral_claims', USERS: 'users', PARTNER_APPLICATIONS: 'partner_applications' },
  subscribeToCollection: vi.fn((name, cb) => { if (name === 'referral_claims') cb([CLAIM]); return () => {}; }),
  subscribeToQuery: vi.fn(() => () => {}),
  addDocument: vi.fn(async () => {}),
  updateDocument: vi.fn(async () => {}),
  deleteDocument: vi.fn(async () => {}),
  setDocument: vi.fn(async () => {}),
  batchWrite: vi.fn(async () => {}),
  generateAtomicId: vi.fn(async () => 'L-0042'),
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
const partner = makePartner({ _firestoreId: 'P-1', partnerId: 'P-1', name: 'Lanka Art Studio', email: 'studio@example.com', commissionRate: 30 });
const lead = { id: 'L-7', _firestoreId: 'L-7', name: 'Existing Lead', phone: '+94 71 111 2222', stage: 'Intake', source: 'Manual' };

beforeEach(() => vi.clearAllMocks());

const openResolve = (leads = [lead]) => {
  const setLeads = vi.fn();
  renderWithProviders(
    <Partners partners={[partner]} setPartners={vi.fn()} leads={leads} setLeads={setLeads} invoices={[]} projects={[]} users={[]} setUsers={vi.fn()} currentUser={admin} />,
    { role: 'Admin' }
  );
  fireEvent.click(screen.getByRole('button', { name: /Referral Claims/i }));
  fireEvent.click(screen.getByRole('button', { name: /Verify & Credit Commission/i }));
  return { setLeads, dialog: screen.getByRole('dialog', { name: /Resolve Referral Claim/i }) };
};

describe('Partners claim resolution (FEA-2)', () => {
  it('does not mark the claim verified until a lead is linked or created', () => {
    openResolve();
    expect(sync.updateDocument).not.toHaveBeenCalled();
  });

  it('links the claim to an existing lead with the partner fields and marks the claim linked', async () => {
    const { setLeads, dialog } = openResolve();
    fireEvent.change(within(dialog).getByLabelText(/Existing lead/i), { target: { value: 'L-7' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /Link to Lead/i }));

    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(sync.updateDocument).toHaveBeenCalledWith('leads', 'L-7', {
      agentId: 'P-1', partnerId: 'P-1', partnerName: 'Lanka Art Studio', agentName: 'Lanka Art Studio', commissionRate: 30,
    });
    expect(sync.updateDocument).toHaveBeenCalledWith('referral_claims', 'C-1', expect.objectContaining({
      status: 'Verified & Linked', linkedLeadId: 'L-7', verifiedBy: 'admin@example.com',
    }));
    expect(sync.addDocument).not.toHaveBeenCalled();
    expect(setLeads.mock.calls[0][0]([lead])[0]).toMatchObject({ id: 'L-7', partnerId: 'P-1' });
  });

  it('converts the claim into a new Referral lead with an atomic L id', async () => {
    const { setLeads, dialog } = openResolve();
    fireEvent.click(within(dialog).getByRole('button', { name: /Create New Lead/i }));

    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(sync.generateAtomicId).toHaveBeenCalledWith('L');
    expect(sync.addDocument).toHaveBeenCalledWith('leads', expect.objectContaining({
      id: 'L-0042', name: 'Walk-in Client', phone: '+94 71 111 2222', source: 'Referral', stage: 'Intake',
      partnerId: 'P-1', agentId: 'P-1', partnerName: 'Lanka Art Studio', commissionRate: 30,
    }), 'L-0042');
    expect(sync.updateDocument).toHaveBeenCalledWith('referral_claims', 'C-1', expect.objectContaining({
      status: 'Verified & Linked', linkedLeadId: 'L-0042',
    }));
    expect(setLeads.mock.calls[0][0]([lead])).toHaveLength(2);
  });

  it('writes nothing and says so when the id cannot be allocated', async () => {
    sync.generateAtomicId.mockRejectedValueOnce(new Error('offline'));
    const { dialog } = openResolve();
    fireEvent.click(within(dialog).getByRole('button', { name: /Create New Lead/i }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(sync.addDocument).not.toHaveBeenCalled();
    expect(sync.updateDocument).not.toHaveBeenCalled();
  });

  it('disables leads attributed to another partner and keeps own and unattributed leads selectable (FEA-19)', () => {
    const others = [
      lead,
      { id: 'L-8', _firestoreId: 'L-8', name: 'Taken By Partner', stage: 'Intake', partnerId: 'P-2' },
      { id: 'L-9', _firestoreId: 'L-9', name: 'Taken By Agent', stage: 'Intake', agentId: 'P-3' },
      { id: 'L-10', _firestoreId: 'L-10', name: 'Already Ours', stage: 'Intake', partnerId: 'P-1', agentId: 'P-1' },
    ];
    const { dialog } = openResolve(others);
    const option = (id) => within(dialog).getByRole('option', { name: new RegExp(`^${id} `) });
    expect(option('L-7')).not.toBeDisabled();
    expect(option('L-10')).not.toBeDisabled();
    expect(option('L-8')).toBeDisabled();
    expect(option('L-8').textContent).toMatch(/another partner/i);
    expect(option('L-9')).toBeDisabled();
  });
});
