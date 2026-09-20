import { describe, it, expect } from 'vitest';
import { 
  getGoogleMapsUrl, 
  cleanPhoneNumber, 
  getWhatsAppUrl, 
  formatDispatchMessage,
  calculateCODFromInvoices,
  FLEET_VEHICLES,
  DRIVER_DIRECTORY
} from '../../src/utils/logisticsEngine';

describe('logisticsEngine', () => {
  it('generates proper Google Maps navigation URLs', () => {
    expect(getGoogleMapsUrl('')).toBe('');
    expect(getGoogleMapsUrl('Colombo 07')).toBe('https://www.google.com/maps/search/?api=1&query=Colombo%2007');
    expect(getGoogleMapsUrl('Kadawatha Hub, Kandy Road')).toContain('Kadawatha%20Hub');
  });

  it('cleans and normalizes Sri Lankan phone numbers for WhatsApp', () => {
    expect(cleanPhoneNumber('0771234567')).toBe('94771234567');
    expect(cleanPhoneNumber('+94 77 123 4567')).toBe('94771234567');
    expect(cleanPhoneNumber('')).toBe('');
  });

  it('generates valid WhatsApp URLs with encoded messages', () => {
    const url = getWhatsAppUrl('0771234567', 'Hello from Print To Frame');
    expect(url).toContain('https://wa.me/94771234567?text=Hello%20from%20Print%20To%20Frame');
  });

  it('formats dispatch messages with COD balances when unpaid', () => {
    const msg = formatDispatchMessage({
      customerName: 'Naveen Perera',
      location: 'Colombo 03',
      subType: 'Gallery Canvas Frame',
      driverName: 'Sunil',
      driverPhone: '0773456789',
      vehiclePlate: 'WP GE 1234',
      id: 'L-DL-001',
      balanceDue: 25000
    });

    expect(msg).toContain('Naveen Perera');
    expect(msg).toContain('L-DL-001');
    expect(msg).toContain('Sunil');
    expect(msg).toContain('25,000');
  });

  it('calculates COD balance correctly from ERP invoices list', () => {
    const sampleInvoices = [
      { id: 'INV-001', linkedJobNo: 'PTF-1001', customerName: 'Apex Designs', amount: 15000, status: 'Unpaid' },
      { id: 'INV-002', linkedJobNo: 'PTF-1001', customerName: 'Apex Designs', amount: 45000, status: 'Paid' },
      { id: 'INV-003', linkedJobNo: 'PTF-9999', customerName: 'Other Client', amount: 10000, status: 'Unpaid' },
    ];

    const res = calculateCODFromInvoices(sampleInvoices, 'PTF-1001', 'Apex Designs');
    expect(res.hasUnpaid).toBe(true);
    expect(res.totalBalanceDue).toBe(15000);
    expect(res.matchedInvoices.length).toBe(2);
  });

  it('strictly isolates invoices by linkedJobNo to prevent cross-job invoice code leakage', () => {
    const sampleInvoices = [
      { id: 'INV-ADV-0001', linkedJobNo: 'PTF-1001', customerName: 'Apex Designs', amount: 45000, type: 'Advance', status: 'Paid' },
      { id: 'INV-FIN-0001', linkedJobNo: 'PTF-1001', customerName: 'Apex Designs', amount: 15000, type: 'Final', status: 'Unpaid' },
      { id: 'INV-ADV-0002', linkedJobNo: 'PTF-1002', customerName: 'Apex Designs', amount: 60000, type: 'Advance', status: 'Paid' },
      { id: 'INV-FIN-0002', linkedJobNo: 'PTF-1002', customerName: 'Apex Designs', amount: 20000, type: 'Final', status: 'Unpaid' },
    ];

    // When querying for PTF-1002, it should ONLY match PTF-1002 invoices, never PTF-1001!
    const res = calculateCODFromInvoices(sampleInvoices, 'PTF-1002', 'Apex Designs');
    expect(res.hasUnpaid).toBe(true);
    expect(res.totalBalanceDue).toBe(20000);
    expect(res.matchedInvoices.length).toBe(2);
    expect(res.matchedInvoices.map(i => i.id)).toEqual(['INV-ADV-0002', 'INV-FIN-0002']);
    expect(res.advanceInvoice?.id).toBe('INV-ADV-0002');
    expect(res.finalInvoice?.id).toBe('INV-FIN-0002');
    expect(res.primaryInvoice?.id).toBe('INV-FIN-0002');
  });

  it('returns empty matchedInvoices when no invoice is allocated in the database', () => {
    const sampleInvoices = [
      { id: 'INV-FIN-0001', linkedJobNo: 'PTF-1001', customerName: 'Apex Designs', amount: 15000, status: 'Unpaid' }
    ];

    const res = calculateCODFromInvoices(sampleInvoices, 'PTF-9999', 'Nonexistent Client');
    expect(res.hasUnpaid).toBe(false);
    expect(res.totalBalanceDue).toBe(0);
    expect(res.matchedInvoices.length).toBe(0);
    expect(res.primaryInvoice).toBeNull();
  });

  it('provides predefined fleet vehicles and driver directory', () => {
    expect(FLEET_VEHICLES.length).toBeGreaterThanOrEqual(3);
    expect(DRIVER_DIRECTORY.length).toBeGreaterThanOrEqual(4);
  });

  // Regression coverage for the code-review finding: a logistics job whose
  // lead was converted to a Deal can carry the ORIGINAL lead's id while the
  // invoice it should be matched against was created under the Deal's own
  // (different) id — the old leadId-only string compare missed this entirely.
  it('matches an invoice via entity (dealId/originalLeadId), not just leadId, across a Lead-to-Deal id split', () => {
    const sampleInvoices = [
      { id: 'INV-FIN-0009', leadId: 'D-654321', customerName: 'Kasun Silva', amount: 5631, type: 'Final', status: 'Unpaid' },
    ];
    // The job only carries the ORIGINAL lead id (as Deals.jsx's
    // handleCreateDeliveryJob sets it via deal.originalLeadId || deal.id).
    const job = { leadId: 'L-123456', originalLeadId: null };
    // The invoice's real owning record (the Deal) is what actually links
    // job <-> invoice here — simulate passing both as candidate entities.
    const deal = { id: 'D-654321', originalLeadId: 'L-123456' };

    const res = calculateCODFromInvoices(sampleInvoices, '', 'Kasun Silva', { entities: [job, deal] });
    expect(res.hasUnpaid).toBe(true);
    expect(res.matchedInvoices.map(i => i.id)).toEqual(['INV-FIN-0009']);
  });

  it('does not cross-match jobNos that are substrings of one another (e.g. PTF-1 vs PTF-11)', () => {
    const sampleInvoices = [
      { id: 'INV-ADV-0011', linkedJobNo: 'PTF-11', customerName: 'Unrelated Client', amount: 99000, type: 'Advance', status: 'Unpaid' },
    ];

    const res = calculateCODFromInvoices(sampleInvoices, 'PTF-1', 'Some Other Client');
    expect(res.matchedInvoices.length).toBe(0);
    expect(res.hasUnpaid).toBe(false);
  });
  // Flipped in Phase 7 2.3 (invoicing D-2, logistics D-4): only the latest unpaid
  // Final counts, so duplicate Finals no longer double the driver's COD balance.
  it('counts only the latest unpaid Final invoice when a job has duplicates', () => {
    const invoices = [
      { id: 'INV-FIN-0001', linkedJobNo: 'PTF-2001', customerName: 'Apex Designs', amount: 25000, type: 'Final', status: 'Unpaid', createdAt: '2026-01-01T10:00:00Z' },
      { id: 'INV-FIN-0002', linkedJobNo: 'PTF-2001', customerName: 'Apex Designs', amount: 26000, type: 'Final', status: 'Unpaid', createdAt: '2026-01-02T10:00:00Z' },
    ];
    const res = calculateCODFromInvoices(invoices, 'PTF-2001', 'Apex Designs');
    expect(res.totalBalanceDue).toBe(26000);
    expect(res.finalInvoice?.id).toBe('INV-FIN-0002');
    expect(res.finalInvoicePending).toBe(false);
  });

  // Flipped in Phase 7 2.3 (logistics D-4): a paid Advance with no Final yet leaves
  // the 25% balance to collect, flagged as pending Final invoice creation.
  it('reports the 25% balance as pending for a job with only a paid Advance invoice', () => {
    const invoices = [
      { id: 'INV-ADV-0001', linkedJobNo: 'PTF-2002', customerName: 'Apex Designs', amount: 75000, type: 'Advance', status: 'Paid' },
    ];
    const res = calculateCODFromInvoices(invoices, 'PTF-2002', 'Apex Designs');
    expect(res.hasUnpaid).toBe(true);
    expect(res.finalInvoicePending).toBe(true);
    expect(res.totalBalanceDue).toBeCloseTo(25000);
    expect(res.finalInvoice).toBeNull();
  });

  it('uses the Advance invoice totalValue as the contract total when present', () => {
    const invoices = [
      { id: 'INV-ADV-0001', linkedJobNo: 'PTF-2005', amount: 75000, totalValue: 120000, type: 'Advance', status: 'Paid' },
    ];
    expect(calculateCODFromInvoices(invoices, 'PTF-2005', '').totalBalanceDue).toBe(45000);
  });

  it('is settled when the paid Advance already covers the whole contract value', () => {
    const invoices = [
      { id: 'INV-ADV-0001', linkedJobNo: 'PTF-2006', amount: 100000, totalValue: 100000, type: 'Advance', status: 'Paid' },
    ];
    const res = calculateCODFromInvoices(invoices, 'PTF-2006', '');
    expect(res.hasUnpaid).toBe(false);
    expect(res.finalInvoicePending).toBe(false);
  });

  it('does not report a pending Final when an unpaid Advance has no Final yet', () => {
    const invoices = [{ id: 'INV-ADV-0001', linkedJobNo: 'PTF-2007', amount: 75000, type: 'Advance', status: 'Unpaid' }];
    const res = calculateCODFromInvoices(invoices, 'PTF-2007', '');
    expect(res.finalInvoicePending).toBe(false);
    expect(res.totalBalanceDue).toBe(75000);
  });

  it('reports nothing to collect when Advance and Final are both paid', () => {
    const invoices = [
      { id: 'INV-ADV-0001', linkedJobNo: 'PTF-2003', amount: 75000, type: 'Advance', status: 'Paid' },
      { id: 'INV-FIN-0001', linkedJobNo: 'PTF-2003', amount: 25000, type: 'Final', status: 'Paid' },
    ];
    const res = calculateCODFromInvoices(invoices, 'PTF-2003', '');
    expect(res.hasUnpaid).toBe(false);
    expect(res.totalBalanceDue).toBe(0);
  });

  it('ignores cancelled and void invoices when totalling the balance', () => {
    const invoices = [
      { id: 'INV-FIN-0001', linkedJobNo: 'PTF-2004', amount: 25000, type: 'Final', status: 'Cancelled' },
      { id: 'INV-FIN-0002', linkedJobNo: 'PTF-2004', amount: 25000, type: 'Final', status: 'Unpaid', createdAt: '2026-01-02T10:00:00Z' },
    ];
    expect(calculateCODFromInvoices(invoices, 'PTF-2004', '').totalBalanceDue).toBe(25000);
  });
});


describe('getCollectableInvoice (Phase 7 6.5b)', () => {
  it('offers only a genuinely unpaid primary invoice', async () => {
    const { getCollectableInvoice } = await import('../../src/utils/logisticsEngine');
    const unpaid = { id: 'INV-FIN-0001', status: 'Unpaid' };
    expect(getCollectableInvoice({ primaryInvoice: unpaid })).toBe(unpaid);
    expect(getCollectableInvoice({ primaryInvoice: { status: 'Paid' } })).toBeNull();
    expect(getCollectableInvoice({ primaryInvoice: { status: 'Cancelled' } })).toBeNull();
    expect(getCollectableInvoice({ primaryInvoice: { status: 'Void' } })).toBeNull();
  });

  it('offers nothing while the Final invoice does not exist yet, or when there is no invoice', async () => {
    const { getCollectableInvoice } = await import('../../src/utils/logisticsEngine');
    expect(getCollectableInvoice({ primaryInvoice: { status: 'Unpaid' }, finalInvoicePending: true })).toBeNull();
    expect(getCollectableInvoice({})).toBeNull();
    expect(getCollectableInvoice()).toBeNull();
  });
});
