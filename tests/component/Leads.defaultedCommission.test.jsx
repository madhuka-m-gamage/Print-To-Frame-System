import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../helpers/renderWithProviders';
import { makeLead, makePartner, makeUser } from '../helpers/factories';

vi.mock('@/services/firestoreSync', () => ({
  COLLECTIONS: { LEADS: 'leads', LOGISTICS: 'logistics', INVOICES: 'invoices', PROJECTS: 'projects', CUSTOMERS: 'customers', QUOTATIONS: 'quotations', NOTIFICATIONS: 'notifications' },
  addDocument: vi.fn(async () => {}),
  updateDocument: vi.fn(async () => {}),
  deleteDocument: vi.fn(async () => {}),
  setDocument: vi.fn(async () => {}),
  subscribeToCollection: vi.fn(() => () => {}),
  generateAtomicId: vi.fn(async (prefix) => `${prefix}-000042`),
}));
vi.mock('@/shared/utils/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
  showToast: vi.fn(),
}));
vi.mock('@/services/auditLog', () => ({ logActivity: vi.fn(async () => {}) }));
vi.mock('@/services/gemini', () => ({ extractCallScope: vi.fn(), generateStructuredQuotation: vi.fn() }));
vi.mock('@/services/driveService', () => ({ pickDriveFiles: vi.fn() }));

const { default: Leads } = await import('@/features/leads/Leads');
const { default: LeadCardDetails } = await import('@/features/leads/LeadCardDetails');
const sync = await import('@/services/firestoreSync');

const admin = { role: 'Admin', name: 'Admin', identifier: 'admin@example.com' };

describe('Leads defaulted-commission filter (MON-7)', () => {
  it('shows only leads whose pricing used the default commission rate', () => {
    const flagged = makeLead({ name: 'Flagged Client', pricingMetadata: { commissionRateDefaulted: true } });
    const clean = makeLead({ name: 'Clean Client', pricingMetadata: { commissionRateDefaulted: false } });
    const unpriced = makeLead({ name: 'Unpriced Client' });
    renderWithProviders(
      <Leads leads={[flagged, clean, unpriced]} setLeads={vi.fn()} logisticsJobs={[]} setLogisticsJobs={vi.fn()}
        setProjects={vi.fn()} setCustomers={vi.fn()} currentUser={admin} />,
      { role: 'Admin' }
    );
    expect(screen.getAllByText('Clean Client').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /Defaulted commission/i }));
    expect(screen.getAllByText('Flagged Client').length).toBeGreaterThan(0);
    expect(screen.queryByText('Clean Client')).toBeNull();
    expect(screen.queryByText('Unpriced Client')).toBeNull();
  });
});

describe('Applying pricing notifies Admins and Managers (MON-7)', () => {
  beforeEach(() => vi.clearAllMocks());

  const users = [
    makeUser('Admin', { identifier: 'a1@example.com' }),
    makeUser('Admin', { identifier: 'a2@example.com' }),
    makeUser('Manager', { identifier: 'm1@example.com' }),
    makeUser('Sales', { identifier: 's1@example.com' }),
    makeUser('Manager', { identifier: 'm2@example.com', status: 'Inactive' }),
  ];

  const apply = (lead, partners) => {
    renderWithProviders(
      <LeadCardDetails lead={lead} onClose={vi.fn()} onSave={vi.fn()} onConvert={vi.fn()}
        currentUser={admin} partners={partners} users={users} />
    );
    const [lengthInput, heightInput] = screen.getAllByPlaceholderText('0');
    fireEvent.change(lengthInput, { target: { value: '10' } });
    fireEvent.change(heightInput, { target: { value: '10' } });
    fireEvent.click(screen.getByText('Apply Calculator Results to Lead Quotation'));
  };

  it('writes one commission notification per active Admin and Manager when the rate is defaulted', async () => {
    const partner = makePartner({ id: 'P-1', partnerId: 'P-1', commissionRate: 0 });
    apply(makeLead({ source: 'Referral', partnerId: 'P-1', agentId: 'P-1' }), [partner]);
    await waitFor(() => expect(sync.addDocument).toHaveBeenCalledTimes(3));
    const calls = sync.addDocument.mock.calls;
    expect(calls.every(([col]) => col === 'notifications')).toBe(true);
    expect(calls.map(([, d]) => d.recipientEmail).sort()).toEqual(['a1@example.com', 'a2@example.com', 'm1@example.com']);
    expect(calls[0][1]).toMatchObject({ type: 'commission', read: false });
  });

  it('writes none when the partner has a rate', async () => {
    const partner = makePartner({ id: 'P-2', partnerId: 'P-2', commissionRate: 45 });
    apply(makeLead({ source: 'Referral', partnerId: 'P-2', agentId: 'P-2' }), [partner]);
    await screen.findByText(/Calculated Final Amount/);
    expect(sync.addDocument).not.toHaveBeenCalled();
  });
});
