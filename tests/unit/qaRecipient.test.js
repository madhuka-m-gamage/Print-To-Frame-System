import { describe, it, expect } from 'vitest';
import { resolveQaRecipient } from '@/features/fabrication/qaRecipient';

const kasun = { nic: 'AUTO-111111', name: 'Kasun Perera', email: 'Kasun.Perera@Example.com', phone: '0712345678' };
const nimal = { nic: '901234567V', name: 'Nimal Silva', email: 'nimal@example.com', phone: '0779999999' };

describe('resolveQaRecipient', () => {
  it('matches the customer by NIC first', () => {
    expect(resolveQaRecipient({ clientNIC: '901234567V', customerId: 'kasun.perera@example.com' }, [kasun, nimal])).toBe(nimal);
    expect(resolveQaRecipient({ customerNic: '901234567V' }, [kasun, nimal])).toBe(nimal);
  });

  it('resolves a converted job whose AUTO NIC differs from the customer via customerId, case-insensitively', () => {
    const job = { clientNIC: 'AUTO-222222', customerId: 'kasun.perera@example.com' };
    expect(resolveQaRecipient(job, [nimal, kasun])).toBe(kasun);
  });

  it('matches a NIC-style customerId against the customer NIC', () => {
    expect(resolveQaRecipient({ clientNIC: 'AUTO-1', customerId: '901234567V' }, [kasun, nimal])).toBe(nimal);
  });

  it('falls back to the lead id, then the phone', () => {
    const withLead = { ...nimal, leadId: 'L-9' };
    expect(resolveQaRecipient({ leadId: 'L-9' }, [kasun, withLead])).toBe(withLead);
    expect(resolveQaRecipient({ customerPhone: '+94 71 234 5678' }, [nimal, kasun])).toBe(kasun);
  });

  it('returns null when nothing matches', () => {
    expect(resolveQaRecipient({ clientNIC: 'AUTO-3', customerId: 'someone@example.com', customerPhone: '0110000000' }, [kasun, nimal])).toBeNull();
    expect(resolveQaRecipient({ clientNIC: 'AUTO-3' }, undefined)).toBeNull();
    expect(resolveQaRecipient({}, [{ name: 'No keys' }])).toBeNull();
  });
});
