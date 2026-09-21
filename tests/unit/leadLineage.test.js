import { describe, it, expect } from 'vitest';
import { getLineageIds, invoicesForLineage } from '@/utils/leadLineage';

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
