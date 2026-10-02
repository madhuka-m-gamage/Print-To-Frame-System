import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, where, setDoc } from 'firebase/firestore';
import { setupRulesEnv, clearAll, seedPermissions, asRole } from '../helpers/emulator';

// SEC-8 (partners D-9): a Partner reads only the leads that name its partners record
// (partnerId or agentId equals the record's document id, the record's email being the
// login email) and the invoices whose leadId is one of those leads. Staff reads stay
// on the permission matrix.

let testEnv;

beforeAll(async () => {
  testEnv = await setupRulesEnv();
});

afterAll(async () => {
  await testEnv.cleanup();
});

const seed = (path, id, data) =>
  testEnv.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), path, id), data));

const dbAs = async (role, email) => (await asRole(testEnv, role, email)).firestore();

beforeEach(async () => {
  await clearAll(testEnv);
  await seedPermissions(testEnv);
  await seed('partners', 'P-1', { partnerId: 'P-1', name: 'Own Studio', email: 'own@example.com' });
  await seed('partners', 'P-2', { partnerId: 'P-2', name: 'Other Studio', email: 'other@example.com' });
  await seed('leads', 'L-1', { name: 'Own referral', partnerId: 'P-1', agentId: 'P-1', isDeal: false });
  await seed('leads', 'L-2', { name: 'Own agent pick', agentId: 'P-1', isDeal: false });
  await seed('leads', 'D-1', { name: 'Own deal', partnerId: 'P-1', isDeal: true, originalLeadId: 'L-1' });
  await seed('leads', 'L-9', { name: 'Other referral', partnerId: 'P-2', agentId: 'P-2', isDeal: false });
  await seed('leads', 'L-0', { name: 'Direct', partnerId: '', agentId: 'Direct', isDeal: false });
  await seed('invoices', 'INV-1', { leadId: 'L-1', dealId: 'D-1', amount: 100 });
  await seed('invoices', 'INV-2', { leadId: 'L-2', amount: 50 });
  await seed('invoices', 'INV-9', { leadId: 'L-9', amount: 900 });
  await seed('invoices', 'INV-0', { leadId: 'L-0', amount: 10 });
  await seed('invoices', 'INV-X', { amount: 5 });
});

describe('a Partner reads only its own referred leads (SEC-8)', () => {
  it('reads a lead or deal naming its record by partnerId or agentId', async () => {
    const db = await dbAs('Partner', 'own@example.com');
    for (const id of ['L-1', 'L-2', 'D-1']) await assertSucceeds(getDoc(doc(db, 'leads', id)));
  });

  it("is denied another partner's lead and a Direct lead", async () => {
    const db = await dbAs('Partner', 'own@example.com');
    await assertFails(getDoc(doc(db, 'leads', 'L-9')));
    await assertFails(getDoc(doc(db, 'leads', 'L-0')));
  });

  it('may list its leads with the same constraint the rule checks, but not the whole collection', async () => {
    const db = await dbAs('Partner', 'own@example.com');
    const byPartner = await assertSucceeds(getDocs(query(collection(db, 'leads'), where('partnerId', '==', 'P-1'))));
    const byAgent = await assertSucceeds(getDocs(query(collection(db, 'leads'), where('agentId', '==', 'P-1'))));
    const ids = new Set([...byPartner.docs, ...byAgent.docs].map((d) => d.id));
    expect([...ids].sort()).toEqual(['D-1', 'L-1', 'L-2']);
    await assertFails(getDocs(collection(db, 'leads')));
    await assertFails(getDocs(query(collection(db, 'leads'), where('partnerId', '==', 'P-2'))));
  });

  it('does not let a Partner write a lead it can read', async () => {
    const db = await dbAs('Partner', 'own@example.com');
    await assertFails(setDoc(doc(db, 'leads', 'L-1'), { name: 'Changed', partnerId: 'P-1' }, { merge: true }));
  });
});

describe("a Partner reads only its referred leads' invoices (SEC-8)", () => {
  it('reads an invoice whose lead names its record', async () => {
    const db = await dbAs('Partner', 'own@example.com');
    await assertSucceeds(getDoc(doc(db, 'invoices', 'INV-1')));
    await assertSucceeds(getDoc(doc(db, 'invoices', 'INV-2')));
  });

  it("is denied another partner's invoice, a Direct lead's and an unlinked one", async () => {
    const db = await dbAs('Partner', 'own@example.com');
    for (const id of ['INV-9', 'INV-0', 'INV-X']) await assertFails(getDoc(doc(db, 'invoices', id)));
  });

  it('may list invoices by one of its lead ids, but not the whole collection', async () => {
    const db = await dbAs('Partner', 'own@example.com');
    const snap = await assertSucceeds(getDocs(query(collection(db, 'invoices'), where('leadId', '==', 'L-1'))));
    expect(snap.docs.map((d) => d.id)).toEqual(['INV-1']);
    await assertFails(getDocs(collection(db, 'invoices')));
    await assertFails(getDocs(query(collection(db, 'invoices'), where('leadId', '==', 'L-9'))));
  });

  it('does not let a Partner write an invoice it can read', async () => {
    const db = await dbAs('Partner', 'own@example.com');
    await assertFails(setDoc(doc(db, 'invoices', 'INV-1'), { amount: 1 }, { merge: true }));
  });
});

describe('staff and other roles keep their reads (SEC-8)', () => {
  it('lets Sales read every lead and invoice', async () => {
    const db = await dbAs('Sales', 'sales@example.com');
    await assertSucceeds(getDocs(collection(db, 'leads')));
    await assertSucceeds(getDocs(collection(db, 'invoices')));
  });

  it('keeps leads closed to Operations and a Customer, whatever the lead names', async () => {
    for (const role of ['Operations', 'Customer']) {
      const db = await dbAs(role, `${role.toLowerCase()}@example.com`);
      await assertFails(getDoc(doc(db, 'leads', 'L-1')));
    }
  });

  it('does not open a lead to a non-partner whose email matches no partners record', async () => {
    const db = await dbAs('Partner', 'stranger@example.com');
    await assertFails(getDoc(doc(db, 'leads', 'L-1')));
    await assertFails(getDoc(doc(db, 'invoices', 'INV-1')));
  });
});
