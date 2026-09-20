import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../helpers/renderWithProviders';
import { makePartner } from '../helpers/factories';

vi.mock('../../src/services/firestoreSync', () => ({
  COLLECTIONS: { PARTNERS: 'partners', LEADS: 'leads', REFERRAL_CLAIMS: 'referral_claims', USERS: 'users', PARTNER_APPLICATIONS: 'partner_applications' },
  subscribeToCollection: vi.fn(() => () => {}),
  addDocument: vi.fn(async () => {}),
  updateDocument: vi.fn(async () => {}),
  deleteDocument: vi.fn(async () => {}),
  setDocument: vi.fn(async () => {}),
  batchWrite: vi.fn(async () => {}),
}));
vi.mock('../../src/utils/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
  showToast: vi.fn(),
}));
vi.mock('../../src/services/auditLog', () => ({ logActivity: vi.fn(async () => {}) }));
vi.mock('../../src/services/mailer', () => ({ sendTemplatedEmail: vi.fn(async () => {}) }));
vi.mock('../../src/services/adminUsers', () => ({
  deleteUserAccount: vi.fn(async () => {}),
  resetUserPassword: vi.fn(async () => {}),
}));
vi.mock('firebase/storage', () => ({ ref: vi.fn(), uploadBytes: vi.fn(), getDownloadURL: vi.fn() }));
vi.mock('../../src/components/crm/PartnerQRModal', () => ({ default: () => null }));

const { default: Partners } = await import('../../src/components/crm/Partners');
const sync = await import('../../src/services/firestoreSync');
const { toast } = await import('../../src/utils/toast');

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
});
