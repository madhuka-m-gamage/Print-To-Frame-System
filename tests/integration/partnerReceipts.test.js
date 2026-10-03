import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, where, setDoc } from 'firebase/firestore';
import { setupRulesEnv, clearAll, seedPermissions, asRole } from '../helpers/emulator';

// SEC-14: a receipt copies leadId from its invoice (handleGenerateReceipt), so a Partner
// reads the receipts of its own referred leads through the same lead check as SEC-8
// invoices. The old `partnerId == token email` clause is gone from invoices and receipts:
// partnerId holds a partner code, never an email.

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
  await seed('leads', 'L-9', { name: 'Other referral', partnerId: 'P-2', agentId: 'P-2', isDeal: false });
  await seed('receipts', 'REC-1', { invoiceId: 'INV-1', leadId: 'L-1', partnerId: 'P-1', amountReceived: 100 });
  await seed('receipts', 'REC-2', { invoiceId: 'INV-2', leadId: 'L-2', amountReceived: 50 });
  await seed('receipts', 'REC-9', { invoiceId: 'INV-9', leadId: 'L-9', partnerId: 'P-2', amountReceived: 900 });
  await seed('receipts', 'REC-X', { invoiceId: 'INV-X', amountReceived: 5 });
  await seed('receipts', 'REC-E', { invoiceId: 'INV-E', partnerId: 'own@example.com', amountReceived: 7 });
  await seed('invoices', 'INV-E', { partnerId: 'own@example.com', amount: 7 });
});

describe("a Partner reads its referred leads' receipts (SEC-14)", () => {
  it('reads a receipt whose lead names its record', async () => {
    const db = await dbAs('Partner', 'own@example.com');
    await assertSucceeds(getDoc(doc(db, 'receipts', 'REC-1')));
    await assertSucceeds(getDoc(doc(db, 'receipts', 'REC-2')));
  });

  it("is denied another partner's receipt and an unlinked one", async () => {
    const db = await dbAs('Partner', 'own@example.com');
    await assertFails(getDoc(doc(db, 'receipts', 'REC-9')));
    await assertFails(getDoc(doc(db, 'receipts', 'REC-X')));
  });

  it('may list receipts by one of its lead ids, but not the whole collection', async () => {
    const db = await dbAs('Partner', 'own@example.com');
    const snap = await assertSucceeds(getDocs(query(collection(db, 'receipts'), where('leadId', '==', 'L-1'))));
    expect(snap.docs.map((d) => d.id)).toEqual(['REC-1']);
    await assertFails(getDocs(collection(db, 'receipts')));
    await assertFails(getDocs(query(collection(db, 'receipts'), where('leadId', '==', 'L-9'))));
  });

  it('does not let a Partner write a receipt it can read', async () => {
    const db = await dbAs('Partner', 'own@example.com');
    await assertFails(setDoc(doc(db, 'receipts', 'REC-1'), { amountReceived: 1 }, { merge: true }));
  });
});

describe('partnerId equal to the caller email grants nothing (SEC-14)', () => {
  it('denies a Partner a receipt and an invoice whose partnerId is its email', async () => {
    const db = await dbAs('Partner', 'own@example.com');
    await assertFails(getDoc(doc(db, 'receipts', 'REC-E')));
    await assertFails(getDoc(doc(db, 'invoices', 'INV-E')));
  });

  it('denies Operations a receipt whose partnerId is its email', async () => {
    await seed('receipts', 'REC-O', { invoiceId: 'INV-O', partnerId: 'operations@example.com', amountReceived: 3 });
    const db = await dbAs('Operations', 'operations@example.com');
    await assertFails(getDoc(doc(db, 'receipts', 'REC-O')));
  });
});

describe('staff receipt reads are unchanged (SEC-14)', () => {
  it('lets Sales and Support read every receipt', async () => {
    for (const role of ['Sales', 'Support']) {
      const db = await dbAs(role, `${role.toLowerCase()}@example.com`);
      await assertSucceeds(getDocs(collection(db, 'receipts')));
    }
  });

  it('keeps receipts closed to Operations and Logistics', async () => {
    for (const role of ['Operations', 'Logistics']) {
      const db = await dbAs(role, `${role.toLowerCase()}@example.com`);
      await assertFails(getDoc(doc(db, 'receipts', 'REC-1')));
    }
  });
});
