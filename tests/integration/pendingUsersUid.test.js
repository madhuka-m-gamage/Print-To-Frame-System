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

// SEC-15: a pending request needs a verified email, so the default applicant is verified.
const applicant = (uid, email, emailVerified = true) =>
  testEnv.authenticatedContext(uid, { email, email_verified: emailVerified }).firestore();

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

describe('pendingUsers create needs a verified email (SEC-15)', () => {
  it('refuses a create from an unverified email/password login', async () => {
    const db = applicant('uid-new', 'new@example.com', false);
    await assertFails(setDoc(doc(db, 'pendingUsers', 'new@example.com'), record('new@example.com', 'uid-new')));
  });

  it('refuses a create when the token has no email_verified claim', async () => {
    const db = testEnv.authenticatedContext('uid-new', { email: 'new@example.com' }).firestore();
    await assertFails(setDoc(doc(db, 'pendingUsers', 'new@example.com'), record('new@example.com', 'uid-new')));
  });

  it('allows a create from a verified login (email link opened, or Google)', async () => {
    const db = applicant('uid-new', 'new@example.com', true);
    await assertSucceeds(setDoc(doc(db, 'pendingUsers', 'new@example.com'), record('new@example.com', 'uid-new')));
  });

  it('still refuses a verified create carrying another uid or email (SEC-13)', async () => {
    const db = applicant('uid-new', 'new@example.com', true);
    await assertFails(setDoc(doc(db, 'pendingUsers', 'new@example.com'), record('new@example.com', 'uid-victim')));
    await assertFails(setDoc(doc(db, 'pendingUsers', 'victim@example.com'), record('victim@example.com', 'uid-new')));
  });
});

// SEC-15: the sign-up form data waits in registrationDrafts/{uid} until the email is verified.
describe('registrationDrafts are private to their own uid (SEC-15)', () => {
  const draft = { identifier: 'new@example.com', name: 'Applicant', role: 'Partner', mobile: '0771234567' };

  it('lets an unverified login write, read and delete its own draft', async () => {
    const db = applicant('uid-new', 'new@example.com', false);
    await assertSucceeds(setDoc(doc(db, 'registrationDrafts', 'uid-new'), draft));
    await assertSucceeds(getDoc(doc(db, 'registrationDrafts', 'uid-new')));
    await assertSucceeds(deleteDoc(doc(db, 'registrationDrafts', 'uid-new')));
  });

  it("refuses another login's draft, even an Admin's", async () => {
    await testEnv.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'registrationDrafts', 'uid-new'), draft));
    const other = applicant('uid-other', 'other@example.com');
    await assertFails(getDoc(doc(other, 'registrationDrafts', 'uid-new')));
    await assertFails(setDoc(doc(other, 'registrationDrafts', 'uid-new'), draft));
    await assertFails(deleteDoc(doc(other, 'registrationDrafts', 'uid-new')));
    const admin = (await asRole(testEnv, 'Admin', 'admin@example.com')).firestore();
    await assertFails(getDoc(doc(admin, 'registrationDrafts', 'uid-new')));
  });

  it('refuses a signed-out caller', async () => {
    const anon = unauthedFirestore(testEnv);
    await assertFails(setDoc(doc(anon, 'registrationDrafts', 'uid-new'), draft));
    await assertFails(getDoc(doc(anon, 'registrationDrafts', 'uid-new')));
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
