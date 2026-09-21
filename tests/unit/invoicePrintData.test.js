import { describe, it, expect } from 'vitest';
import { resolveInvoiceForPrint } from '@/utils/invoicePrintData';

const saved = {
  id: 'INV-ADV-0007', status: 'Paid', date: '2026-08-01', amount: 750, totalValue: 1000,
  customerName: 'Original Name', company: 'Original Co', phone: '+94711111111',
  lineItems: [{ description: 'Frame', qty: 1, unitPrice: 1000 }], aiDraft: 'Scope at issue',
};
const edited = { name: 'Renamed Client', company: 'New Co', phone: '+94722222222', jobScope: 'Changed scope' };
const newerQuote = { lineItems: [{ description: 'Frame', qty: 1, unitPrice: 2000 }] };

describe('resolveInvoiceForPrint', () => {
  it('reprints a saved invoice exactly as issued, ignoring later edits to the lead and the quote', () => {
    const out = resolveInvoiceForPrint({ realInvoice: saved, type: 'Advance', formData: edited, activeQuote: newerQuote, draftTotal: 2000 });
    expect(out.id).toBe('INV-ADV-0007');
    expect(out.customerName).toBe('Original Name');
    expect(out.company).toBe('Original Co');
    expect(out.phone).toBe('+94711111111');
    expect(out.lineItems).toEqual(saved.lineItems);
    expect(out.amount).toBe(750);
    expect(out.totalValue).toBe(1000);
    expect(out.aiDraft).toBe('Scope at issue');
  });

  it('falls back to the newest quotation lines only when the saved invoice has none', () => {
    const out = resolveInvoiceForPrint({ realInvoice: { ...saved, lineItems: undefined }, type: 'Advance', formData: edited, activeQuote: newerQuote });
    expect(out.lineItems).toEqual(newerQuote.lineItems);
  });

  it('shows a clearly marked draft from the current lead and quote before any invoice is saved', () => {
    const adv = resolveInvoiceForPrint({ type: 'Advance', formData: edited, activeQuote: newerQuote, draftTotal: 2000 });
    expect(adv.id).toBe('DRAFT-ADVANCE');
    expect(adv.amount).toBe(1500);
    expect(adv.customerName).toBe('Renamed Client');
    expect(adv.lineItems).toEqual(newerQuote.lineItems);
    const fin = resolveInvoiceForPrint({ type: 'Final', formData: edited, draftTotal: 2000 });
    expect(fin.id).toBe('DRAFT-FINAL');
    expect(fin.amount).toBe(500);
  });
});
