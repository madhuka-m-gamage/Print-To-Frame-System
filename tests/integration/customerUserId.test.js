import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, where, setDoc, updateDoc } from 'firebase/firestore';
import { setupRulesEnv, clearAll, seedPermissions, seedUser } from '../helpers/emulator';

// FEA-15: a customers row is linked to its login by userId (the Auth uid), so a client
// whose customers.email differs from the login email still reads and updates their own row.

let testEnv;

beforeAll(async () => {
  testEnv = await setupRulesEnv();
});

afterAll(async () => {
  await testEnv.cleanup();
});

const seed = (path, id, data) =>
  testEnv.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), path, id), data));

async function clientDb(uid, email, role = 'Customer') {
  await seedUser(testEnv, email, { identifier: email, name: 'Client', role, isApproved: true, status: 'Active' });
  return testEnv.authenticatedContext(uid, { email }).firestore();
}

beforeEach(async () => {
  await clearAll(testEnv);
  await seedPermissions(testEnv);
  await seed('customers', 'NIC-1', { nic: 'NIC-1', name: 'Nimal', email: 'nimal.office@example.com', userId: 'uid-nimal', orders: 3, totalSpent: 9000 });
  await seed('customers', 'NIC-2', { nic: 'NIC-2', name: 'Other', email: 'other@example.com', userId: 'uid-other' });
  await seed('customers', 'NIC-3', { nic: 'NIC-3', name: 'Email Only', email: 'emailonly@example.com' });
});

describe('a client reaches the customers row linked by userId (FEA-15)', () => {
  it('reads their own row when the row email differs from the login email', async () => {
    const db = await clientDb('uid-nimal', 'nimal@gmail.com');
    await assertSucceeds(getDoc(doc(db, 'customers', 'NIC-1')));
  });

  it('may query by userId, the same constraint the rule checks', async () => {
    const db = await clientDb('uid-nimal', 'nimal@gmail.com', 'Business Client');
    const snap = await assertSucceeds(getDocs(query(collection(db, 'customers'), where('userId', '==', 'uid-nimal'))));
    expect(snap.docs.map((d) => d.id)).toEqual(['NIC-1']);
    await assertFails(getDocs(collection(db, 'customers')));
  });

  it('updates name, photoURL, phone and address on their own row', async () => {
    const db = await clientDb('uid-nimal', 'nimal@gmail.com');
    await assertSucceeds(updateDoc(doc(db, 'customers', 'NIC-1'), { name: 'Nimal P', photoURL: 'p.jpg', phone: '0771234567', address: 'Kandy' }));
  });

  it('may not touch order, financial or link fields on their own row', async () => {
    const db = await clientDb('uid-nimal', 'nimal@gmail.com');
    await assertFails(updateDoc(doc(db, 'customers', 'NIC-1'), { totalSpent: 0 }));
    await assertFails(updateDoc(doc(db, 'customers', 'NIC-1'), { userId: 'uid-someone' }));
    await assertFails(updateDoc(doc(db, 'customers', 'NIC-1'), { email: 'nimal@gmail.com' }));
  });

  it("is denied another uid's row", async () => {
    const db = await clientDb('uid-nimal', 'nimal@gmail.com');
    await assertFails(getDoc(doc(db, 'customers', 'NIC-2')));
    await assertFails(updateDoc(doc(db, 'customers', 'NIC-2'), { name: 'Hijacked' }));
    await assertFails(getDocs(query(collection(db, 'customers'), where('userId', '==', 'uid-other'))));
  });

  it('keeps the email clause for a row with no userId', async () => {
    const db = await clientDb('uid-email', 'emailonly@example.com');
    await assertSucceeds(getDoc(doc(db, 'customers', 'NIC-3')));
    await assertSucceeds(getDocs(query(collection(db, 'customers'), where('email', '==', 'emailonly@example.com'))));
    await assertSucceeds(updateDoc(doc(db, 'customers', 'NIC-3'), { phone: '0712345678' }));
  });
});
