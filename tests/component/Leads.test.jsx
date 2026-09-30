import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../helpers/renderWithProviders';
import { makeLead, makeDeal, makeInvoice } from '../helpers/factories';

vi.mock('@/services/firestoreSync', () => ({
  COLLECTIONS: { LEADS: 'leads', LOGISTICS: 'logistics', INVOICES: 'invoices', PROJECTS: 'projects', CUSTOMERS: 'customers', QUOTATIONS: 'quotations' },
  addDocument: vi.fn(async () => {}),
  updateDocument: vi.fn(async () => {}),
  deleteDocument: vi.fn(async () => {}),
  setDocument: vi.fn(async () => {}),
  subscribeToCollection: vi.fn(() => () => {}),
  generateAtomicId: vi.fn(async (prefix) => `${prefix}-000042`),
  generateInvoiceId: vi.fn(async (type) => `INV-${type === 'Final' ? 'FIN' : 'ADV'}-0042`),
}));
vi.mock('@/shared/utils/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
  showToast: vi.fn(),
}));
vi.mock('@/services/auditLog', () => ({ logActivity: vi.fn(async () => {}) }));
vi.mock('@/services/gemini', () => ({ extractCallScope: vi.fn(), generateStructuredQuotation: vi.fn() }));
vi.mock('@/services/driveService', () => ({ pickDriveFiles: vi.fn() }));

const { default: Leads } = await import('@/features/leads/Leads');
const sync = await import('@/services/firestoreSync');
const { logActivity } = await import('@/services/auditLog');
const { toast } = await import('@/shared/utils/toast');

const admin = { role: 'Admin', name: 'Admin', identifier: 'admin@example.com' };

const renderLeads = (props = {}) => renderWithProviders(
  <Leads
    leads={[]} setLeads={vi.fn()} logisticsJobs={[]} setLogisticsJobs={vi.fn()} setProjects={vi.fn()}
    setCustomers={vi.fn()} currentUser={admin} {...props}
  />,
  { role: 'Admin' }
);

const quoteFor = (lead, overrides = {}) => ({
  id: 'QT-000001', _firestoreId: 'QT-000001', leadId: lead.id, version: 1, status: 'Accepted',
  lineItems: [{ description: 'Steel frame', qty: 1, unit: 'job', unitPrice: 100000, taxPct: 0, discountPct: 0 }],
  notes: '', attachedFiles: [], ...overrides,
});

const openConvertModal = async (name) => {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`next stage for ${name}`, 'i') }));
  return screen.findByRole('button', { name: /Finalize Conversion to Deal/i });
};

beforeEach(() => vi.clearAllMocks());

describe('Leads pipeline value (TST-3)', () => {
  it('sums the estimated value of leads only, not deals', () => {
    const leads = [
      makeLead({ value: 100000 }),
      makeLead({ value: 250000 }),
      makeDeal({ value: 900000 }),
    ];
    renderLeads({ leads });
    expect(screen.getByText('Active Pipeline:').nextSibling.textContent).toBe('LKR 350,000');
  });
});

describe('Leads quote to invoice wiring (TST-3)', () => {
  it('passes onSaveInvoice through the lead card so the quotation raises the 75% Advance invoice', async () => {
    const lead = makeLead({ id: 'L-9', name: 'Nimal Fernando', stage: 'Processing', value: 100000, jobNo: 'PTF-7' });
    const onSaveInvoice = vi.fn();
    renderLeads({ leads: [lead], quotations: [quoteFor(lead)], onSaveInvoice });

    fireEvent.click(screen.getByRole('button', { name: /Inspect/ }));
    fireEvent.click(await screen.findByRole('button', { name: /75% Advance Invoice/ }));

    await waitFor(() => expect(onSaveInvoice).toHaveBeenCalledTimes(1));
    expect(sync.generateInvoiceId).toHaveBeenCalledWith('Advance');
    expect(onSaveInvoice.mock.calls[0][0]).toMatchObject({
      id: 'INV-ADV-0042', type: 'Advance', leadId: 'L-9', dealId: '', quotationId: 'QT-000001',
      amount: 75000, totalValue: 100000, balanceDue: 25000, advancePaid: 0, customerName: 'Nimal Fernando', jobNo: 'PTF-7',
    });
  });

  it('offers the Final invoice on a lead once its Advance is Paid, at the remaining 25%', async () => {
    const lead = makeLead({ id: 'L-9', name: 'Nimal Fernando', stage: 'Processing', value: 100000 });
    const advance = makeInvoice({ from: lead, type: 'Advance', id: 'INV-ADV-0001', status: 'Paid', leadId: 'L-9' });
    const onSaveInvoice = vi.fn();
    renderLeads({ leads: [lead], quotations: [quoteFor(lead, { status: 'Invoiced' })], invoices: [advance], onSaveInvoice });

    fireEvent.click(screen.getByRole('button', { name: /Inspect/ }));
    fireEvent.click(await screen.findByRole('button', { name: /25% Final Settlement/ }));

    await waitFor(() => expect(onSaveInvoice).toHaveBeenCalledTimes(1));
    expect(onSaveInvoice.mock.calls[0][0]).toMatchObject({
      id: 'INV-FIN-0042', type: 'Final', leadId: 'L-9', amount: 25000, totalValue: 100000, advancePaid: 75000,
    });
  });

  // Standing decision: lead stage advance stays manual. Moving a lead to "75% Invoice Submitted" records
  // the stage only; it never raises an invoice.
  it('moving a lead to the 75% Invoice stage writes the stage and no invoice', async () => {
    const lead = makeLead({ id: 'L-9', name: 'Nimal Fernando', stage: 'Processing', value: 100000 });
    const onSaveInvoice = vi.fn();
    renderLeads({ leads: [lead], quotations: [quoteFor(lead)], onSaveInvoice });
    fireEvent.click(screen.getByRole('button', { name: /next stage for Nimal Fernando/i }));
    await waitFor(() => expect(sync.updateDocument).toHaveBeenCalledWith('leads', 'L-9', expect.objectContaining({ stage: '75% Invoice Submitted' })));
    expect(onSaveInvoice).not.toHaveBeenCalled();
    expect(sync.addDocument).not.toHaveBeenCalled();
    expect(sync.generateInvoiceId).not.toHaveBeenCalled();
  });
});

describe('Leads conversion to a deal (TST-3)', () => {
  it('shows the quoted value and its 75% advance in the conversion modal', async () => {
    const lead = makeLead({ id: 'L-9', name: 'Nimal Fernando', stage: 'Received', value: 100000 });
    renderLeads({ leads: [lead] });
    await openConvertModal('Nimal Fernando');
    expect(screen.getByText('Total Quoted Value').nextSibling.textContent).toBe('LKR 100,000');
    expect(screen.getByText('75% Advance Due').nextSibling.textContent).toBe('LKR 75,000');
  });

  it('asks for an Advance invoice only when none exists on the lead lineage', async () => {
    const lead = makeLead({ id: 'L-9', name: 'Nimal Fernando', stage: 'Received', value: 100000 });
    const { unmount } = renderLeads({ leads: [lead] });
    await openConvertModal('Nimal Fernando');
    expect(screen.getByText(/Generate 75% Advance Invoice to finalize/)).toBeTruthy();
    unmount();

    renderLeads({ leads: [lead], invoices: [makeInvoice({ from: lead, type: 'Advance', leadId: 'L-9' })] });
    await openConvertModal('Nimal Fernando');
    expect(screen.getByText(/Review the generated 75% Advance Invoice/)).toBeTruthy();
  });

  it('allocates the deal and job numbers with generateAtomicId and writes the deal, the lead and the project', async () => {
    const lead = makeLead({ id: 'L-9', name: 'Nimal Fernando', email: 'nimal@example.com', stage: 'Received', value: 100000, jobScope: 'Two steel frames' });
    const setProjects = vi.fn();
    renderLeads({ leads: [lead], setProjects });
    fireEvent.click(await openConvertModal('Nimal Fernando'));

    await waitFor(() => expect(sync.addDocument).toHaveBeenCalledWith('projects', expect.anything(), 'PTF-000042'));
    expect(sync.generateAtomicId).toHaveBeenCalledWith('D');
    expect(sync.generateAtomicId).toHaveBeenCalledWith('PTF');
    expect(sync.updateDocument).toHaveBeenCalledWith('leads', 'L-9', expect.objectContaining({ stage: 'Completed', convertedToDeal: true, convertedDealId: 'D-000042' }));
    expect(sync.addDocument).toHaveBeenCalledWith('leads', expect.objectContaining({
      id: 'D-000042', isDeal: true, stage: 'Waiting', originalLeadId: 'L-9', jobNo: 'PTF-000042', linkedJobNo: 'PTF-000042', value: 100000,
    }), 'D-000042');
    expect(sync.addDocument).toHaveBeenCalledWith('projects', expect.objectContaining({
      jobNo: 'PTF-000042', leadId: 'L-9', dealId: 'D-000042', value: 100000, status: 'Pending', customerId: 'nimal@example.com',
    }), 'PTF-000042');
    expect(logActivity).toHaveBeenCalledWith('admin@example.com', 'Admin', 'LEAD_CONVERTED', 'Leads', expect.stringContaining('D-000042'));
  });

  it('keeps a job number the lead already has instead of drawing a new one', async () => {
    const lead = makeLead({ id: 'L-9', name: 'Nimal Fernando', stage: 'Received', value: 100000, jobNo: 'PTF-77' });
    renderLeads({ leads: [lead] });
    fireEvent.click(await openConvertModal('Nimal Fernando'));
    await waitFor(() => expect(sync.addDocument).toHaveBeenCalledWith('projects', expect.objectContaining({ jobNo: 'PTF-77' }), 'PTF-77'));
    expect(sync.generateAtomicId).not.toHaveBeenCalledWith('PTF');
  });

  it('converts nothing when an id cannot be allocated', async () => {
    sync.generateAtomicId.mockRejectedValueOnce(new Error('offline'));
    const lead = makeLead({ id: 'L-9', name: 'Nimal Fernando', stage: 'Received', value: 100000 });
    renderLeads({ leads: [lead] });
    fireEvent.click(await openConvertModal('Nimal Fernando'));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Could not convert the lead. Check your connection and try again.'));
    expect(sync.addDocument).not.toHaveBeenCalled();
    expect(sync.updateDocument).not.toHaveBeenCalled();
  });

  it('does not convert a lead that was already converted', async () => {
    const lead = makeLead({ id: 'L-9', name: 'Nimal Fernando', stage: 'Received', value: 100000, convertedToDeal: true, convertedDealId: 'D-1' });
    renderLeads({ leads: [lead] });
    fireEvent.click(await openConvertModal('Nimal Fernando'));
    await waitFor(() => expect(toast.info).toHaveBeenCalledWith('This lead has already been converted to a deal.'));
    expect(sync.addDocument).not.toHaveBeenCalled();
    expect(sync.generateAtomicId).not.toHaveBeenCalled();
  });

  it('adds an order to the customer already on file, matched by phone spelling', async () => {
    const lead = makeLead({ id: 'L-9', name: 'Nimal Fernando', email: '', phone: '0771234567', stage: 'Received', value: 100000 });
    const customer = { nic: '901234567V', name: 'Nimal Fernando', phone: '+94771234567', email: '', orders: 2 };
    renderLeads({ leads: [lead], customers: [customer] });
    fireEvent.click(await openConvertModal('Nimal Fernando'));
    await waitFor(() => expect(sync.updateDocument).toHaveBeenCalledWith('customers', '901234567V', { orders: 3 }));
    expect(sync.addDocument).not.toHaveBeenCalledWith('customers', expect.anything(), expect.anything());
  });

  it('creates an AUTO customer with one order when nobody matches', async () => {
    const lead = makeLead({ id: 'L-9', name: 'Nimal Fernando', email: 'nimal@example.com', phone: '0771234567', stage: 'Received', value: 100000 });
    renderLeads({ leads: [lead], customers: [{ nic: 'X', name: 'Someone Else', phone: '0712222222', email: 'other@example.com', orders: 1 }] });
    fireEvent.click(await openConvertModal('Nimal Fernando'));
    await waitFor(() => expect(sync.addDocument).toHaveBeenCalledWith('customers', expect.objectContaining({ name: 'Nimal Fernando', orders: 1, type: 'Individual' }), expect.stringMatching(/^AUTO-\d{6}$/)));
  });

  it('stamps the new deal id on the invoices already raised on the lead', async () => {
    const lead = makeLead({ id: 'L-9', name: 'Nimal Fernando', stage: 'Received', value: 100000 });
    const advance = makeInvoice({ from: lead, type: 'Advance', id: 'INV-ADV-0001', leadId: 'L-9', dealId: '' });
    renderLeads({ leads: [lead], invoices: [advance] });
    fireEvent.click(await openConvertModal('Nimal Fernando'));
    await waitFor(() => expect(sync.updateDocument).toHaveBeenCalledWith('invoices', 'INV-ADV-0001', { dealId: 'D-000042' }));
  });
});
