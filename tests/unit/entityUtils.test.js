import { describe, it, expect } from 'vitest';
import { getEntityIdSet, matchesEntity } from '../../src/utils/entityUtils';

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
});
