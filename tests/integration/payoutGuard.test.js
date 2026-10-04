import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, writeBatch, increment } from 'firebase/firestore';
import { setupRulesEnv, clearAll, seedPermissions, asRole } from '../helpers/emulator';

// MON-11: each paid lead gets a create-only payout_guards/{leadId} document in the
// payout batch, so a second payout of the same referral is refused by the server
// even when two admins start it from stale screens at the same moment.

let testEnv;

beforeAll(async () => {
  testEnv = await setupRulesEnv();
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await clearAll(testEnv);
  await seedPermissions(testEnv);
  await seed('leads', 'D-1', { name: 'Deal Client', partnerId: 'P-1', isDeal: true });
  await seed('leads', 'D-2', { name: 'Second Client', partnerId: 'P-1', isDeal: true });
  await seed('partners', 'P-1', { partnerId: 'P-1', name: 'Lanka Art Studio', pending: 5000, settled: 100 });
});

const dbAs = async (role, email = `${role.toLowerCase().replace(/\s/g, '')}@example.com`) =>
  (await asRole(testEnv, role, email)).firestore();

const seed = (path, id, data) =>
  testEnv.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), path, id), data));

const readRaw = async (path, id) => {
  let data;
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    data = (await getDoc(doc(ctx.firestore(), path, id))).data();
  });
  return data;
};

// The batch handleDisbursePayout commits, each admin working from the same stale
// screen copy (pending 5000, settled 100).
const payoutBatch = (db, payoutId, leadIds) => {
  const batch = writeBatch(db);
  batch.set(doc(db, 'partner_payouts', payoutId), {
    partnerId: 'P-1', partnerEmail: 'own@example.com', partnerName: 'Lanka Art Studio', amount: 300 * leadIds.length,
    reference: `TXN-${payoutId}`, leadIds, createdAt: '2026-10-03T00:00:00.000Z', createdBy: 'admin@example.com',
  });
  for (const id of leadIds) {
    batch.set(doc(db, 'payout_guards', id), { payoutId, partnerId: 'P-1', reference: `TXN-${payoutId}`, createdAt: '2026-10-03T00:00:00.000Z' });
    batch.update(doc(db, 'leads', id), { payoutStatus: 'Paid', payoutReference: `TXN-${payoutId}` });
  }
  batch.update(doc(db, 'partners', 'P-1'), { pending: 5000 - 300 * leadIds.length, settled: 100 + 300 * leadIds.length });
  return batch.commit();
};

describe('payout_guards (MON-11)', () => {
  it('refuses a second payout of the same referral, so the balance drops only once', async () => {
    const first = await dbAs('Admin', 'madhukagamage6@gmail.com');
    const second = await dbAs('Admin', 'admin@example.com');

    await assertSucceeds(payoutBatch(first, 'P-1-1', ['D-1']));
    await seed('partners', 'P-1', { partnerId: 'P-1', name: 'Lanka Art Studio', pending: 4700, settled: 400 });
    await assertFails(payoutBatch(second, 'P-1-2', ['D-1']));

    expect(await readRaw('partner_payouts', 'P-1-2')).toBeUndefined();
    expect(await readRaw('leads', 'D-1')).toMatchObject({ payoutReference: 'TXN-P-1-1' });
    expect(await readRaw('partners', 'P-1')).toMatchObject({ pending: 4700, settled: 400 });
    expect(await readRaw('payout_guards', 'D-1')).toMatchObject({ payoutId: 'P-1-1' });
  });

  it('refuses a payout that overlaps an earlier one by a single referral', async () => {
    const db = await dbAs('Admin');
    await assertSucceeds(payoutBatch(db, 'P-1-1', ['D-1']));
    await assertFails(payoutBatch(db, 'P-1-2', ['D-1', 'D-2']));
    expect(await readRaw('leads', 'D-2')).not.toHaveProperty('payoutStatus');
    expect(await readRaw('payout_guards', 'D-2')).toBeUndefined();
  });

  it('allows a later payout of different referrals', async () => {
    const db = await dbAs('Admin');
    await assertSucceeds(payoutBatch(db, 'P-1-1', ['D-1']));
    await assertSucceeds(payoutBatch(db, 'P-1-2', ['D-2']));
  });

  it('refuses a guard that is not written with its payout record', async () => {
    const db = await dbAs('Admin');
    await assertFails(setDoc(doc(db, 'payout_guards', 'D-1'), { payoutId: 'missing', partnerId: 'P-1', reference: 'TXN-1', createdAt: 'x' }));
  });

  it('never lets a guard be changed or removed, even by an Admin', async () => {
    const db = await dbAs('Admin');
    await assertSucceeds(payoutBatch(db, 'P-1-1', ['D-1']));
    await assertFails(updateDoc(doc(db, 'payout_guards', 'D-1'), { payoutId: 'P-1-2' }));
    await assertFails(deleteDoc(doc(db, 'payout_guards', 'D-1')));
  });

  it.each(['Manager', 'Accounts', 'Partner', 'Customer'])('refuses a %s writing a guard', async (role) => {
    const db = await dbAs(role);
    await assertFails(payoutBatch(db, 'P-1-1', ['D-1']));
    expect(await readRaw('payout_guards', 'D-1')).toBeUndefined();
  });

  it('lets staff with partners view read guards, but not a Partner', async () => {
    await seed('payout_guards', 'D-1', { payoutId: 'P-1-1', partnerId: 'P-1' });
    await assertSucceeds(getDoc(doc(await dbAs('Admin'), 'payout_guards', 'D-1')));
    await assertFails(getDoc(doc(await dbAs('Partner', 'own@example.com'), 'payout_guards', 'D-1')));
  });
});

// MON-14: the batch moves the balance by the payout amount with increment(), so two
// admins paying out different referrals from the same stale screen both count.
const incrementBatch = (db, payoutId, leadId, amount) => {
  const batch = writeBatch(db);
  batch.set(doc(db, 'partner_payouts', payoutId), {
    partnerId: 'P-1', partnerEmail: 'own@example.com', partnerName: 'Lanka Art Studio', amount,
    reference: `TXN-${payoutId}`, leadIds: [leadId], createdAt: '2026-10-03T00:00:00.000Z', createdBy: 'admin@example.com',
  });
  batch.set(doc(db, 'payout_guards', leadId), { payoutId, partnerId: 'P-1', reference: `TXN-${payoutId}`, createdAt: '2026-10-03T00:00:00.000Z' });
  batch.update(doc(db, 'leads', leadId), { payoutStatus: 'Paid', payoutReference: `TXN-${payoutId}` });
  batch.update(doc(db, 'partners', 'P-1'), { pending: increment(-amount), settled: increment(amount) });
  return batch.commit();
};

describe('partner balance increments (MON-14)', () => {
  it.each([
    ['first admin first', [['P-1-1', 'D-1', 300], ['P-1-2', 'D-2', 450]]],
    ['second admin first', [['P-1-2', 'D-2', 450], ['P-1-1', 'D-1', 300]]],
  ])('keeps both payouts of different referrals in the balance (%s)', async (_label, order) => {
    const dbs = [await dbAs('Admin', 'madhukagamage6@gmail.com'), await dbAs('Admin', 'admin@example.com')];
    for (const [i, [payoutId, leadId, amount]] of order.entries()) {
      await assertSucceeds(incrementBatch(dbs[i], payoutId, leadId, amount));
    }
    expect(await readRaw('partners', 'P-1')).toMatchObject({ pending: 4250, settled: 850 });
  });

  it('still refuses a second payout of the same referral, so the balance moves once', async () => {
    const db = await dbAs('Admin');
    await assertSucceeds(incrementBatch(db, 'P-1-1', 'D-1', 300));
    await assertFails(incrementBatch(db, 'P-1-2', 'D-1', 300));
    expect(await readRaw('partners', 'P-1')).toMatchObject({ pending: 4700, settled: 400 });
  });

  it('never lets a Partner move its own balances, by increment or by value', async () => {
    await seed('partners', 'P-1', { partnerId: 'P-1', email: 'own@example.com', name: 'Lanka Art Studio', pending: 5000, settled: 100 });
    const db = await dbAs('Partner', 'own@example.com');
    await assertFails(updateDoc(doc(db, 'partners', 'P-1'), { pending: increment(1000) }));
    await assertFails(updateDoc(doc(db, 'partners', 'P-1'), { settled: increment(-100) }));
    await assertFails(updateDoc(doc(db, 'partners', 'P-1'), { pending: 9999 }));
    expect(await readRaw('partners', 'P-1')).toMatchObject({ pending: 5000, settled: 100 });
  });
});

// MON-15: increments do not clamp, so the rules refuse any partners write that
// changes pending and leaves it below 0. A doc that is already negative can still
// take unrelated edits.
describe('pending overdraw guard (MON-15)', () => {
  beforeEach(async () => {
    await seed('partners', 'P-1', { partnerId: 'P-1', name: 'Lanka Art Studio', pending: 250, settled: 100 });
  });

  it('refuses a payout batch that would leave pending below 0', async () => {
    const db = await dbAs('Admin');
    await assertFails(incrementBatch(db, 'P-1-1', 'D-1', 300));
    expect(await readRaw('partners', 'P-1')).toMatchObject({ pending: 250, settled: 100 });
    expect(await readRaw('partner_payouts', 'P-1-1')).toBeUndefined();
    expect(await readRaw('leads', 'D-1')).not.toHaveProperty('payoutStatus');
  });

  it('allows a payout that takes pending exactly to 0', async () => {
    const db = await dbAs('Admin');
    await assertSucceeds(incrementBatch(db, 'P-1-1', 'D-1', 250));
    expect(await readRaw('partners', 'P-1')).toMatchObject({ pending: 0, settled: 350 });
  });

  it('refuses a staff edit that sets pending below 0', async () => {
    const db = await dbAs('Manager');
    await assertFails(updateDoc(doc(db, 'partners', 'P-1'), { pending: -1 }));
  });

  it('allows a staff edit that does not touch pending on a doc already below 0', async () => {
    await seed('partners', 'P-1', { partnerId: 'P-1', name: 'Lanka Art Studio', pending: -50, settled: 100 });
    const db = await dbAs('Manager');
    await assertSucceeds(updateDoc(doc(db, 'partners', 'P-1'), { name: 'Lanka Art Studio (Pvt) Ltd' }));
  });
});
