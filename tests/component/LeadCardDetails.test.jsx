import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../helpers/renderWithProviders';
import { makeLead, makeDeal, makeInvoice, makePartner } from '../helpers/factories';

vi.mock('@/shared/utils/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
  showToast: vi.fn(),
}));
vi.mock('@/services/firestoreSync', () => ({
  COLLECTIONS: {},
  subscribeToCollection: vi.fn(() => () => {}),
  addDocument: vi.fn(),
  updateDocument: vi.fn(),
  setDocument: vi.fn(),
  deleteDocument: vi.fn(),
  batchWrite: vi.fn(),
}));
vi.mock('@/services/gemini', () => ({ extractCallScope: vi.fn() }));
vi.mock('@/features/quotations/QuotationBuilder', () => ({ default: () => null }));
vi.mock('@/features/leads/audioProcessing', () => ({
  downsampleAudio: vi.fn(async () => new File(['small'], 'compressed_recording.wav', { type: 'audio/wav' })),
}));
vi.mock('@/features/invoicing/invoiceTemplate', () => ({
  buildInvoiceHtml: vi.fn(() => '<html></html>'),
  openInvoicePrintWindow: vi.fn(),
}));

const { default: LeadCardDetails } = await import('@/features/leads/LeadCardDetails');
const { downsampleAudio } = await import('@/features/leads/audioProcessing');
const { buildInvoiceHtml } = await import('@/features/invoicing/invoiceTemplate');
const { toast } = await import('@/shared/utils/toast');

const render = (lead, props = {}) => renderWithProviders(
  <LeadCardDetails lead={lead} onClose={vi.fn()} onSave={vi.fn()} onConvert={vi.fn()} currentUser={{ role: 'Admin' }} {...props} />
);

const pickAudio = (file) => {
  fireEvent.change(document.querySelector('input[type="file"]'), { target: { files: [file] } });
};

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:test');
  globalThis.URL.revokeObjectURL = vi.fn();
});

describe('LeadCardDetails (TST-1)', () => {
  it('shows Convert to Deal only at the Received stage', () => {
    for (const stage of ['Intake', 'Contacted', 'Quoted']) {
      const { unmount } = render(makeLead({ stage }));
      expect(screen.queryByText('Convert to Deal')).toBeNull();
      unmount();
    }
    const { unmount } = render(makeLead({ stage: 'Received' }));
    expect(screen.getByText('Convert to Deal')).toBeTruthy();
    unmount();
    render(makeLead({ stage: 'Received', convertedToDeal: true }));
    expect(screen.queryByText('Convert to Deal')).toBeNull();
  });

  it("choosing an agent fills the partner fields and quotes with that partner's rate", () => {
    const low = makePartner({ id: 'P-LOW', partnerId: 'P-LOW', name: 'Low Rate Agent', commissionRate: 10 });
    const high = makePartner({ id: 'P-HIGH', partnerId: 'P-HIGH', name: 'High Rate Agent', commissionRate: 90 });
    const onSave = vi.fn();
    render(makeLead({ source: 'Referral' }), { partners: [low, high], onSave });

    const [lengthInput, heightInput] = screen.getAllByPlaceholderText('0');
    fireEvent.change(lengthInput, { target: { value: '10' } });
    fireEvent.change(heightInput, { target: { value: '10' } });

    const agentSelect = document.querySelector('select[name="agentId"]');
    fireEvent.change(agentSelect, { target: { value: 'P-LOW' } });
    const lowRate = screen.getByText(/SQFT @ LKR/).textContent;
    fireEvent.change(agentSelect, { target: { value: 'P-HIGH' } });
    const highRate = screen.getByText(/SQFT @ LKR/).textContent;
    expect(highRate).not.toEqual(lowRate);

    fireEvent.click(screen.getByText('Save Lead Details'));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      agentId: 'P-HIGH', partnerId: 'P-HIGH', partnerName: 'High Rate Agent', agentName: 'High Rate Agent', commissionRate: 90,
    }));
  });

  it('reprints a saved invoice as issued, not from the current lead', () => {
    const deal = makeDeal({ name: 'Renamed Customer', value: 400000 });
    const inv = makeInvoice({ id: 'INV-ADV-7', leadId: deal.id, type: 'Advance', amount: 75000, totalValue: 100000, customerName: 'Original Customer' });
    render(deal, { isDeal: true, invoices: [inv] });
    fireEvent.click(screen.getByRole('button', { name: /75% Advance/ }));
    expect(buildInvoiceHtml.mock.calls[0][0].invoice).toMatchObject({
      id: 'INV-ADV-7', amount: 75000, totalValue: 100000, customerName: 'Original Customer',
    });
  });

  it('prints a DRAFT from the card values when no invoice is saved', () => {
    render(makeDeal({ value: 400000 }), { isDeal: true });
    fireEvent.click(screen.getByRole('button', { name: /25% Final/ }));
    expect(buildInvoiceHtml.mock.calls[0][0].invoice).toMatchObject({ id: 'DRAFT-FINAL', amount: 100000 });
  });

  it('downsamples an oversized audio file instead of rejecting it', async () => {
    render(makeLead());
    const big = new File([new Uint8Array(4 * 1024 * 1024)], 'call.wav', { type: 'audio/wav' });
    pickAudio(big);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Audio file verified & ready for analysis'), { timeout: 3000 });
    expect(downsampleAudio).toHaveBeenCalledWith(big);
    expect(screen.getByText(/Optimized: .* MB \(8kHz WAV\)/)).toBeTruthy();
  });

  it('sends a small audio file as-is', async () => {
    render(makeLead());
    pickAudio(new File([new Uint8Array(1024)], 'call.mp3', { type: 'audio/mpeg' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Audio file verified & ready for analysis'), { timeout: 3000 });
    expect(downsampleAudio).not.toHaveBeenCalled();
  });
});
