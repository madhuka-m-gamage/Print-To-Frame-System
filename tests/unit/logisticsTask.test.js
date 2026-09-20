import { describe, it, expect } from 'vitest';
import { buildLogisticsTask, deliveryStatusForTask } from '../../src/utils/logisticsTask';

describe('buildLogisticsTask', () => {
  const task = buildLogisticsTask({
    id: 'L-DL-0001', type: 'Delivery', subType: 'Finished Steel Frame', location: 'Colombo 07', customer: 'Client',
    customerPhone: '+94711111111', linkedJobNo: 'PTF-0001', dealId: 'D-0001', leadId: 'L-0001',
  });

  it('carries the fields every screen relies on', () => {
    expect(task).toMatchObject({
      id: 'L-DL-0001', status: 'Pending', priority: 'Standard', customerPhone: '+94711111111',
      linkedJobNo: 'PTF-0001', dealId: 'D-0001', leadId: 'L-0001', notified: false, driver: '', vehicle: '',
    });
    expect(Number.isNaN(Date.parse(task.createdAt))).toBe(false);
  });

  it('never leaves customerPhone or the links undefined', () => {
    const bare = buildLogisticsTask({ id: 'L-PK-0001', type: 'Pickup', subType: 'Material/Flex', location: 'X', customer: 'Y' });
    expect(bare.customerPhone).toBe('');
    expect(bare.linkedJobNo).toBe('');
    expect(bare.dealId).toBe('');
    expect(bare).not.toHaveProperty('phone');
  });
});

describe('deliveryStatusForTask', () => {
  it('reports on-the-road and delivered for delivery tasks, and clears otherwise', () => {
    expect(deliveryStatusForTask({ type: 'Delivery' }, 'In Transit')).toBe('in_transit');
    expect(deliveryStatusForTask({ type: 'Delivery' }, 'Completed')).toBe('delivered');
    expect(deliveryStatusForTask({ type: 'Delivery' }, 'Pending')).toBeNull();
  });

  it('ignores pickup tasks', () => {
    expect(deliveryStatusForTask({ type: 'Pickup' }, 'Completed')).toBeUndefined();
  });
});
