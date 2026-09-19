/**
 * Logistics Utility Engine for Print To Frame ERP
 *
 * Provides helpers for mobile navigation, WhatsApp dispatch generation,
 * fleet vehicle management, and invoice COD balance calculations.
 */

import { matchesEntity } from './entityUtils';
import { toDateObj } from './dateUtils';

export const FLEET_VEHICLES = [
  { id: 'lorry_ge1234', name: 'Lorry (WP GE 1234)', type: 'Lorry', capacity: '14.5ft Bed' },
  { id: 'van_lh5678', name: 'Van (WP LH 5678)', type: 'Van', capacity: 'High-Roof Cargo' },
  { id: 'bike_xz9012', name: 'Motorbike (WP XZ 9012)', type: 'Motorbike', capacity: 'Document / Sample' },
];

export const DRIVER_DIRECTORY = [
  { name: 'Saman (Master Welder)', phone: '0771234567', role: 'Lead Driver / Fabricator' },
  { name: 'Kamal (Assistant)', phone: '0772345678', role: 'Driver Assistant' },
  { name: 'Sunil (Driver)', phone: '0773456789', role: 'Primary Fleet Driver' },
  { name: 'Nimal (Driver)', phone: '0774567890', role: 'Delivery Associate' },
];

/**
 * Generate a Google Maps turn-by-turn or search navigation URL.
 * @param {string} location Destination address or coordinates
 * @returns {string} Google Maps URL
 */
export function getGoogleMapsUrl(location) {
  if (!location || !location.trim()) return '';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.trim())}`;
}

/**
 * Format a phone number for direct tel: or WhatsApp wa.me links.
 * Normalizes Sri Lankan numbers (e.g. 077XXXXXXX -> 9477XXXXXXX).
 * @param {string} phone 
 * @returns {string} Clean digits
 */
export function cleanPhoneNumber(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/[^0-9]/g, '');
  if (digits.startsWith('0') && digits.length === 10) {
    return '94' + digits.slice(1);
  }
  return digits;
}

/**
 * Generate a direct WhatsApp messaging URL.
 * @param {string} phone Recipient phone
 * @param {string} message URL-encoded message text
 * @returns {string} WhatsApp URL
 */
export function getWhatsAppUrl(phone, message) {
  const cleanPhone = cleanPhoneNumber(phone);
  const encodedText = encodeURIComponent(message || '');
  if (cleanPhone) {
    return `https://wa.me/${cleanPhone}?text=${encodedText}`;
  }
  return `https://wa.me/?text=${encodedText}`;
}

/**
 * Format a polite, professional dispatch alert for clients.
 */
export function formatDispatchMessage({
  customerName = '',
  location = '',
  subType = 'Printed Canvas Frame',
  driverName = '',
  driverPhone = '',
  vehiclePlate = '',
  id = '',
  balanceDue = 0
}) {
  const greeting = customerName ? `Hello ${customerName},` : 'Hello,';
  const itemDesc = subType || 'Print To Frame Order';
  const orderRef = id ? ` (${id})` : '';

  let codNotice = 'Payment Status: Fully Settled';
  if (balanceDue > 0) {
    codNotice = `Payment due upon delivery: LKR ${Number(balanceDue).toLocaleString()} (Cash / Bank Transfer)`;
  }

  let driverInfo = '';
  if (driverName) {
    driverInfo = `\nDriver: ${driverName}${driverPhone ? ` (${driverPhone})` : ''}`;
  }
  if (vehiclePlate) {
    driverInfo += `\nVehicle: ${vehiclePlate}`;
  }

  return (
    `${greeting}\n\n` +
    `Your Print To Frame delivery${orderRef} is on the way!\n` +
    `Item: ${itemDesc}\n` +
    `Destination: ${location || 'Client Location'}` +
    `${driverInfo}\n\n` +
    `${codNotice}\n\n` +
    `Our driver will contact you upon arrival. Thank you for choosing Print To Frame!`
  );
}

/**
 * Search and compute outstanding balance and find allocated invoices linked to a job or customer.
 * Strictly prioritizes linkedJobNo matching so invoices allocated to other jobs are never mixed in.
 *
 * @param {Array} invoices Full list of ERP invoices
 * @param {string} linkedJobNo Associated fabrication or deal jobNo (e.g. PTF-1234)
 * @param {string} customerName Customer or business name
 * @param {Object} [options] Additional context — invoiceId for a direct id
 *   match, and/or entity (or entities: an array) — the job/deal/lead record(s)
 *   this invoice should belong to, matched via matchesEntity/getEntityIdSet
 *   (entityUtils.js) so a Lead-to-Deal id split (originalLeadId/
 *   convertedDealId/dealId, not just leadId) is resolved the same way it is
 *   everywhere else in the app, instead of a narrower ad hoc leadId compare.
 * @returns {{
 *   hasUnpaid: boolean,
 *   totalBalanceDue: number,
 *   matchedInvoices: Array,
 *   advanceInvoice: Object|null,
 *   finalInvoice: Object|null,
 *   primaryInvoice: Object|null
 * }}
 */
export function calculateCODFromInvoices(invoices = [], linkedJobNo = '', customerName = '', options = {}) {
  if (!Array.isArray(invoices) || invoices.length === 0) {
    return {
      hasUnpaid: false,
      totalBalanceDue: 0,
      matchedInvoices: [],
      advanceInvoice: null,
      finalInvoice: null,
      primaryInvoice: null
    };
  }

  const cleanJobNo = String(linkedJobNo || '').trim().toLowerCase();
  const cleanCustName = String(customerName || '').trim().toLowerCase();
  const cleanInvoiceId = String(options.invoiceId || '').trim().toLowerCase();
  const entities = options.entities || (options.entity ? [options.entity] : []);

  // 1. First priority: Direct match on linkedJobNo, invoiceId, or the
  // shared entity-id matcher (covers leadId/dealId/originalLeadId/
  // convertedDealId in one place, exact Set-membership rather than
  // substring containment — two ids that happen to be prefixes of one
  // another, e.g. "PTF-1" and "PTF-11", must never cross-match).
  let matched = [];
  if (cleanJobNo || cleanInvoiceId || entities.length > 0) {
    matched = invoices.filter(inv => {
      const invId = String(inv.id || inv._firestoreId || '').trim().toLowerCase();
      const invJobNo = String(inv.linkedJobNo || inv.jobNo || '').trim().toLowerCase();

      if (cleanInvoiceId && invId === cleanInvoiceId) return true;
      if (cleanJobNo && invJobNo && invJobNo === cleanJobNo) return true;
      if (entities.some(entity => matchesEntity(inv, entity))) return true;
      return false;
    });
  }

  // 2. Second priority: If no direct job match found, match by customer name
  // But do NOT include invoices that explicitly belong to a different jobNo!
  if (matched.length === 0 && cleanCustName) {
    matched = invoices.filter(inv => {
      const invCust = String(inv.customerName || inv.company || '').trim().toLowerCase();
      const invJobNo = String(inv.linkedJobNo || inv.jobNo || '').trim();

      // If this invoice explicitly has another linkedJobNo, do not steal it
      if (cleanJobNo && invJobNo && invJobNo.toLowerCase() !== cleanJobNo) {
        return false;
      }
      return invCust && (invCust === cleanCustName || invCust.includes(cleanCustName) || cleanCustName.includes(invCust));
    });
  }

  // Identify Advance vs Final invoices. More than one of either type can
  // exist for the same job/lead (repeated testing, re-quoting — nothing
  // enforces uniqueness), so pick the most recently created match rather
  // than whichever happens to be first in Firestore's snapshot order —
  // otherwise a driver's COD screen can show a stale, superseded invoice.
  const latestByCreatedAt = (candidates) => candidates.reduce((latest, inv) => {
    if (!latest) return inv;
    const latestTime = toDateObj(latest.createdAt)?.getTime() ?? -Infinity;
    const invTime = toDateObj(inv.createdAt)?.getTime() ?? -Infinity;
    return invTime > latestTime ? inv : latest;
  }, null);
  const advanceInvoice = latestByCreatedAt(matched.filter(inv => inv.type === 'Advance' || String(inv.id || '').includes('INV-ADV')));
  const finalInvoice = latestByCreatedAt(matched.filter(inv => inv.type === 'Final' || String(inv.id || '').includes('INV-FIN')));

  const unpaidInvoices = matched.filter(inv => {
    const status = String(inv.status || 'Unpaid').toLowerCase();
    return status !== 'paid' && status !== 'cancelled' && status !== 'void';
  });

  const totalBalanceDue = unpaidInvoices.reduce((sum, inv) => {
    const val = Number(inv.amount || inv.totalValue || 0);
    return sum + val;
  }, 0);

  // Primary invoice for logistics delivery:
  // Prefer unpaid final settlement invoice (since drivers collect remaining balance at delivery),
  // then any unpaid invoice, then final invoice, then advance invoice, then first matched invoice.
  const primaryInvoice = unpaidInvoices.find(inv => inv.type === 'Final') 
    || unpaidInvoices[0] 
    || finalInvoice 
    || advanceInvoice 
    || (matched.length > 0 ? matched[0] : null);

  return {
    hasUnpaid: totalBalanceDue > 0,
    totalBalanceDue,
    matchedInvoices: matched,
    advanceInvoice,
    finalInvoice,
    primaryInvoice
  };
}

