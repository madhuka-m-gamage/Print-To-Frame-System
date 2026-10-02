import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, where, setDoc, writeBatch } from 'firebase/firestore';
import { setupRulesEnv, clearAll, seedPermissions, asRole, unauthedFirestore } from '../helpers/emulator';

// FEA-1 (partners D-1): Disburse Payout commits one batch of a partner_payouts
// create, a payoutStatus update per lead and a partner balance update.
// partner_payouts is Admin-written; a partner reads only its own payouts.

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

const payout = (partnerEmail = 'own@example.com') => ({
  partnerId: 'P-1', partnerEmail, partnerName: 'Lanka Art Studio', amount: 300, reference: 'TXN-123456', leadIds: ['D-1'],
  createdAt: '2026-10-02T00:00:00.000Z', createdBy: 'admin@example.com',
});

const payoutBatch = (db) => {
  const batch = writeBatch(db);
  batch.set(doc(db, 'partner_payouts', 'P-1-1'), payout());
  batch.update(doc(db, 'leads', 'D-1'), { payoutStatus: 'Paid', payoutReference: 'TXN-123456' });
  batch.update(doc(db, 'partners', 'P-1'), { pending: 4700, settled: 400 });
  return batch.commit();
};

describe('partner_payouts rules (FEA-1)', () => {
  beforeEach(async () => {
    await seed('leads', 'D-1', { name: 'Deal Client', partnerId: 'P-1', isDeal: true });
    await seed('partners', 'P-1', { partnerId: 'P-1', name: 'Lanka Art Studio', pending: 5000, settled: 100 });
  });

  it('lets an Admin commit the whole payout batch', async () => {
    await assertSucceeds(payoutBatch(await dbAs('Admin')));
    expect(await readRaw('partner_payouts', 'P-1-1')).toMatchObject({ amount: 300, reference: 'TXN-123456' });
    expect(await readRaw('leads', 'D-1')).toMatchObject({ payoutStatus: 'Paid' });
    expect(await readRaw('partners', 'P-1')).toMatchObject({ pending: 4700, settled: 400 });
  });

  it.each(['Manager', 'Sales', 'Accounts', 'Support', 'Operations', 'Logistics', 'Partner', 'Customer', 'Business Client'])(
    'rejects a %s writing partner_payouts, and the whole batch with it',
    async (role) => {
      const db = await dbAs(role);
      await assertFails(setDoc(doc(db, 'partner_payouts', 'x'), payout()));
      await assertFails(payoutBatch(db));
      expect(await readRaw('partner_payouts', 'P-1-1')).toBeUndefined();
      expect(await readRaw('leads', 'D-1')).not.toHaveProperty('payoutStatus');
      expect(await readRaw('partners', 'P-1')).toMatchObject({ pending: 5000, settled: 100 });
    }
  );

  it('rejects a signed-out write', async () => {
    await assertFails(setDoc(doc(unauthedFirestore(testEnv), 'partner_payouts', 'x'), payout()));
  });

  it('lets a partner read only its own payouts', async () => {
    await seed('partner_payouts', 'mine', payout('own@example.com'));
    await seed('partner_payouts', 'theirs', payout('other@example.com'));
    const partner = await dbAs('Partner', 'own@example.com');

    await assertSucceeds(getDoc(doc(partner, 'partner_payouts', 'mine')));
    await assertFails(getDoc(doc(partner, 'partner_payouts', 'theirs')));
    const own = await assertSucceeds(getDocs(query(collection(partner, 'partner_payouts'), where('partnerEmail', '==', 'own@example.com'))));
    expect(own.docs.map(d => d.id)).toEqual(['mine']);
    await assertFails(getDocs(collection(partner, 'partner_payouts')));
    await assertFails(getDoc(doc(unauthedFirestore(testEnv), 'partner_payouts', 'mine')));
  });
});
