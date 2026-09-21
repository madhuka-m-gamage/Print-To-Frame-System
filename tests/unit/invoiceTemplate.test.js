import { describe, it, expect } from 'vitest';
import { buildInvoiceHtml } from '@/utils/invoiceTemplate';

const money = (n, opts = { minimumFractionDigits: 2, maximumFractionDigits: 2 }) => n.toLocaleString(undefined, opts);

describe('invoiceTemplate', () => {
  describe('milestone amounts', () => {
    it('shows a 75% Advance invoice with the contract value grossed up by 1/0.75', () => {
      const html = buildInvoiceHtml({ invoice: { id: 'INV-ADV-0001', type: 'Advance', status: 'Unpaid', amount: 75000 } });
      expect(html).toContain('75% Advance Invoice');
      expect(html).toContain('PAYMENT DUE / COD');
      expect(html).toContain(`LKR ${money(100000, { minimumFractionDigits: 2 })}`);
      expect(html).toContain('Balance Due on Delivery:');
      expect(html).toContain(`LKR ${money(25000, { minimumFractionDigits: 2 })}`);
      expect(html).toContain('Advance Amount Due:');
    });

    it('shows a 25% Final invoice with the advance paid derived as 75% of the contract value', () => {
      const html = buildInvoiceHtml({ invoice: { id: 'INV-FIN-0001', type: 'Final', status: 'Unpaid', amount: 25000 } });
      expect(html).toContain('25% Final Settlement Invoice');
      expect(html).toContain('Advance Paid (75%):');
      expect(html).toContain(`LKR ${money(75000, { minimumFractionDigits: 2 })}`);
      expect(html).toContain('Final Settlement Due:');
    });

    it('prefers an explicit totalValue over the derived contract value', () => {
      const html = buildInvoiceHtml({ invoice: { id: 'INV-ADV-0002', type: 'Advance', amount: 75000, totalValue: 120000 } });
      expect(html).toContain(`LKR ${money(120000, { minimumFractionDigits: 2 })}`);
    });

    it('marks a paid invoice as settled', () => {
      const html = buildInvoiceHtml({ invoice: { id: 'INV-ADV-0003', type: 'Advance', status: 'Paid', amount: 75000 } });
      expect(html).toContain('PAID & SETTLED');
      expect(html).toContain('badge-paid');
    });
  });

  describe('line items', () => {
    // Flipped in Phase 7 2.4 (invoicing Phase 2 item 5): line totals apply the
    // line's discountPct and taxPct before the 0.75 / 0.25 milestone scaling.
    it('applies discountPct and taxPct before the milestone scaling', () => {
      const lineItems = [{ description: 'Steel frame', qty: 2, unitPrice: 50000, discountPct: 10, taxPct: 15 }];
      const adv = buildInvoiceHtml({ invoice: { id: 'INV-ADV-0004', type: 'Advance', amount: 75000, lineItems } });
      const fin = buildInvoiceHtml({ invoice: { id: 'INV-FIN-0004', type: 'Final', amount: 25000, lineItems } });
      expect(adv).toContain(money(2 * 50000 * 0.9 * 1.15 * 0.75));
      expect(fin).toContain(money(2 * 50000 * 0.9 * 1.15 * 0.25));
    });

    it('scales a line with no discount or tax by 0.75 (Advance) or 0.25 (Final)', () => {
      const lineItems = [{ description: 'Steel frame', qty: 2, unitPrice: 50000 }];
      expect(buildInvoiceHtml({ invoice: { id: 'A', type: 'Advance', amount: 75000, lineItems } })).toContain(money(75000));
      expect(buildInvoiceHtml({ invoice: { id: 'F', type: 'Final', amount: 25000, lineItems } })).toContain(money(25000));
    });

    it('falls back to a single generic line for the invoice amount when there are no line items', () => {
      const html = buildInvoiceHtml({ invoice: { id: 'INV-FIN-0005', type: 'Final', amount: 25000 } });
      expect(html).toContain('Final Settlement Payment (25%)');
      expect(html).toContain(money(25000));
    });
  });

  describe('header details', () => {
    it('uses DRAFT when the invoice has no id and Valued Client when it has no name', () => {
      const html = buildInvoiceHtml({ invoice: {} });
      expect(html).toContain('DRAFT');
      expect(html).toContain('Valued Client');
    });

    it('shows delivery location and phone only when supplied', () => {
      const withBoth = buildInvoiceHtml({ invoice: { id: 'X' }, customerPhone: '0771234567', deliveryLocation: 'Colombo 03' });
      const without = buildInvoiceHtml({ invoice: { id: 'X' } });
      expect(withBoth).toContain('Delivery Location:');
      expect(withBoth).toContain('0771234567');
      expect(without).not.toContain('Delivery Location:');
      expect(without).not.toContain('Contact Phone:');
    });
  });
});
