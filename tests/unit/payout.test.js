import { describe, it, expect } from 'vitest';
import { buildPayout, roundCents } from '@/features/partners/payout';

const partner = { partnerId: 'P-1', name: 'Lanka Art Studio', pending: 1000 };
const eligible = (id, amount, extra = {}) => ({
  id, isDeal: true, commState: 'Eligible for Payout', paymentStatus: '100% Fully Settled', calculatedCommAmount: amount, ...extra,
});

describe('buildPayout', () => {
  it('sums the eligible referrals from each calculatedCommAmount', () => {
    const result = buildPayout([eligible('D-1', 380), eligible('D-2', 120.5)], partner);
    expect(result.amount).toBe(500.5);
    expect(result.leadIds).toEqual(['D-1', 'D-2']);
    expect(result.leads.map(l => l.id)).toEqual(['D-1', 'D-2']);
  });

  it('excludes converted lead stubs', () => {
    const result = buildPayout([eligible('L-1', 380, { convertedToDeal: true, isDeal: false }), eligible('D-1', 200)], partner);
    expect(result.leadIds).toEqual(['D-1']);
    expect(result.amount).toBe(200);
  });

  it('counts only fully paid deals', () => {
    const result = buildPayout([
      eligible('D-1', 200),
      { id: 'D-2', isDeal: true, commState: 'Accrued (In Production)', paymentStatus: '75% Advance Paid', calculatedCommAmount: 300 },
      { id: 'D-3', isDeal: true, commState: 'Quoted / Pending Acceptance', paymentStatus: 'Unpaid', calculatedCommAmount: 400 },
      { id: 'D-4', isDeal: true, commState: 'Cancelled', paymentStatus: '100% Fully Settled', calculatedCommAmount: 500 },
    ], partner);
    expect(result.leadIds).toEqual(['D-1']);
    expect(result.amount).toBe(200);
  });

  it('skips referrals already paid out', () => {
    const result = buildPayout([
      eligible('D-1', 200, { payoutStatus: 'Paid' }),
      eligible('D-2', 300, { payoutStatus: 'Settled' }),
      eligible('D-3', 50),
    ], partner);
    expect(result.leadIds).toEqual(['D-3']);
    expect(result.amount).toBe(50);
  });

  it('gives amount 0 and no leads for empty input', () => {
    expect(buildPayout([], partner)).toEqual({ leads: [], amount: 0, leadIds: [] });
    expect(buildPayout(undefined, partner)).toEqual({ leads: [], amount: 0, leadIds: [] });
  });

  it('rounds the total to cents', () => {
    expect(buildPayout([eligible('D-1', 0.1), eligible('D-2', 0.2)], partner).amount).toBe(0.3);
  });

  it('treats a missing calculatedCommAmount as zero', () => {
    expect(buildPayout([eligible('D-1', undefined)], partner)).toEqual({ leads: [expect.objectContaining({ id: 'D-1' })], amount: 0, leadIds: ['D-1'] });
  });
});

describe('roundCents (MON-15)', () => {
  it('rounds to two decimals and removes float drift', () => {
    expect(roundCents(0.1 + 0.2)).toBe(0.3);
    expect(roundCents(30.369)).toBe(30.37);
    expect(roundCents(535)).toBe(535);
  });
});
