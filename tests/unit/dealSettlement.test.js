import { describe, it, expect } from 'vitest';
import { getFinalInvoiceAmounts, calculateDealCommission } from '@/utils/dealSettlement';

describe('getFinalInvoiceAmounts', () => {
  const deal = { id: 'D-1', originalLeadId: 'L-1', value: 100000 };

  it('uses the deal value at 25% when there is no quotation', () => {
    const res = getFinalInvoiceAmounts(deal, []);
    expect(res).toMatchObject({ quote: null, totalValue: 100000, finalAmount: 25000, advancePaid: 75000, quotedTotal: 0 });
  });

  it('prefers the highest-version Accepted quotation over the deal value', () => {
    const quotes = [
      { id: 'QT-1', leadId: 'L-1', version: 1, status: 'Accepted', grandTotal: 120000 },
      { id: 'QT-2', leadId: 'L-1', version: 2, status: 'Accepted', grandTotal: 200000 },
      { id: 'QT-3', leadId: 'L-1', version: 3, status: 'Draft', grandTotal: 999999 },
    ];
    const res = getFinalInvoiceAmounts(deal, quotes);
    expect(res.quote.id).toBe('QT-2');
    expect(res.totalValue).toBe(200000);
    expect(res.finalAmount).toBe(50000);
    expect(res.advancePaid).toBe(150000);
  });

  it('uses the stored balanceDue when the Accepted quotation has one', () => {
    const quotes = [{ id: 'QT-1', leadId: 'L-1', status: 'Accepted', grandTotal: 200000, balanceDue: 51000 }];
    expect(getFinalInvoiceAmounts(deal, quotes).finalAmount).toBe(51000);
  });

  it('falls back to a non-accepted linked quotation for line items but keeps the deal value', () => {
    const quotes = [{ id: 'QT-1', leadId: 'L-1', status: 'Draft', grandTotal: 999 }];
    const res = getFinalInvoiceAmounts(deal, quotes);
    expect(res.quote.id).toBe('QT-1');
    expect(res.totalValue).toBe(100000);
  });

  it('is zero for a deal with no value and no quotation', () => {
    expect(getFinalInvoiceAmounts({ id: 'D-2' }, [])).toMatchObject({ totalValue: 0, finalAmount: 0 });
  });
});

describe('calculateDealCommission', () => {
  it('pays area times the partner rate when the deal has square footage', () => {
    expect(calculateDealCommission({ totalSqFt: 10, value: 999 }, { commissionRate: 60 })).toEqual({ commissionAmount: 600, sqFtToAdd: 10 });
  });

  it('defaults the rate to 53.5 when the partner has none', () => {
    expect(calculateDealCommission({ totalSqFt: 10 }, {}).commissionAmount).toBeCloseTo(535);
    expect(calculateDealCommission({ totalSqFt: 10 }, undefined).commissionAmount).toBeCloseTo(535);
  });

  it('estimates from value at 850 per sq ft when there is no area, adding no square footage', () => {
    const res = calculateDealCommission({ totalSqFt: 0, value: 85000 }, { commissionRate: 53.5 });
    expect(res.commissionAmount).toBeCloseTo(5350);
    expect(res.sqFtToAdd).toBe(0);
  });

  it('is zero with neither area nor value', () => {
    expect(calculateDealCommission({}, { commissionRate: 53.5 })).toEqual({ commissionAmount: 0, sqFtToAdd: 0 });
  });
});
