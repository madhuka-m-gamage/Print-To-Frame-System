import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { setupRulesEnv, clearAll, seedPermissions, unauthedFirestore, asRole } from '../helpers/emulator';

// SEC-13: a pendingUsers record is bound to the login that wrote it. The document id must
// be the caller's email and `uid` the caller's Auth uid, so nobody can file a request for
// another person's email that an approval would later link to their own login (FEA-15).

let testEnv;

beforeAll(async () => {
  testEnv = await setupRulesEnv();
});

afterAll(async () => {
  await testEnv.cleanup();
});

const seed = (id, data) =>
  testEnv.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'pendingUsers', id), data));

const applicant = (uid, email) => testEnv.authenticatedContext(uid, { email }).firestore();

const record = (email, uid) => ({ identifier: email, name: 'Applicant', role: 'Business Client', status: 'Pending', uid });

beforeEach(async () => {
  await clearAll(testEnv);
  await seedPermissions(testEnv);
});

describe('pendingUsers create is bound to the caller (SEC-13)', () => {
  it('refuses a signed-out create', async () => {
    const anon = unauthedFirestore(testEnv);
    await assertFails(setDoc(doc(anon, 'pendingUsers', 'new@example.com'), record('new@example.com', 'uid-new')));
  });

  it('refuses a create carrying another uid', async () => {
    const db = applicant('uid-new', 'new@example.com');
    await assertFails(setDoc(doc(db, 'pendingUsers', 'new@example.com'), record('new@example.com', 'uid-victim')));
  });

  it('refuses a create without a uid', async () => {
    const db = applicant('uid-new', 'new@example.com');
    const { uid: _uid, ...noUid } = record('new@example.com', 'uid-new');
    await assertFails(setDoc(doc(db, 'pendingUsers', 'new@example.com'), noUid));
  });

  it("refuses a create under another person's email", async () => {
    const db = applicant('uid-attacker', 'attacker@example.com');
    await assertFails(setDoc(doc(db, 'pendingUsers', 'victim@example.com'), record('victim@example.com', 'uid-attacker')));
  });

  it('allows a create with the own email as id and the own uid', async () => {
    const db = applicant('uid-new', 'new@example.com');
    await assertSucceeds(setDoc(doc(db, 'pendingUsers', 'new@example.com'), record('new@example.com', 'uid-new')));
  });
});

describe('pendingUsers update keeps the uid binding (SEC-13)', () => {
  it('lets the registration form overwrite the shell record the auth listener wrote', async () => {
    const db = applicant('uid-new', 'new@example.com');
    await assertSucceeds(setDoc(doc(db, 'pendingUsers', 'new@example.com'), { ...record('new@example.com', 'uid-new'), role: 'Customer' }));
    await assertSucceeds(setDoc(doc(db, 'pendingUsers', 'new@example.com'), { ...record('new@example.com', 'uid-new'), mobile: '0771234567' }));
  });

  it('lets the applicant edit other fields of their own record', async () => {
    await seed('new@example.com', record('new@example.com', 'uid-new'));
    const db = applicant('uid-new', 'new@example.com');
    await assertSucceeds(updateDoc(doc(db, 'pendingUsers', 'new@example.com'), { name: 'Renamed' }));
  });

  it('refuses an update that changes the uid', async () => {
    await seed('new@example.com', record('new@example.com', 'uid-new'));
    const db = applicant('uid-new', 'new@example.com');
    await assertFails(updateDoc(doc(db, 'pendingUsers', 'new@example.com'), { uid: 'uid-victim' }));
  });

  it("refuses an update setting a record's missing uid to another login", async () => {
    const { uid: _uid, ...noUid } = record('new@example.com', 'uid-new');
    await seed('new@example.com', noUid);
    const db = applicant('uid-new', 'new@example.com');
    await assertFails(updateDoc(doc(db, 'pendingUsers', 'new@example.com'), { uid: 'uid-victim' }));
    await assertSucceeds(updateDoc(doc(db, 'pendingUsers', 'new@example.com'), { uid: 'uid-new' }));
  });

  it('still refuses self-approval', async () => {
    await seed('new@example.com', record('new@example.com', 'uid-new'));
    const db = applicant('uid-new', 'new@example.com');
    await assertFails(updateDoc(doc(db, 'pendingUsers', 'new@example.com'), { isApproved: true }));
  });
});

describe('Admin review of pendingUsers is unchanged (SEC-13)', () => {
  it('lets an Admin read, edit and delete any pending record', async () => {
    await seed('new@example.com', record('new@example.com', 'uid-new'));
    const db = (await asRole(testEnv, 'Admin', 'admin@example.com')).firestore();
    await assertSucceeds(getDoc(doc(db, 'pendingUsers', 'new@example.com')));
    await assertSucceeds(updateDoc(doc(db, 'pendingUsers', 'new@example.com'), { role: 'Customer' }));
    await assertSucceeds(deleteDoc(doc(db, 'pendingUsers', 'new@example.com')));
  });
});
