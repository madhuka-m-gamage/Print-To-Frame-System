import { describe, it, expect } from 'vitest';
import { isFullyPaid, isFullSettlementInvoice } from '@/utils/invoiceSettlement';

const adv = (o = {}) => ({ id: 'INV-ADV-0001', type: 'Advance', amount: 75000, totalValue: 100000, status: 'Unpaid', createdAt: '2026-01-01T00:00:00Z', ...o });
const fin = (o = {}) => ({ id: 'INV-FIN-0001', type: 'Final', amount: 25000, totalValue: 100000, status: 'Unpaid', createdAt: '2026-01-02T00:00:00Z', ...o });

describe('isFullSettlementInvoice', () => {
  it('recognises a Full type or an invoice that bills the whole total', () => {
    expect(isFullSettlementInvoice({ type: 'Full' })).toBe(true);
    expect(isFullSettlementInvoice({ type: 'Advance', amount: 100000, totalValue: 100000 })).toBe(true);
  });

  it('does not treat a 75% or 25% invoice, or an invoice with no total, as full settlement', () => {
    expect(isFullSettlementInvoice(adv())).toBe(false);
    expect(isFullSettlementInvoice(fin())).toBe(false);
    expect(isFullSettlementInvoice({ amount: 5000 })).toBe(false);
    expect(isFullSettlementInvoice(null)).toBe(false);
  });
});

describe('isFullyPaid', () => {
  it('needs both the Advance and the Final paid', () => {
    expect(isFullyPaid([adv({ status: 'Paid' }), fin()], 'INV-ADV-0001')).toBe(false);
    expect(isFullyPaid([adv({ status: 'Paid' }), fin()], 'INV-FIN-0001')).toBe(true);
    expect(isFullyPaid([adv(), fin({ status: 'Paid' })], 'INV-FIN-0001')).toBe(false);
  });

  it('is not settled while the Final invoice does not exist yet', () => {
    expect(isFullyPaid([adv()], 'INV-ADV-0001')).toBe(false);
  });

  it('uses the latest invoice of each kind so a stale paid one cannot mask a current unpaid one', () => {
    const oldAdv = adv({ id: 'INV-ADV-0000', status: 'Paid', createdAt: '2025-12-01T00:00:00Z' });
    expect(isFullyPaid([oldAdv, adv(), fin({ status: 'Paid' })], 'INV-FIN-0001')).toBe(false);
  });

  it('is settled by a single paid full-settlement invoice with no Advance/Final pair', () => {
    const full = { id: 'INV-9', type: 'Full', amount: 100000, totalValue: 100000, status: 'Unpaid' };
    expect(isFullyPaid([full], 'INV-9')).toBe(true);
    expect(isFullyPaid([full], 'other')).toBe(false);
  });

  it('is false for no invoices', () => {
    expect(isFullyPaid([], 'x')).toBe(false);
    expect(isFullyPaid(undefined, 'x')).toBe(false);
  });
});
