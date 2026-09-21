import { describe, it, expect } from 'vitest';
import { dimensionsFromLead, resolveManualJobLink, NON_BILLABLE } from '@/utils/fabricationLink';

const deal = {
  id: 'D-0001', originalLeadId: 'L-0001', name: 'Client', phone: '+94711111111', company: 'Co', email: 'Client@Example.com',
  pricingMetadata: { dimensions: { length: 4, height: 3 } },
};

describe('dimensionsFromLead', () => {
  it('turns the lead size in feet into frame millimetres and area', () => {
    expect(dimensionsFromLead(deal)).toEqual({ frameWidth: 1219, frameHeight: 914, totalSqFt: 12 });
  });

  it('returns null when the lead was never measured', () => {
    expect(dimensionsFromLead({})).toBeNull();
    expect(dimensionsFromLead({ pricingMetadata: { dimensions: { length: 4, height: 0 } } })).toBeNull();
    expect(dimensionsFromLead(undefined)).toBeNull();
  });
});

describe('resolveManualJobLink', () => {
  it('rejects a job that is neither linked to a deal nor marked non-billable', () => {
    expect(resolveManualJobLink('', [deal]).ok).toBe(false);
    expect(resolveManualJobLink('D-9999', [deal]).ok).toBe(false);
  });

  it('marks non-billable work as internal, with no deal and no price', () => {
    const r = resolveManualJobLink(NON_BILLABLE, [deal]);
    expect(r.ok).toBe(true);
    expect(r.fields).toEqual({ billable: false, origin: 'manual' });
  });

  it('links extra work to a deal, inheriting its customer and its locked size, never a price', () => {
    const r = resolveManualJobLink('D-0001', [deal]);
    expect(r.fields).toMatchObject({
      billable: true, origin: 'manual', dealId: 'D-0001', leadId: 'L-0001', customerName: 'Client',
      customerId: 'client@example.com', frameWidth: 1219, frameHeight: 914, dimensionsLocked: true,
    });
    expect(r.fields).not.toHaveProperty('value');
  });

  it('leaves the size open when the linked deal has none', () => {
    const r = resolveManualJobLink('D-0002', [{ id: 'D-0002', name: 'X' }]);
    expect(r.fields.dimensionsLocked).toBeUndefined();
  });
});
