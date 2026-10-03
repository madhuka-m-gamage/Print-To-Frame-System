import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
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
