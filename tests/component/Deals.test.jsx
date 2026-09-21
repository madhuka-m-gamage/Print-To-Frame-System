import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../helpers/renderWithProviders';
import { makeDeal, makeInvoice, makePartner } from '../helpers/factories';

vi.mock('@/services/firestoreSync', () => ({
  COLLECTIONS: { LEADS: 'leads', INVOICES: 'invoices', PARTNERS: 'partners', LOGISTICS: 'logistics', CUSTOMERS: 'customers' },
  addDocument: vi.fn(async () => {}),
  updateDocument: vi.fn(async () => {}),
  deleteDocument: vi.fn(async () => {}),
  generateInvoiceId: vi.fn(async () => 'INV-FIN-0001'),
  generateAtomicId: vi.fn(async (prefix) => `${prefix}-0001`),
}));
vi.mock('@/utils/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
  showToast: vi.fn(),
}));
vi.mock('@/components/crm/LeadCardDetails', () => ({ default: () => null }));

const { default: Deals } = await import('@/components/crm/Deals');
const sync = await import('@/services/firestoreSync');
const { generateInvoiceId } = sync;

const admin = { role: 'Admin', name: 'Admin', identifier: 'admin@example.com' };

function renderDeals({ dealOverrides = {}, ...props } = {}) {
  const deal = makeDeal({ id: 'D-1', name: 'Kasun Silva', stage: 'Hand Over', value: 100000, isDeal: true, ...dealOverrides });
  const leads = [deal];
  const setLeads = vi.fn((updater) => (typeof updater === 'function' ? updater(leads) : updater));
  const onSaveInvoice = vi.fn();
  const view = renderWithProviders(
    <Deals leads={leads} setLeads={setLeads} currentUser={admin} onSaveInvoice={onSaveInvoice} {...props} />,
    { role: 'Admin' }
  );
  return { deal, setLeads, onSaveInvoice, unmount: view.unmount };
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

describe('Deals Completed-stage locks and commission', () => {
  it('offers a backward move from Hand Over but not from Completed', () => {
    const { unmount } = renderDeals();
    expect(screen.queryByRole('button', { name: /backward/i })).toBeInTheDocument();
    unmount();
    renderDeals({ dealOverrides: { stage: 'Completed' } });
    expect(screen.queryByRole('button', { name: /backward/i })).not.toBeInTheDocument();
  });

  const agentDeal = { agentId: 'P-1', totalSqFt: 10 };
  const partner = () => makePartner({ partnerId: 'P-1', name: 'Lanka Art Studio', commissionRate: 53.5, pending: 0, totalSqFt: 0 });

  it('accrues commission once and records commissionAccrued on completion', async () => {
    const { setLeads } = renderDeals({ dealOverrides: agentDeal, partners: [partner()], setPartners: vi.fn() });
    fireEvent.click(screen.getByRole('button', { name: /for Kasun Silva/i }));
    await waitFor(() => expect(sync.updateDocument).toHaveBeenCalledWith('leads', expect.anything(), expect.objectContaining({ stage: 'Completed', commissionAccrued: true })));
    expect(sync.updateDocument).toHaveBeenCalledWith('partners', expect.anything(), { pending: 535, totalSqFt: 10 });
    expect(setLeads).toHaveBeenCalled();
  });

  it('does not accrue commission again when the deal is already marked commissionAccrued', async () => {
    const setPartners = vi.fn();
    renderDeals({ dealOverrides: { ...agentDeal, commissionAccrued: true }, partners: [partner()], setPartners });
    fireEvent.click(screen.getByRole('button', { name: /for Kasun Silva/i }));
    await waitFor(() => expect(sync.updateDocument).toHaveBeenCalledWith('leads', expect.anything(), expect.objectContaining({ stage: 'Completed' })));
    expect(setPartners).not.toHaveBeenCalled();
    expect(sync.updateDocument).not.toHaveBeenCalledWith('partners', expect.anything(), expect.anything());
  });
});

describe('Deals completion amounts', () => {
  it('bills 25% of the Accepted quotation total and saves it as the deal value', async () => {
    const quote = { id: 'QT-2', leadId: 'L-1', dealId: 'D-1', version: 2, status: 'Accepted', grandTotal: 200000, lineItems: [{ description: 'Frame', qty: 1, unit: 'job', unitPrice: 200000 }] };
    const { onSaveInvoice } = renderDeals({ dealOverrides: { value: 100000 }, quotations: [{ ...quote, id: 'QT-2', dealId: 'D-1' }] });
    fireEvent.click(screen.getByRole('button', { name: /for Kasun Silva/i }));
    await waitFor(() => expect(onSaveInvoice).toHaveBeenCalledTimes(1));
    expect(onSaveInvoice.mock.calls[0][0]).toMatchObject({ amount: 50000, totalValue: 200000, advancePaid: 150000, quotationId: 'QT-2' });
    await waitFor(() => expect(sync.updateDocument).toHaveBeenCalledWith('leads', expect.anything(), expect.objectContaining({ value: 200000 })));
  });

  it('prices the fallback line at the full deal value so the template scales it to 25%', async () => {
    const { onSaveInvoice } = renderDeals({ dealOverrides: { value: 100000 } });
    fireEvent.click(screen.getByRole('button', { name: /for Kasun Silva/i }));
    await waitFor(() => expect(onSaveInvoice).toHaveBeenCalledTimes(1));
    expect(onSaveInvoice.mock.calls[0][0].lineItems[0].unitPrice).toBe(100000);
  });

  it('estimates commission from value when the deal has no square footage, without adding area', async () => {
    const partner = makePartner({ partnerId: 'P-1', name: 'Lanka Art Studio', commissionRate: 53.5, pending: 0, totalSqFt: 4 });
    renderDeals({ dealOverrides: { agentId: 'P-1', totalSqFt: 0, value: 85000 }, partners: [partner], setPartners: vi.fn() });
    fireEvent.click(screen.getByRole('button', { name: /for Kasun Silva/i }));
    await waitFor(() => expect(sync.updateDocument).toHaveBeenCalledWith('partners', expect.anything(), { pending: 5350, totalSqFt: 4 }));
  });
});
