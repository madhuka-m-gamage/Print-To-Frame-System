import { describe, it, expect } from 'vitest';
import { getEntityIdSet, matchesEntity, getExistingFinalInvoice } from '@/shared/utils/entityUtils';

describe('entityUtils', () => {
  describe('getEntityIdSet', () => {
    it('returns empty set for null / undefined', () => {
      expect(getEntityIdSet(null).size).toBe(0);
      expect(getEntityIdSet(undefined).size).toBe(0);
    });

    it('extracts string ID directly', () => {
      const set = getEntityIdSet('L-1001');
      expect(set.has('L-1001')).toBe(true);
      expect(set.size).toBe(1);
    });

    it('extracts multiple aliases from an entity object', () => {
      const entity = {
        id: 'D-2001',
        _firestoreId: 'doc_123',
        originalLeadId: 'L-1001',
        dealId: 'D-2001',
        leadId: 'L-1001',
        name: 'Kasun'
      };
      const set = getEntityIdSet(entity);
      expect(set.has('D-2001')).toBe(true);
      expect(set.has('doc_123')).toBe(true);
      expect(set.has('L-1001')).toBe(true);
    });
  });

  describe('matchesEntity', () => {
    it('matches child record via direct ID match', () => {
      const quote = { id: 'Q-1', leadId: 'L-1001' };
      const lead = { id: 'L-1001' };
      expect(matchesEntity(quote, lead)).toBe(true);
    });

    it('matches child record created under original lead when matched against converted deal', () => {
      const quote = { id: 'Q-1', leadId: 'L-1001' };
      const deal = { id: 'D-2001', originalLeadId: 'L-1001' };
      expect(matchesEntity(quote, deal)).toBe(true);
    });

    it('matches logistics job created with dealId against lead with firestoreId', () => {
      const job = { id: 'J-1', dealId: 'doc_abc' };
      const lead = { id: 'L-1001', _firestoreId: 'doc_abc' };
      expect(matchesEntity(job, lead)).toBe(true);
    });

    it('returns false when no identity alias matches', () => {
      const invoice = { id: 'INV-1', leadId: 'L-9999' };
      const deal = { id: 'D-2001', originalLeadId: 'L-1001' };
      expect(matchesEntity(invoice, deal)).toBe(false);
    });

    it('handles falsy or empty inputs gracefully', () => {
      expect(matchesEntity(null, { id: '123' })).toBe(false);
      expect(matchesEntity({ id: '123' }, null)).toBe(false);
      expect(matchesEntity({}, {})).toBe(false);
    });
  });

  describe('getExistingFinalInvoice', () => {
    const deal = { id: 'D-1', originalLeadId: 'L-1', jobNo: 'PTF-1' };

    it('returns null for no invoices or no entity', () => {
      expect(getExistingFinalInvoice([], deal)).toBeNull();
      expect(getExistingFinalInvoice(undefined, deal)).toBeNull();
      expect(getExistingFinalInvoice([{ id: 'INV-FIN-1', type: 'Final', dealId: 'D-1' }], null)).toBeNull();
    });

    it('finds a Final invoice through each id alias', () => {
      for (const alias of [{ dealId: 'D-1' }, { leadId: 'D-1' }, { originalLeadId: 'L-1' }, { leadId: 'L-1' }]) {
        const inv = { id: 'INV-FIN-0001', type: 'Final', ...alias };
        expect(getExistingFinalInvoice([inv], deal)).toBe(inv);
      }
    });

    it('finds a Final invoice by jobNo or linkedJobNo, which matchesEntity ignores', () => {
      const byJob = { id: 'INV-FIN-0002', type: 'Final', jobNo: 'PTF-1' };
      const byLinked = { id: 'INV-FIN-0003', type: 'Final', linkedJobNo: 'PTF-1' };
      expect(getExistingFinalInvoice([byJob], deal)).toBe(byJob);
      expect(getExistingFinalInvoice([byLinked], deal)).toBe(byLinked);
    });

    it('recognises a Final by its INV-FIN id when type is missing, and ignores Advance invoices', () => {
      const legacy = { id: 'INV-FIN-0004', dealId: 'D-1' };
      const advance = { id: 'INV-ADV-0001', type: 'Advance', dealId: 'D-1' };
      expect(getExistingFinalInvoice([advance], deal)).toBeNull();
      expect(getExistingFinalInvoice([advance, legacy], deal)).toBe(legacy);
    });

    it('ignores cancelled and void Final invoices and other jobs', () => {
      const cancelled = { id: 'INV-FIN-0005', type: 'Final', dealId: 'D-1', status: 'Cancelled' };
      const voided = { id: 'INV-FIN-0006', type: 'Final', dealId: 'D-1', status: 'void' };
      const other = { id: 'INV-FIN-0007', type: 'Final', dealId: 'D-2', jobNo: 'PTF-2' };
      expect(getExistingFinalInvoice([cancelled, voided, other], deal)).toBeNull();
    });

    it('accepts several entities, so a lead and its deal can be checked together', () => {
      const inv = { id: 'INV-FIN-0008', type: 'Final', dealId: 'D-9' };
      expect(getExistingFinalInvoice([inv], [{ id: 'L-9' }, { id: 'D-9' }])).toBe(inv);
    });
  });
});
