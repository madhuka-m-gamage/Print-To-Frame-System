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
});

