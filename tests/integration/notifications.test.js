import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, where, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { setupRulesEnv, clearAll, seedPermissions, asRole, unauthedFirestore } from '../helpers/emulator';

// FEA-2 (notifications NOTIF-04, partners D-11): a persisted notification is read by the
// addressed recipientEmail or an Admin, created by staff with invoices edit, and the
// recipient may flip only the read flag.

let testEnv;

beforeAll(async () => {
  testEnv = await setupRulesEnv();
});

afterAll(async () => {
  await testEnv.cleanup();
});

const notif = (recipientEmail = 'own@example.com') => ({
  recipientEmail, targetRole: 'Partner', type: 'commission', title: 'Commission Eligible', message: 'Cleared',
  leadId: 'D-1', read: false, createdAt: '2026-10-03T00:00:00.000Z', createdBy: 'sales@example.com',
});

beforeEach(async () => {
  await clearAll(testEnv);
  await seedPermissions(testEnv);
  await testEnv.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'notifications', 'N-1'), notif()));
});

const dbAs = async (role, email = `${role.toLowerCase().replace(/\s/g, '')}@example.com`) =>
  (await asRole(testEnv, role, email)).firestore();

describe('notifications rules (FEA-2)', () => {
  it('lets the addressed recipient read it, by id and by a recipientEmail query', async () => {
    const db = await dbAs('Partner', 'own@example.com');
    await assertSucceeds(getDoc(doc(db, 'notifications', 'N-1')));
    await assertSucceeds(getDocs(query(collection(db, 'notifications'), where('recipientEmail', '==', 'own@example.com'))));
  });

  it('lets an Admin read any notification', async () => {
    await assertSucceeds(getDoc(doc(await dbAs('Admin'), 'notifications', 'N-1')));
  });

  it.each(['Manager', 'Sales', 'Accounts', 'Support', 'Operations', 'Logistics', 'Customer', 'Business Client'])(
    'rejects a %s who is not the recipient reading it',
    async (role) => {
      await assertFails(getDoc(doc(await dbAs(role), 'notifications', 'N-1')));
    }
  );

  it('rejects another Partner reading it, and a query for someone else address', async () => {
    const db = await dbAs('Partner', 'other@example.com');
    await assertFails(getDoc(doc(db, 'notifications', 'N-1')));
    await assertFails(getDocs(query(collection(db, 'notifications'), where('recipientEmail', '==', 'own@example.com'))));
  });

  it('rejects a signed-out read', async () => {
    await assertFails(getDoc(doc(unauthedFirestore(testEnv), 'notifications', 'N-1')));
  });

  it.each(['Admin', 'Manager', 'Sales', 'Accounts'])('lets %s (invoices edit) create a notification', async (role) => {
    await assertSucceeds(setDoc(doc(await dbAs(role), 'notifications', 'N-new'), notif()));
  });

  it.each(['Support', 'Operations', 'Logistics', 'Partner', 'Customer', 'Business Client'])(
    'rejects %s (no invoices edit) creating a notification',
    async (role) => {
      await assertFails(setDoc(doc(await dbAs(role), 'notifications', 'N-new'), notif()));
    }
  );

  it('rejects a signed-out create', async () => {
    await assertFails(setDoc(doc(unauthedFirestore(testEnv), 'notifications', 'N-new'), notif()));
  });

  it('lets the recipient flip only the read flag', async () => {
    const db = await dbAs('Partner', 'own@example.com');
    await assertSucceeds(updateDoc(doc(db, 'notifications', 'N-1'), { read: true }));
  });

  it('rejects the recipient changing any other field, alone or with the read flag', async () => {
    const db = await dbAs('Partner', 'own@example.com');
    await assertFails(updateDoc(doc(db, 'notifications', 'N-1'), { message: 'Edited' }));
    await assertFails(updateDoc(doc(db, 'notifications', 'N-1'), { recipientEmail: 'other@example.com' }));
    await assertFails(updateDoc(doc(db, 'notifications', 'N-1'), { read: true, title: 'Edited' }));
  });

  it('rejects a non-recipient updating, including the read flag', async () => {
    await assertFails(updateDoc(doc(await dbAs('Partner', 'other@example.com'), 'notifications', 'N-1'), { read: true }));
    await assertFails(updateDoc(doc(await dbAs('Support'), 'notifications', 'N-1'), { read: true }));
  });

  it('rejects the recipient and staff deleting a notification', async () => {
    await assertFails(deleteDoc(doc(await dbAs('Partner', 'own@example.com'), 'notifications', 'N-1')));
    await assertFails(deleteDoc(doc(await dbAs('Sales'), 'notifications', 'N-1')));
  });
});
