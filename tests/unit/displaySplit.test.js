import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/firebase', () => ({ auth: { currentUser: { getIdToken: async () => 't' } } }));

import { resolveInvoiceForPrint } from '@/features/invoicing/invoicePrintData';
import { buildInvoiceHtml } from '@/features/invoicing/invoiceTemplate';
import { buildSplitTokens } from '@/constants/emailTemplates';
import { generateAdvanceInvoice } from '@/services/gemini';

const fmt = (n) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

describe('MON-9 invoicePrintData draft amount', () => {
  it.each([
    [33333.33, 25000, 8333.33],
    [0, 0, 0],
    [0.01, 0.01, 0],
  ])('draft total %s gives Advance %s and Final %s', (total, adv, fin) => {
    const a = resolveInvoiceForPrint({ type: 'Advance', draftTotal: total });
    const f = resolveInvoiceForPrint({ type: 'Final', draftTotal: total });
    expect(a.amount).toBe(adv);
    expect(f.amount).toBe(fin);
    expect(Math.round((a.amount + f.amount) * 100)).toBe(Math.round(total * 100));
  });
});

describe('MON-9 invoiceTemplate', () => {
  it('Final invoice for 33333.33 shows the rounded Advance paid', () => {
    const html = buildInvoiceHtml({ invoice: { id: 'F', type: 'Final', amount: 8333.33, totalValue: 33333.33 } });
    expect(html).toContain(`LKR ${fmt(25000)}`);
  });

  it('Advance invoice for 33333.33 shows the remainder as Balance', () => {
    const html = buildInvoiceHtml({ invoice: { id: 'A', type: 'Advance', amount: 25000, totalValue: 33333.33 } });
    expect(html).toContain(`LKR ${fmt(8333.33)}`);
  });

  it('Advance invoice for a 0.01 total shows a Balance of 0.00', () => {
    const html = buildInvoiceHtml({ invoice: { id: 'A', type: 'Advance', amount: 0.01, totalValue: 0.01 } });
    expect(html).toContain('LKR 0.00');
  });

  it('per-line rows stay scaled by 0.75 (known cent drift, see BACKLOG MON-9)', () => {
    const html = buildInvoiceHtml({ invoice: { id: 'A', type: 'Advance', amount: 25000, totalValue: 33333.33, lineItems: [{ description: 'X', qty: 1, unitPrice: 33333.33 }] } });
    expect(html).toContain(fmt(33333.33 * 0.75));
  });
});

describe('MON-9 email template tokens', () => {
  it('formats the rounded split', () => {
    expect(buildSplitTokens(33333.33)).toEqual({ advanceAmount: '25,000.00', balanceAmount: '8,333.33' });
    expect(buildSplitTokens(0)).toEqual({ advanceAmount: '0.00', balanceAmount: '0.00' });
    expect(buildSplitTokens(0.01)).toEqual({ advanceAmount: '0.01', balanceAmount: '0.00' });
  });
});

describe('MON-9 Gemini WhatsApp/invoice draft amounts', () => {
  let prompt;
  beforeEach(() => {
    global.fetch = vi.fn(async (_u, opts) => {
      prompt = JSON.parse(opts.body);
      return { ok: true, status: 200, text: async () => JSON.stringify({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }) };
    });
  });

  it.each([
    [33333.33, '25,000', '8,333.33'],
    [0.01, '0.01', '0'],
    [0, '0', '0'],
  ])('total %s uses the rounded split', async (total, adv, bal) => {
    await generateAdvanceInvoice({}, 'scope', total);
    const text = JSON.stringify(prompt);
    expect(text).toContain(`Advance Amount Due Now: LKR ${adv}\\n`);
    expect(text).toContain(`Balance on Delivery: LKR ${bal}\\n`);
  });
});
