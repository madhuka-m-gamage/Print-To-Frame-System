import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../helpers/renderWithProviders';
import { makeDeal, makeInvoice } from '../helpers/factories';

vi.mock('../../src/services/firestoreSync', () => ({
  COLLECTIONS: { LEADS: 'leads', INVOICES: 'invoices', PARTNERS: 'partners', LOGISTICS: 'logistics', CUSTOMERS: 'customers' },
  addDocument: vi.fn(async () => {}),
  updateDocument: vi.fn(async () => {}),
  deleteDocument: vi.fn(async () => {}),
  generateInvoiceId: vi.fn(async () => 'INV-FIN-0001'),
  generateAtomicId: vi.fn(async (prefix) => `${prefix}-0001`),
}));
vi.mock('../../src/utils/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
  showToast: vi.fn(),
}));
vi.mock('../../src/components/crm/LeadCardDetails', () => ({ default: () => null }));

const { default: Deals } = await import('../../src/components/crm/Deals');
const sync = await import('../../src/services/firestoreSync');
const { generateInvoiceId } = sync;

const admin = { role: 'Admin', name: 'Admin', identifier: 'admin@example.com' };

function renderDeals(props = {}) {
  const deal = makeDeal({ id: 'D-1', name: 'Kasun Silva', stage: 'Hand Over', value: 100000, isDeal: true });
  const leads = [deal];
  const setLeads = vi.fn((updater) => (typeof updater === 'function' ? updater(leads) : updater));
  const onSaveInvoice = vi.fn();
  renderWithProviders(
    <Deals leads={leads} setLeads={setLeads} currentUser={admin} onSaveInvoice={onSaveInvoice} {...props} />,
    { role: 'Admin' }
  );
  return { deal, setLeads, onSaveInvoice };
}

beforeEach(() => vi.clearAllMocks());

describe('Deals completion wiring', () => {
  it('creates a 25% Final invoice when a deal in Hand Over is moved to Completed', async () => {
    const { onSaveInvoice } = renderDeals();
    fireEvent.click(screen.getByRole('button', { name: /for Kasun Silva/i }));
    await waitFor(() => expect(onSaveInvoice).toHaveBeenCalledTimes(1));
    expect(generateInvoiceId).toHaveBeenCalledWith('Final');
    const invoice = onSaveInvoice.mock.calls[0][0];
    expect(invoice).toMatchObject({ id: 'INV-FIN-0001', type: 'Final', status: 'Unpaid', dealId: 'D-1', amount: 25000, totalValue: 100000 });
  });

  // Flipped in Phase 7 2.1 (invoicing D-1): a deal that already has a Final invoice
  // completes without creating a second one.
  it('does not create another Final invoice when the deal already has one, and still completes', async () => {
    const existing = makeInvoice({ id: 'INV-FIN-0009', type: 'Final', dealId: 'D-1', leadId: 'D-1', status: 'Unpaid' });
    const { onSaveInvoice, setLeads } = renderDeals({ invoices: [existing] });
    fireEvent.click(screen.getByRole('button', { name: /for Kasun Silva/i }));
    await waitFor(() => expect(setLeads).toHaveBeenCalled());
    expect(generateInvoiceId).not.toHaveBeenCalled();
    expect(onSaveInvoice).not.toHaveBeenCalled();
    expect(sync.updateDocument).toHaveBeenCalledWith('leads', expect.anything(), expect.objectContaining({ stage: 'Completed' }));
  });

  it('still creates the Final invoice when the only existing one is cancelled', async () => {
    const cancelled = makeInvoice({ id: 'INV-FIN-0009', type: 'Final', dealId: 'D-1', status: 'Cancelled' });
    const { onSaveInvoice } = renderDeals({ invoices: [cancelled] });
    fireEvent.click(screen.getByRole('button', { name: /for Kasun Silva/i }));
    await waitFor(() => expect(onSaveInvoice).toHaveBeenCalledTimes(1));
  });
});
