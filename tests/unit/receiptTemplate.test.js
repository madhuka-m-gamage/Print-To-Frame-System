import { describe, it, expect } from 'vitest';
import { amountToWords, buildReceiptHtml } from '../../src/utils/receiptTemplate';

describe('receiptTemplate', () => {
  describe('amountToWords', () => {
    it('spells whole amounts and cents', () => {
      expect(amountToWords(0)).toBe('Zero and 00/100');
      expect(amountToWords(15)).toBe('Fifteen and 00/100');
      expect(amountToWords(101)).toBe('One Hundred One and 00/100');
      expect(amountToWords(22526.53)).toBe('Twenty Two Thousand Five Hundred Twenty Six and 53/100');
      expect(amountToWords(1000000)).toBe('One Million and 00/100');
    });

    it('treats negative and non-numeric input as zero', () => {
      expect(amountToWords(-50)).toBe('Zero and 00/100');
      expect(amountToWords('abc')).toBe('Zero and 00/100');
    });
  });

  describe('buildReceiptHtml', () => {
    it('shows the receipt, invoice, amount and settlement type for an Advance receipt', () => {
      const html = buildReceiptHtml({
        id: 'REC-ADV-0001', invoiceId: 'INV-ADV-0001', type: 'Advance',
        customerName: 'Nimal', amountReceived: 75000, paymentMethod: 'Bank Transfer',
      });
      expect(html).toContain('REC-ADV-0001');
      expect(html).toContain('Against Invoice: INV-ADV-0001');
      expect(html).toContain('75% Advance Payment');
      expect(html).toContain('Bank Transfer');
      expect(html).toContain('Seventy Five Thousand and 00/100 Rupees');
    });

    it('labels a Final receipt as 25% and defaults the method to Cash', () => {
      const html = buildReceiptHtml({ id: 'REC-FIN-0001', invoiceId: 'INV-FIN-0001', type: 'Final', amountReceived: 25000 });
      expect(html).toContain('25% Final Settlement');
      expect(html).toContain('<td>Cash</td>');
    });

    it('renders notes only when present and tolerates a missing receipt', () => {
      expect(buildReceiptHtml({ id: 'R', notes: 'Paid at gate' })).toContain('Paid at gate');
      expect(buildReceiptHtml({ id: 'R' })).not.toContain('<td>Notes</td>');
      expect(buildReceiptHtml(null)).toContain('DRAFT-RECEIPT');
    });
  });
});
