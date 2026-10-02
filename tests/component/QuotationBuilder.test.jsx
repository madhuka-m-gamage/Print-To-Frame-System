import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../helpers/renderWithProviders';
import { makeLead, makeDeal, makeInvoice } from '../helpers/factories';

vi.mock('@/services/firestoreSync', () => ({
  COLLECTIONS: { QUOTATIONS: 'quotations', LEADS: 'leads', INVOICES: 'invoices' },
  addDocument: vi.fn(async () => {}),
  updateDocument: vi.fn(async () => {}),
  generateInvoiceId: vi.fn(async (type) => `INV-${type === 'Final' ? 'FIN' : 'ADV'}-0042`),
  generateAtomicId: vi.fn(async (prefix) => `${prefix}-000042`),
}));
vi.mock('@/shared/utils/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
  showToast: vi.fn(),
}));
vi.mock('@/services/gemini', () => ({ generateStructuredQuotation: vi.fn() }));
vi.mock('@/services/driveService', () => ({ pickDriveFiles: vi.fn() }));

const { default: QuotationBuilder } = await import('@/features/quotations/QuotationBuilder');
const sync = await import('@/services/firestoreSync');
const { toast } = await import('@/shared/utils/toast');

const item = (overrides = {}) => ({ description: 'Steel frame', qty: 1, unit: 'job', unitPrice: 100000, taxPct: 0, discountPct: 0, ...overrides });

const quoteFor = (lead, overrides = {}) => ({
  id: 'QT-000001', _firestoreId: 'QT-000001', leadId: lead.id, version: 1, status: 'Accepted',
  lineItems: [item()], notes: '', attachedFiles: [], ...overrides,
});

const render = (lead, props = {}) => {
  const onSaveInvoice = props.onSaveInvoice || vi.fn();
  const result = renderWithProviders(
    <QuotationBuilder lead={lead} allQuotations={[]} currentUser={{ role: 'Admin', identifier: 'admin@example.com' }} {...props} onSaveInvoice={onSaveInvoice} />
  );
  return { ...result, onSaveInvoice };
};

beforeEach(() => vi.clearAllMocks());

describe('QuotationBuilder totals (TST-3)', () => {
  it('applies each line discount then tax, and splits the grand total 75 / 25', () => {
    const lead = makeLead();
    // 2 x 50,000 = 100,000; less 10% = 90,000; plus 15% tax = 103,500
    const quote = quoteFor(lead, { lineItems: [item({ qty: 2, unitPrice: 50000, discountPct: 10, taxPct: 15 })] });
    render(lead, { allQuotations: [quote] });
    expect(screen.getByText('Grand Total (Net Payable):').nextSibling.textContent).toBe('LKR 103,500.00');
    expect(screen.getByText('75% Advance Due').nextSibling.textContent).toBe('LKR 77,625.00');
    expect(screen.getByText('25% Final on Delivery').nextSibling.textContent).toBe('LKR 25,875.00');
  });
});

describe('QuotationBuilder saving (TST-3)', () => {
  it('creates quote v1 with an id from generateAtomicId and the totals, and syncs the lead value', async () => {
    const lead = makeLead({ id: 'L-9', name: 'Nimal', phone: '0771234567' });
    render(lead);
    fireEvent.change(screen.getByPlaceholderText(/Specification/), { target: { value: 'Steel frame' } });
    fireEvent.change(screen.getByDisplayValue('0'), { target: { value: '40000' } });
    fireEvent.click(screen.getByRole('button', { name: /Save Quotation v1/ }));

    await waitFor(() => expect(sync.addDocument).toHaveBeenCalled());
    expect(sync.generateAtomicId).toHaveBeenCalledWith('QT');
    const [collection, payload, docId] = sync.addDocument.mock.calls[0];
    expect(collection).toBe('quotations');
    expect(docId).toBe('QT-000042');
    expect(payload).toMatchObject({
      id: 'QT-000042', leadId: 'L-9', version: 1, status: 'Draft',
      subtotal: 40000, grandTotal: 40000, advanceDue: 30000, balanceDue: 10000,
    });
    await waitFor(() => expect(sync.updateDocument).toHaveBeenCalledWith('leads', 'L-9', { value: 40000 }));
  });

  it('updates the open quote in place instead of adding another', async () => {
    const lead = makeLead({ id: 'L-9' });
    const quote = quoteFor(lead, { status: 'Sent' });
    render(lead, { allQuotations: [quote] });
    fireEvent.click(screen.getByRole('button', { name: 'Edit Quote' }));
    fireEvent.click(screen.getByRole('button', { name: 'Update Saved Quotation' }));
    await waitFor(() => expect(sync.updateDocument).toHaveBeenCalledWith('quotations', 'QT-000001', expect.objectContaining({ grandTotal: 100000, advanceDue: 75000, balanceDue: 25000 })));
    expect(sync.addDocument).not.toHaveBeenCalled();
  });

  it('refuses to save a quote with no described line item', () => {
    render(makeLead());
    fireEvent.click(screen.getByRole('button', { name: /Save Quotation v1/ }));
    expect(toast.error).toHaveBeenCalledWith('Add at least one line item with a description.');
    expect(sync.addDocument).not.toHaveBeenCalled();
  });

  it('clones to the next version as a Draft pointing at its parent', async () => {
    const lead = makeLead({ id: 'L-9' });
    render(lead, { allQuotations: [quoteFor(lead, { version: 2 })] });
    fireEvent.click(screen.getByRole('button', { name: 'Edit Quote' }));
    fireEvent.click(screen.getByRole('button', { name: /Clone to v3/ }));
    await waitFor(() => expect(sync.addDocument).toHaveBeenCalled());
    expect(sync.addDocument.mock.calls[0][1]).toMatchObject({ version: 3, status: 'Draft', parentQuoteId: 'QT-000001', id: 'QT-000042' });
  });
});

describe('QuotationBuilder quote to invoice (TST-3)', () => {
  it('raises the Advance invoice at 75% with the id from generateInvoiceId, then marks the quote Invoiced', async () => {
    const lead = makeLead({ id: 'L-9', name: 'Nimal', company: 'Acme', phone: '0771234567', jobNo: 'PTF-7', partnerId: 'P-1' });
    const { onSaveInvoice } = render(lead, { allQuotations: [quoteFor(lead)] });
    fireEvent.click(screen.getByRole('button', { name: /75% Advance Invoice/ }));

    await waitFor(() => expect(onSaveInvoice).toHaveBeenCalledTimes(1));
    expect(sync.generateInvoiceId).toHaveBeenCalledWith('Advance');
    expect(onSaveInvoice.mock.calls[0][0]).toMatchObject({
      id: 'INV-ADV-0042', type: 'Advance', status: 'Unpaid',
      leadId: 'L-9', dealId: '', quotationId: 'QT-000001', partnerId: 'P-1', jobNo: 'PTF-7', linkedJobNo: 'PTF-7',
      customerName: 'Nimal', company: 'Acme',
      amount: 75000, totalValue: 100000, advancePaid: 0, balanceDue: 25000,
    });
    expect(onSaveInvoice.mock.calls[0][0].lineItems).toEqual([item()]);
    await waitFor(() => expect(sync.updateDocument).toHaveBeenCalledWith('quotations', 'QT-000001', { status: 'Invoiced' }));
  });

  it('raises the Final invoice at 25% for a deal, carrying the 75% already due, under both lineage ids', async () => {
    const lead = makeLead({ id: 'L-9' });
    const deal = makeDeal({ lead, id: 'D-9', jobNo: 'PTF-7' });
    const { onSaveInvoice } = render(deal, { allQuotations: [quoteFor(lead, { status: 'Invoiced' })] });
    fireEvent.click(screen.getByRole('button', { name: /25% Final Settlement/ }));

    await waitFor(() => expect(onSaveInvoice).toHaveBeenCalledTimes(1));
    expect(sync.generateInvoiceId).toHaveBeenCalledWith('Final');
    expect(onSaveInvoice.mock.calls[0][0]).toMatchObject({
      id: 'INV-FIN-0042', type: 'Final', status: 'Unpaid',
      leadId: 'L-9', dealId: 'D-9', quotationId: 'QT-000001',
      amount: 25000, totalValue: 100000, advancePaid: 75000, balanceDue: 25000,
    });
    expect(sync.updateDocument).not.toHaveBeenCalledWith('quotations', expect.anything(), { status: 'Invoiced' });
  });

  it('offers no invoice button while the quote is Draft, Sent or Rejected', () => {
    for (const status of ['Draft', 'Sent', 'Rejected']) {
      const lead = makeLead();
      const { unmount } = render(lead, { allQuotations: [quoteFor(lead, { status })] });
      expect(screen.queryByRole('button', { name: /75% Advance Invoice/ })).toBeNull();
      unmount();
    }
  });

  it('offers the Final invoice on a plain lead only once the Advance is Paid', () => {
    const lead = makeLead({ id: 'L-9' });
    const quotes = [quoteFor(lead)];
    const unpaid = makeInvoice({ from: lead, type: 'Advance', status: 'Unpaid' });
    const { unmount } = render(lead, { allQuotations: quotes, advanceInvoice: unpaid });
    expect(screen.queryByRole('button', { name: /25% Final Settlement/ })).toBeNull();
    unmount();
    render(lead, { allQuotations: quotes, advanceInvoice: { ...unpaid, status: 'Paid' } });
    expect(screen.getByRole('button', { name: /25% Final Settlement/ })).toBeTruthy();
  });

  it('shows a static confirmation, not a button, once the invoice exists', () => {
    const lead = makeLead({ id: 'L-9' });
    const advance = makeInvoice({ from: lead, type: 'Advance', id: 'INV-ADV-0001', status: 'Paid' });
    const final = makeInvoice({ from: lead, type: 'Final', id: 'INV-FIN-0001' });
    render(makeDeal({ lead }), { allQuotations: [quoteFor(lead)], advanceInvoice: advance, finalInvoice: final });
    expect(screen.getByText(/Advance Invoice Generated — INV-ADV-0001/)).toBeTruthy();
    expect(screen.getByText(/Final Settlement Generated — INV-FIN-0001/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /75% Advance Invoice/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /25% Final Settlement/ })).toBeNull();
  });

  it('saves nothing when the invoice number cannot be allocated', async () => {
    sync.generateInvoiceId.mockRejectedValueOnce(new Error('offline'));
    const lead = makeLead({ id: 'L-9' });
    const { onSaveInvoice } = render(lead, { allQuotations: [quoteFor(lead)] });
    fireEvent.click(screen.getByRole('button', { name: /75% Advance Invoice/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Failed to generate an invoice number: offline'));
    expect(onSaveInvoice).not.toHaveBeenCalled();
    expect(sync.updateDocument).not.toHaveBeenCalledWith('quotations', expect.anything(), { status: 'Invoiced' });
  });

  it('does not double-raise an invoice while the first is still being numbered', async () => {
    let release;
    sync.generateInvoiceId.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    const lead = makeLead({ id: 'L-9' });
    const { onSaveInvoice } = render(lead, { allQuotations: [quoteFor(lead)] });
    const button = screen.getByRole('button', { name: /75% Advance Invoice/ });
    fireEvent.click(button);
    fireEvent.click(button);
    release('INV-ADV-0099');
    await waitFor(() => expect(onSaveInvoice).toHaveBeenCalledTimes(1));
    expect(sync.generateInvoiceId).toHaveBeenCalledTimes(1);
  });

  it('rounds the Advance to cents and bills the remainder as the Final (MON-8)', async () => {
    const lead = makeLead({ id: 'L-9' });
    const quote = quoteFor(lead, { lineItems: [item({ unitPrice: 33333.33 })] });
    const { onSaveInvoice } = render(lead, { allQuotations: [quote] });
    fireEvent.click(screen.getByRole('button', { name: /75% Advance Invoice/ }));
    await waitFor(() => expect(onSaveInvoice).toHaveBeenCalled());
    const inv = onSaveInvoice.mock.calls[0][0];
    expect(inv.amount).toBe(25000);
    expect(inv.balanceDue).toBe(8333.33);
  });
});
