import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../helpers/renderWithProviders';
import { makeLead, makeLogisticsJob, makeInvoice } from '../helpers/factories';

vi.mock('@/services/firestoreSync', () => ({
  COLLECTIONS: { LEADS: 'leads', LOGISTICS: 'logistics', INVOICES: 'invoices', PROJECTS: 'projects', CUSTOMERS: 'customers' },
  addDocument: vi.fn(async () => {}),
  updateDocument: vi.fn(async () => {}),
  deleteDocument: vi.fn(async () => {}),
  generateAtomicId: vi.fn(async () => 'X-1'),
}));
vi.mock('@/shared/utils/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
  showToast: vi.fn(),
}));
vi.mock('@/services/auditLog', () => ({ logActivity: vi.fn(async () => {}) }));

const { default: Leads } = await import('@/features/leads/Leads');
const sync = await import('@/services/firestoreSync');

const admin = { role: 'Admin', name: 'Admin', identifier: 'admin@example.com' };

describe('Leads logistics lookup (MON-3)', () => {
  it('shows the pickup as done when the job carries the converted deal id', () => {
    const lead = makeLead({ id: 'L-1', stage: '75% Invoice Submitted', convertedDealId: 'D-1' });
    const job = makeLogisticsJob({ leadId: 'D-1', status: 'Completed' });
    renderWithProviders(
      <Leads leads={[lead]} setLeads={vi.fn()} logisticsJobs={[job]} setLogisticsJobs={vi.fn()} setProjects={vi.fn()} currentUser={admin} />,
      { role: 'Admin' }
    );
    expect(screen.getByText('Picked Up')).toBeInTheDocument();
  });
});

describe('Lead conversion stamps the deal id on its invoices (MON-2)', () => {
  it('adds the new deal id to every invoice already raised on the lead, and no other', async () => {
    const lead = makeLead({ id: 'L-1', name: 'Nimal Fernando', stage: 'Received', value: 100000 });
    const advance = makeInvoice({ id: 'INV-ADV-0001', leadId: 'L-1', dealId: '' });
    const other = makeInvoice({ id: 'INV-ADV-0002', leadId: 'L-2', dealId: '' });
    renderWithProviders(
      <Leads leads={[lead]} setLeads={vi.fn()} logisticsJobs={[]} setLogisticsJobs={vi.fn()} setProjects={vi.fn()} currentUser={admin} invoices={[advance, other]} />,
      { role: 'Admin' }
    );
    fireEvent.click(screen.getByRole('button', { name: /next stage for Nimal Fernando/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Finalize Conversion to Deal/i }));
    await waitFor(() => expect(sync.updateDocument).toHaveBeenCalledWith('invoices', 'INV-ADV-0001', { dealId: 'X-1' }));
    expect(sync.updateDocument).not.toHaveBeenCalledWith('invoices', 'INV-ADV-0002', expect.anything());
  });
});
