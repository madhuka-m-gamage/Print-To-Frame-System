import { describe, it, expect } from 'vitest';
import { getLineageIds, invoicesForLineage, logisticsJobForLineage, lineageIdsForLeadId } from '@/features/leads/leadLineage';

describe('lead lineage', () => {
  it('lists a record id, its original lead and its converted deal, skipping blanks', () => {
    expect(getLineageIds({ id: 'D-1', originalLeadId: 'L-1' })).toEqual(['D-1', 'L-1']);
    expect(getLineageIds({ id: 'L-1', convertedDealId: 'D-1' })).toEqual(['L-1', 'D-1']);
    expect(getLineageIds({ id: 'L-1' })).toEqual(['L-1']);
    expect(getLineageIds(undefined)).toEqual([]);
  });

  it('finds invoices keyed by either the deal id or the original lead id', () => {
    const deal = { id: 'D-1', originalLeadId: 'L-1' };
    const invoices = [
      { id: 'INV-ADV-1', leadId: 'L-1' },
      { id: 'INV-FIN-1', leadId: 'D-1' },
      { id: 'INV-X', leadId: 'L-9' },
      { id: 'INV-Y' },
    ];
    expect(invoicesForLineage(deal, invoices).map((i) => i.id)).toEqual(['INV-ADV-1', 'INV-FIN-1']);
  });
});

describe('lineage lookups for logistics and invoice references', () => {
  it('finds a logistics job keyed by the converted deal id or the original lead id', () => {
    const jobs = [{ id: 'L-DL-1', leadId: 'L-9' }, { id: 'L-DL-2', leadId: 'D-1' }];
    expect(logisticsJobForLineage({ id: 'L-1', convertedDealId: 'D-1' }, jobs)?.id).toBe('L-DL-2');
    expect(logisticsJobForLineage({ id: 'D-2', originalLeadId: 'L-9' }, jobs)?.id).toBe('L-DL-1');
    expect(logisticsJobForLineage({ id: 'L-3' }, jobs)).toBeNull();
    expect(logisticsJobForLineage({ id: 'L-3' }, undefined)).toBeNull();
  });

  it('resolves an invoice leadId to the whole lineage, preferring the deal record', () => {
    const leads = [
      { id: 'L-1', convertedDealId: 'D-1' },
      { id: 'D-1', isDeal: true, originalLeadId: 'L-1' },
    ];
    expect(lineageIdsForLeadId('L-1', leads)).toEqual(['D-1', 'L-1']);
    expect(lineageIdsForLeadId('D-1', leads)).toEqual(['D-1', 'L-1']);
    expect(lineageIdsForLeadId('L-7', leads)).toEqual(['L-7']);
    expect(lineageIdsForLeadId('L-7')).toEqual(['L-7']);
  });
});
