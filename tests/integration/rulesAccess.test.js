import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, where, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import {
  setupRulesEnv,
  clearAll,
  seedPermissions,
  seedUser,
  asRole,
  authedFirestore,
  unauthedFirestore,
} from '../helpers/emulator';

/**
 * Part B4: access rules for the collections outside the users/counters guards in the
 * other integration files. Two kinds of test live here:
 *   - plain tests for behaviour that is already correct (permission-gated writes, owner
 *     reads, immutable audit log);
 *   - characterisation tests that record a known gap in today's firestore.rules, each
 *     with a comment naming the finding and the Phase 7 step that flips it.
 * `it.todo` entries name the target behaviour Phase 7 will add; enable them in the same
 * change that edits the rules.
 */

const BOOTSTRAP_ADMIN_EMAIL = 'madhukagamage6@gmail.com';

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

const seedDoc = (collection, id, data) =>
  testEnv.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), collection, id), data));

describe('permission-gated collections (correct today)', () => {
  it('lets Sales create a lead but not delete one', async () => {
    const db = await dbAs('Sales');
    await assertSucceeds(setDoc(doc(db, 'leads', 'L-1'), { name: 'Kasun' }));
    await assertFails(deleteDoc(doc(db, 'leads', 'L-1')));
  });

  it('rejects a Support user creating a lead (read-only) but lets them read it', async () => {
    await seedDoc('leads', 'L-2', { name: 'Nimal' });
    const db = await dbAs('Support');
    await assertSucceeds(getDoc(doc(db, 'leads', 'L-2')));
    await assertFails(setDoc(doc(db, 'leads', 'L-3'), { name: 'X' }));
  });

  it('lets an Admin delete an invoice and blocks Sales from deleting one', async () => {
    await seedDoc('invoices', 'INV-ADV-0001', { amount: 1 });
    await assertFails(deleteDoc(doc(await dbAs('Sales'), 'invoices', 'INV-ADV-0001')));
    await assertSucceeds(deleteDoc(doc(await dbAs('Admin'), 'invoices', 'INV-ADV-0001')));
  });

  it('rejects an unauthenticated read of an invoice', async () => {
    await seedDoc('invoices', 'INV-ADV-0002', { amount: 1 });
    await assertFails(getDoc(doc(unauthedFirestore(testEnv), 'invoices', 'INV-ADV-0002')));
  });

  it('lets a customer read only their own invoice by customerId', async () => {
    await seedDoc('invoices', 'INV-A', { customerId: 'cust1@example.com' });
    await seedDoc('invoices', 'INV-B', { customerId: 'other@example.com' });
    await seedPermissions(testEnv, { Customer: { invoices: { view: false } } });
    const db = await dbAs('Customer', 'cust1@example.com');
    await assertSucceeds(getDoc(doc(db, 'invoices', 'INV-A')));
    await assertFails(getDoc(doc(db, 'invoices', 'INV-B')));
  });

  it('lets a Partner read their own partner document', async () => {
    await seedDoc('partners', 'p1@example.com', { name: 'P1' });
    const db = await dbAs('Partner', 'p1@example.com');
    await assertSucceeds(getDoc(doc(db, 'partners', 'p1@example.com')));
  });
});

describe('settings, audit log and public forms (correct today)', () => {
  it('lets anyone read settings/permissions but only an Admin write it', async () => {
    await assertSucceeds(getDoc(doc(unauthedFirestore(testEnv), 'settings', 'permissions')));
    await assertFails(setDoc(doc(await dbAs('Sales'), 'settings', 'permissions'), { Sales: {} }));
    await assertSucceeds(setDoc(doc(await dbAs('Admin'), 'settings', 'permissions'), { Admin: {} }));
  });

  it('lets any signed-in user append to the audit log but only an Admin read it, and nobody edit it', async () => {
    const sales = await dbAs('Sales');
    await assertSucceeds(setDoc(doc(sales, 'auditLog', 'a1'), { action: 'X' }));
    await assertFails(getDoc(doc(sales, 'auditLog', 'a1')));
    const admin = await dbAs('Admin');
    await assertSucceeds(getDoc(doc(admin, 'auditLog', 'a1')));
    await assertFails(updateDoc(doc(admin, 'auditLog', 'a1'), { action: 'Y' }));
    await assertFails(deleteDoc(doc(admin, 'auditLog', 'a1')));
  });

  // SEC-13: a pending sign-up now needs the applicant's own login (pendingUsersUid.test.js).
  it('lets an anonymous visitor submit a partner application but not a pending sign-up, and not read them', async () => {
    const anon = unauthedFirestore(testEnv);
    await assertSucceeds(setDoc(doc(anon, 'partner_applications', 'app1'), { name: 'Z' }));
    await assertFails(setDoc(doc(anon, 'pendingUsers', 'new@example.com'), { name: 'Z' }));
    await assertFails(getDoc(doc(anon, 'partner_applications', 'app1')));
  });

  it('lets an anonymous visitor create a Referral lead but no other lead', async () => {
    const anon = unauthedFirestore(testEnv);
    await assertSucceeds(setDoc(doc(anon, 'leads', 'ref1'), { source: 'Referral', name: 'Z' }));
    await assertFails(setDoc(doc(anon, 'leads', 'other1'), { source: 'Walk-in', name: 'Z' }));
  });
});

describe('known gaps in today\'s rules (characterisation)', () => {
  // Flipped in Phase 7 3.5 (rbac finding 5): quotations follow the quotations permission.
  it('gates quotations by the quotations permission', async () => {
    await seedDoc('quotations', 'QT-1', { total: 1 });
    await assertFails(getDoc(doc(await dbAs('Customer'), 'quotations', 'QT-1')));
    await assertFails(setDoc(doc(await dbAs('Customer'), 'quotations', 'QT-2'), { total: 1 }));
    await assertFails(setDoc(doc(await dbAs('Support'), 'quotations', 'QT-2'), { total: 1 }));
    await assertSucceeds(getDoc(doc(await dbAs('Support'), 'quotations', 'QT-1')));
    await assertSucceeds(setDoc(doc(await dbAs('Sales'), 'quotations', 'QT-2'), { total: 1 }));
    await assertSucceeds(updateDoc(doc(await dbAs('Sales'), 'quotations', 'QT-2'), { total: 2 }));
    await assertSucceeds(deleteDoc(doc(await dbAs('Admin'), 'quotations', 'QT-2')));
  });

  // Flipped in Phase 7 3.5 (messaging D-MSG-01, D-MSG-02): only participants read a conversation
  // and nobody can send as someone else.
  it('limits messages to their participants and to sending as yourself', async () => {
    await seedDoc('messages', 'm1', { fromId: 'a@example.com', toId: 'b@example.com', participants: ['a@example.com', 'b@example.com'], text: 'private', readBy: [] });
    const outsider = await dbAs('Sales', 'outsider@example.com');
    await assertFails(getDoc(doc(outsider, 'messages', 'm1')));
    await assertFails(setDoc(doc(outsider, 'messages', 'm2'), { fromId: 'a@example.com', participants: ['a@example.com', 'outsider@example.com'], text: 'forged' }));
    await assertFails(setDoc(doc(outsider, 'messages', 'm3'), { fromId: 'outsider@example.com', participants: ['a@example.com', 'b@example.com'], text: 'not in it' }));
    await assertSucceeds(setDoc(doc(outsider, 'messages', 'm4'), { fromId: 'outsider@example.com', participants: ['outsider@example.com', 'a@example.com'], text: 'hi' }));

    const participant = await dbAs('Sales', 'a@example.com');
    await assertSucceeds(getDoc(doc(participant, 'messages', 'm1')));
    const recipient = await dbAs('Sales', 'b@example.com');
    await assertSucceeds(updateDoc(doc(recipient, 'messages', 'm1'), { readBy: ['b@example.com'] }));
    await assertFails(updateDoc(doc(recipient, 'messages', 'm1'), { text: 'edited' }));
    await assertSucceeds(getDoc(doc(await dbAs('Admin'), 'messages', 'm1')));
    await assertFails(getDoc(doc(await dbAs('Partner', 'p@example.com'), 'messages', 'm1')));
  });

  // Flipped in Phase 7 3.5 (rbac finding 12): profiles are readable by Admin, the user, or a role
  // that manages users or uses messaging.
  it('limits user profile reads to Admin, self, and roles with agents or messages view', async () => {
    await seedUser(testEnv, 'boss@example.com', { role: 'Admin', isApproved: true, status: 'Active', name: 'Boss' });
    await assertFails(getDoc(doc(await dbAs('Partner', 'nosy@example.com'), 'users', 'boss@example.com')));
    await assertSucceeds(getDoc(doc(await dbAs('Partner', 'nosy@example.com'), 'users', 'nosy@example.com')));
    await assertSucceeds(getDoc(doc(await dbAs('Sales', 'chat@example.com'), 'users', 'boss@example.com')));
    await assertSucceeds(getDoc(doc(await dbAs('Admin', 'admin2@example.com'), 'users', 'boss@example.com')));
    await assertFails(getDoc(doc(unauthedFirestore(testEnv), 'users', 'boss@example.com')));
  });

  // Flipped in Phase 7 3.4 (rules audit): counters only accept the known prefixes and can only
  // step ahead by one, so a caller can neither invent a counter nor jump a sequence forward.
  // Lowering a counter is still allowed (see the comment on the rule), so that stays a known gap.
  it('limits counters to the known prefixes and to steps ahead of at most one', async () => {
    const db = await dbAs('Customer');
    await assertSucceeds(setDoc(doc(db, 'counters', 'INV-FIN'), { value: 1 }));
    await assertSucceeds(setDoc(doc(db, 'counters', 'INV-FIN'), { value: 2 }, { merge: true }));
    await assertFails(setDoc(doc(db, 'counters', 'INV-FIN'), { value: 999999 }, { merge: true }));
    await assertFails(setDoc(doc(db, 'counters', 'made-up-prefix'), { value: 1 }));
    await assertFails(setDoc(doc(db, 'counters', 'INV-ADV'), { value: 5 }));
    await assertFails(setDoc(doc(db, 'counters', 'INV-ADV'), { value: 1, extra: true }));
  });

  it('accepts the lead and deal id counters (Phase 7 6.2) but not a look-alike prefix', async () => {
    const db = await dbAs('Sales');
    await assertSucceeds(setDoc(doc(db, 'counters', 'L'), { value: 1 }));
    await assertSucceeds(setDoc(doc(db, 'counters', 'D'), { value: 1 }));
    await assertSucceeds(setDoc(doc(db, 'counters', 'PTF'), { value: 1 }));
    await assertFails(setDoc(doc(db, 'counters', 'LD'), { value: 1 }));
  });

  // Known gap left by the 3.4 counters rule (see the comment on it in firestore.rules): with no lower
  // bound, a signed-in user can still lower a counter and cause duplicate numbers. Closes only when
  // numbering moves server-side.
  it('still lets a signed-in user lower a counter', async () => {
    const db = await dbAs('Customer');
    await assertSucceeds(setDoc(doc(db, 'counters', 'QT'), { value: 1 }));
    await assertSucceeds(setDoc(doc(db, 'counters', 'QT'), { value: 2 }, { merge: true }));
    await assertSucceeds(setDoc(doc(db, 'counters', 'QT'), { value: 1 }, { merge: true }));
  });

  // Flipped in Phase 7 3.4 (partners D-6): payouts are Admin-written and claims are filed by
  // any signed-in user and resolved by an Admin.
  it('lets an Admin write partner_payouts and only a claiming partner or staff read them', async () => {
    const admin = await dbAs('Admin');
    await assertSucceeds(setDoc(doc(admin, 'partner_payouts', 'p1'), { amount: 1, partnerId: 'P-1', partnerEmail: 'own@example.com' }));
    await assertFails(setDoc(doc(await dbAs('Sales'), 'partner_payouts', 'p2'), { amount: 1 }));
    await assertFails(setDoc(doc(await dbAs('Partner', 'own@example.com'), 'partner_payouts', 'p3'), { amount: 1 }));
    await assertSucceeds(getDoc(doc(await dbAs('Partner', 'own@example.com'), 'partner_payouts', 'p1')));
    await assertFails(getDoc(doc(await dbAs('Partner', 'other@example.com'), 'partner_payouts', 'p1')));
    await assertSucceeds(getDoc(doc(await dbAs('Sales'), 'partner_payouts', 'p1')));
    await assertFails(getDoc(doc(unauthedFirestore(testEnv), 'partner_payouts', 'p1')));
  });

  it('lets any signed-in user file a referral claim, staff and the claimant read it, and only an Admin resolve it', async () => {
    const partner = await dbAs('Partner', 'own@example.com');
    await assertSucceeds(setDoc(doc(partner, 'referral_claims', 'c1'), { partnerEmail: 'own@example.com', clientName: 'X' }));
    await assertSucceeds(getDoc(doc(partner, 'referral_claims', 'c1')));
    await assertFails(getDoc(doc(await dbAs('Partner', 'other@example.com'), 'referral_claims', 'c1')));
    await assertSucceeds(getDoc(doc(await dbAs('Sales'), 'referral_claims', 'c1')));
    await assertFails(updateDoc(doc(await dbAs('Sales'), 'referral_claims', 'c1'), { status: 'Verified' }));
    await assertSucceeds(updateDoc(doc(await dbAs('Admin'), 'referral_claims', 'c1'), { status: 'Verified' }));
    await assertFails(setDoc(doc(unauthedFirestore(testEnv), 'referral_claims', 'c2'), { clientName: 'Y' }));
  });

  // Flipped in Phase 7 3.5 (rbac finding 1): a Deactivated or Disabled account is denied everywhere,
  // even with isApproved still true, while a legacy document with no status keeps working.
  it('denies Deactivated and Disabled users, and keeps a legacy approved user without status working', async () => {
    await seedUser(testEnv, 'gone@example.com', { role: 'Sales', isApproved: true, status: 'Deactivated' });
    await seedUser(testEnv, 'off@example.com', { role: 'Sales', isApproved: true, status: 'Disabled' });
    await seedUser(testEnv, 'legacy@example.com', { role: 'Sales', isApproved: true });
    await seedUser(testEnv, 'pending@example.com', { role: 'Sales', isApproved: false, status: 'Pending' });
    await assertFails(setDoc(doc(authedFirestore(testEnv, 'gone@example.com'), 'leads', 'L-a'), { name: 'x' }));
    await assertFails(setDoc(doc(authedFirestore(testEnv, 'off@example.com'), 'leads', 'L-b'), { name: 'x' }));
    await assertFails(setDoc(doc(authedFirestore(testEnv, 'pending@example.com'), 'leads', 'L-d'), { name: 'x' }));
    await assertSucceeds(setDoc(doc(authedFirestore(testEnv, 'legacy@example.com'), 'leads', 'L-c'), { name: 'x' }));
  });

  // SEC-11: why App.jsx keeps a listener on the user's own document. A Deactivated staff user may
  // still read their own record, but the users list query is refused, so it cannot carry eviction.
  it('lets a Deactivated user read their own users document but not list the collection', async () => {
    await seedUser(testEnv, 'gone@example.com', { role: 'Sales', isApproved: true, status: 'Deactivated' });
    const db = authedFirestore(testEnv, 'gone@example.com');
    await assertSucceeds(getDoc(doc(db, 'users', 'gone@example.com')));
    await assertFails(getDocs(collection(db, 'users')));
    await seedUser(testEnv, 'here@example.com', { role: 'Sales', isApproved: true, status: 'Active' });
    await assertSucceeds(getDocs(collection(authedFirestore(testEnv, 'here@example.com'), 'users')));
  });

  it('denies a Deactivated Admin, but never the bootstrap owner', async () => {
    await seedUser(testEnv, 'exadmin@example.com', { role: 'Admin', isApproved: true, status: 'Deactivated' });
    await assertFails(setDoc(doc(authedFirestore(testEnv, 'exadmin@example.com'), 'settings', 'permissions'), { Admin: {} }));
    await seedUser(testEnv, BOOTSTRAP_ADMIN_EMAIL, { role: 'Sales', isApproved: false, status: 'Deactivated' });
    await assertSucceeds(setDoc(doc(authedFirestore(testEnv, BOOTSTRAP_ADMIN_EMAIL), 'settings', 'permissions'), { Admin: {} }));
  });

  // Flipped in Phase 7 3.4 (auth DP-06): the bootstrap owner email counts as Admin even with no
  // users document.
  it('treats the bootstrap email as Admin when it has no users document', async () => {
    const db = authedFirestore(testEnv, BOOTSTRAP_ADMIN_EMAIL);
    await assertSucceeds(setDoc(doc(db, 'settings', 'permissions'), { Admin: {} }));
  });

  // Flipped in Phase 7 3.4 (auth DP-02): an applicant can finish their own pendingUsers record,
  // but not approve it or touch anyone else's.
  it('lets a pending applicant update their own pendingUsers document, but not approve it', async () => {
    await seedDoc('pendingUsers', 'app@example.com', { name: 'A' });
    await seedDoc('pendingUsers', 'other@example.com', { name: 'O' });
    const db = authedFirestore(testEnv, 'app@example.com');
    await assertSucceeds(updateDoc(doc(db, 'pendingUsers', 'app@example.com'), { name: 'B' }));
    await assertFails(updateDoc(doc(db, 'pendingUsers', 'app@example.com'), { isApproved: true }));
    await assertFails(updateDoc(doc(db, 'pendingUsers', 'other@example.com'), { name: 'B' }));
  });

  it('lets a customer read and update only their own record, and only the profile fields', async () => {
    await seedDoc('customers', 'c1', { name: 'Nimal', email: 'nimal@example.com', phone: '1', orders: 3 });
    await seedDoc('customers', 'c2', { name: 'Other', email: 'other@example.com', phone: '2', orders: 1 });
    await seedPermissions(testEnv);
    const db = await dbAs('Customer', 'nimal@example.com');
    await assertSucceeds(getDoc(doc(db, 'customers', 'c1')));
    await assertFails(getDoc(doc(db, 'customers', 'c2')));
    await assertSucceeds(updateDoc(doc(db, 'customers', 'c1'), { name: 'Nimal P', phone: '9', address: 'Kandy', photoURL: 'u' }));
    await assertFails(updateDoc(doc(db, 'customers', 'c1'), { orders: 0 }));
    await assertFails(updateDoc(doc(db, 'customers', 'c2'), { name: 'Hacked' }));
  });

  // FEA-13: profile sync finds the record with a query, so the query has to pass the read rule too,
  // and clearing a field is an update of the same four keys.
  it('lets a customer find their record by email, not by NIC, and clear phone and address', async () => {
    await seedDoc('customers', 'c1', { name: 'Nimal', email: 'nimal@example.com', nic: '912345678V', phone: '1', address: 'Galle' });
    await seedPermissions(testEnv);
    const db = await dbAs('Customer', 'nimal@example.com');
    const found = await assertSucceeds(getDocs(query(collection(db, 'customers'), where('email', '==', 'nimal@example.com'))));
    if (found.docs.length !== 1) throw new Error('expected the own record');
    await assertFails(getDocs(query(collection(db, 'customers'), where('nic', '==', '912345678V'))));
    await assertSucceeds(updateDoc(doc(db, 'customers', 'c1'), { name: 'Nimal', photoURL: '', phone: '', address: '' }));
  });

  // Flipped in Phase 7 3.5 (employees D4, owner decision): Managers administer users, but never
  // grant Admin, touch an Admin, or change their own role.
  it('lets a Manager administer non-Admin users within the guards', async () => {
    await seedUser(testEnv, 'staff@example.com', { role: 'Sales', isApproved: true, status: 'Active' });
    await seedUser(testEnv, 'boss@example.com', { role: 'Admin', isApproved: true, status: 'Active' });
    const db = await dbAs('Manager', 'mgr@example.com');
    await assertSucceeds(updateDoc(doc(db, 'users', 'staff@example.com'), { role: 'Support' }));
    await assertFails(updateDoc(doc(db, 'users', 'staff@example.com'), { role: 'Admin' }));
    await assertFails(updateDoc(doc(db, 'users', 'boss@example.com'), { name: 'x' }));
    await assertFails(deleteDoc(doc(db, 'users', 'boss@example.com')));
    await assertFails(updateDoc(doc(db, 'users', 'mgr@example.com'), { role: 'Admin' }));
    await assertSucceeds(setDoc(doc(db, 'users', 'new@example.com'), { role: 'Sales', isApproved: true, status: 'Active' }));
    await assertFails(setDoc(doc(db, 'users', 'new2@example.com'), { role: 'Admin', isApproved: true, status: 'Active' }));
    await assertSucceeds(deleteDoc(doc(db, 'users', 'staff@example.com')));
  });

  it('keeps Sales out of user administration and lets a Manager review pending sign-ups', async () => {
    await seedUser(testEnv, 'staff@example.com', { role: 'Support', isApproved: true, status: 'Active' });
    await assertFails(updateDoc(doc(await dbAs('Sales'), 'users', 'staff@example.com'), { role: 'Sales' }));
    await seedDoc('pendingUsers', 'app@example.com', { name: 'A' });
    await assertSucceeds(getDoc(doc(await dbAs('Manager', 'mgr@example.com'), 'pendingUsers', 'app@example.com')));
    await assertFails(getDoc(doc(await dbAs('Sales'), 'pendingUsers', 'app@example.com')));
  });

  // Flipped in Phase 7 3.5 (rbac finding 6): delete follows the module's delete permission, not Admin only.
  it('lets a Manager delete an invoice through the matrix, and still blocks Sales', async () => {
    await seedDoc('invoices', 'INV-DEL', { amount: 1 });
    await assertFails(deleteDoc(doc(await dbAs('Sales'), 'invoices', 'INV-DEL')));
    await assertSucceeds(deleteDoc(doc(await dbAs('Manager'), 'invoices', 'INV-DEL')));
    await seedDoc('receipts', 'REC-1', { amountReceived: 1 });
    await assertFails(deleteDoc(doc(await dbAs('Manager'), 'receipts', 'REC-1')));
  });

  // Flipped in Phase 7 3.5 (deals D-8): either the leads or the pipeline permission reads leads, and
  // writes follow the isDeal flag.
  it('lets a pipeline-only role read leads and write deals but not plain leads', async () => {
    await seedPermissions(testEnv, { Sales: { leads: { view: false, create: false, edit: false }, pipeline: { view: true, create: true, edit: true } } });
    await seedDoc('leads', 'L-pipe', { name: 'n' });
    await seedDoc('leads', 'D-pipe', { name: 'n', isDeal: true });
    const db = await dbAs('Sales');
    await assertSucceeds(getDoc(doc(db, 'leads', 'L-pipe')));
    await assertSucceeds(setDoc(doc(db, 'leads', 'D-new'), { name: 'deal', isDeal: true }));
    await assertSucceeds(updateDoc(doc(db, 'leads', 'D-pipe'), { name: 'edited' }));
    await assertFails(setDoc(doc(db, 'leads', 'L-new'), { name: 'lead' }));
    await assertFails(updateDoc(doc(db, 'leads', 'L-pipe'), { name: 'edited' }));
  });

  // partners FINDINGS D-5: a partner document holds bank name, account number and branch,
  // and a Firestore rule cannot hide fields, so partners stays closed to anonymous reads.
  // The public referral form reads partner_public instead (SEC-6, block below).
  it('denies an anonymous read of an Active partner', async () => {
    await seedDoc('partners', 'pub@example.com', { name: 'Pub', status: 'Active' });
    await assertFails(getDoc(doc(unauthedFirestore(testEnv), 'partners', 'pub@example.com')));
  });
});

describe('a Partner is limited to its own partners record (SEC-7)', () => {
  const OWN = { name: 'Own Studio', email: 'p1@example.com', commissionRate: 38, status: 'Active', pending: 0, paid: 0 };

  beforeEach(async () => {
    await seedDoc('partners', 'P-1', OWN);
    await seedDoc('partners', 'P-2', { name: 'Other', email: 'p2@example.com', commissionRate: 38 });
  });

  it('lets staff read every partner', async () => {
    const db = await dbAs('Sales');
    await assertSucceeds(getDoc(doc(db, 'partners', 'P-1')));
    await assertSucceeds(getDocs(collection(db, 'partners')));
  });

  it('lets a Partner read only the record whose email (or id) is its login email', async () => {
    const db = await dbAs('Partner', 'p1@example.com');
    await assertSucceeds(getDoc(doc(db, 'partners', 'P-1')));
    await assertSucceeds(getDocs(query(collection(db, 'partners'), where('email', '==', 'p1@example.com'))));
    await assertFails(getDoc(doc(db, 'partners', 'P-2')));
    await assertFails(getDocs(collection(db, 'partners')));
  });

  it('does not match a partner email that differs in case from the login email', async () => {
    await seedDoc('partners', 'P-3', { name: 'Mixed', email: 'Mixed@Example.com' });
    const db = await dbAs('Partner', 'mixed@example.com');
    await assertFails(getDoc(doc(db, 'partners', 'P-3')));
  });

  it('lets a Partner update its profile fields only', async () => {
    const db = await dbAs('Partner', 'p1@example.com');
    await assertSucceeds(updateDoc(doc(db, 'partners', 'P-1'), {
      name: 'New', contactPerson: 'N', phone: '+94', address: 'Kandy', company: 'Co',
      bankName: 'B', accountNumber: '1', accountName: 'A', branchName: 'Br', photoURL: 'x', documents: {}, updatedAt: 'now',
    }));
    await assertFails(updateDoc(doc(db, 'partners', 'P-1'), { commissionRate: 60 }));
    await assertFails(updateDoc(doc(db, 'partners', 'P-1'), { status: 'Inactive' }));
    await assertFails(updateDoc(doc(db, 'partners', 'P-1'), { pending: 1000 }));
    await assertFails(updateDoc(doc(db, 'partners', 'P-1'), { paid: 1000 }));
    await assertFails(updateDoc(doc(db, 'partners', 'P-1'), { email: 'p2@example.com' }));
  });

  it('denies a Partner updating another partner or creating a partner', async () => {
    const db = await dbAs('Partner', 'p1@example.com');
    await assertFails(updateDoc(doc(db, 'partners', 'P-2'), { name: 'Hijack' }));
    await assertFails(setDoc(doc(db, 'partners', 'P-9'), { name: 'New', email: 'p1@example.com' }));
  });

  it('lets staff with partners edit change the commission rate', async () => {
    await assertSucceeds(updateDoc(doc(await dbAs('Manager'), 'partners', 'P-1'), { commissionRate: 45 }));
  });

  it('denies a user who is neither staff nor the partner', async () => {
    const db = await dbAs('Customer', 'p1-not@example.com');
    await assertFails(getDoc(doc(db, 'partners', 'P-1')));
    await assertFails(updateDoc(doc(db, 'partners', 'P-1'), { name: 'X' }));
  });

  it('lets a Partner read only its own referral claims by partnerEmail', async () => {
    await seedDoc('referral_claims', 'c1', { partnerEmail: 'p1@example.com' });
    await seedDoc('referral_claims', 'c2', { partnerEmail: 'p2@example.com' });
    const db = await dbAs('Partner', 'p1@example.com');
    await assertSucceeds(getDocs(query(collection(db, 'referral_claims'), where('partnerEmail', '==', 'p1@example.com'))));
    await assertFails(getDocs(collection(db, 'referral_claims')));
  });
});

// SEC-6 (partners D-5): the public referral form reads partner_public/{partnerId}, a
// mirror holding only name, status and logo, while partners stays closed to anonymous reads.
describe('public partner profile partner_public (SEC-6)', () => {
  const PUBLIC = { name: 'Own Studio', status: 'Active', logo: '' };

  beforeEach(async () => {
    await seedDoc('partners', 'P-1', { name: 'Own Studio', email: 'p1@example.com', status: 'Active', bankName: 'B', accountNumber: '1' });
    await seedDoc('partners', 'P-2', { name: 'Other', email: 'p2@example.com', status: 'Active' });
    await seedDoc('partner_public', 'P-1', PUBLIC);
    await seedDoc('partner_public', 'P-2', { name: 'Other', status: 'Active', logo: '' });
  });

  it('lets an anonymous visitor get a public profile while partners stays denied', async () => {
    const anon = unauthedFirestore(testEnv);
    await assertSucceeds(getDoc(doc(anon, 'partner_public', 'P-1')));
    await assertFails(getDoc(doc(anon, 'partners', 'P-1')));
  });

  it('denies anonymous writes', async () => {
    const anon = unauthedFirestore(testEnv);
    await assertFails(setDoc(doc(anon, 'partner_public', 'P-9'), PUBLIC));
    await assertFails(updateDoc(doc(anon, 'partner_public', 'P-1'), { name: 'X' }));
    await assertFails(deleteDoc(doc(anon, 'partner_public', 'P-1')));
  });

  it('lets the owning Partner update name, logo and updatedAt only', async () => {
    const db = await dbAs('Partner', 'p1@example.com');
    await assertSucceeds(updateDoc(doc(db, 'partner_public', 'P-1'), { name: 'New', logo: 'x', updatedAt: 'now' }));
    await assertFails(updateDoc(doc(db, 'partner_public', 'P-1'), { status: 'Inactive' }));
    await assertFails(updateDoc(doc(db, 'partner_public', 'P-1'), { accountNumber: '1' }));
  });

  // SEC-16: a Partner whose mirror was never written creates it on its own profile save.
  it('lets the owning Partner create its missing mirror with its partners status only', async () => {
    await seedDoc('partners', 'P-6', { name: 'New Studio', email: 'p6@example.com', status: 'Inactive' });
    await seedDoc('partners', 'P-7', { name: 'No Status', email: 'p7@example.com' });
    const db = await dbAs('Partner', 'p6@example.com');
    await assertFails(setDoc(doc(db, 'partner_public', 'P-6'), { name: 'New Studio', status: 'Active', logo: '' }));
    await assertFails(setDoc(doc(db, 'partner_public', 'P-6'), { name: 'New Studio', status: 'Inactive', logo: '', commissionRate: 38 }));
    await assertFails(setDoc(doc(await dbAs('Partner', 'p1@example.com'), 'partner_public', 'P-6'), { name: 'X', status: 'Inactive', logo: '' }));
    await assertSucceeds(setDoc(doc(db, 'partner_public', 'P-6'), { name: 'New Studio', status: 'Inactive', logo: 'x', updatedAt: 'now' }));
    const noStatus = await dbAs('Partner', 'p7@example.com');
    await assertFails(setDoc(doc(noStatus, 'partner_public', 'P-7'), { name: 'No Status', status: 'Inactive', logo: '' }));
    await assertSucceeds(setDoc(doc(noStatus, 'partner_public', 'P-7'), { name: 'No Status', status: 'Active', logo: '' }));
  });

  it('lets the owning Partner overwrite its existing mirror with a set carrying its partners status', async () => {
    const db = await dbAs('Partner', 'p1@example.com');
    await assertSucceeds(setDoc(doc(db, 'partner_public', 'P-1'), { name: 'Renamed', status: 'Active', logo: 'x', updatedAt: 'now' }));
    await assertFails(setDoc(doc(db, 'partner_public', 'P-1'), { name: 'Renamed', status: 'Inactive', logo: 'x' }));
  });

  it('denies a Partner writing another partner profile, creating or deleting one', async () => {
    const db = await dbAs('Partner', 'p1@example.com');
    await assertFails(updateDoc(doc(db, 'partner_public', 'P-2'), { name: 'Hijack' }));
    await assertFails(setDoc(doc(db, 'partner_public', 'P-9'), PUBLIC));
    await assertFails(deleteDoc(doc(db, 'partner_public', 'P-1')));
  });

  it('lets staff with partners create and edit create and update, and partners delete remove', async () => {
    const sales = await dbAs('Sales');
    await assertSucceeds(setDoc(doc(sales, 'partner_public', 'P-3'), { ...PUBLIC, updatedAt: 'now' }));
    await assertSucceeds(updateDoc(doc(sales, 'partner_public', 'P-1'), { status: 'Inactive' }));
    await assertFails(deleteDoc(doc(sales, 'partner_public', 'P-1')));
    await assertSucceeds(deleteDoc(doc(await dbAs('Manager'), 'partner_public', 'P-1')));
  });

  it('refuses staff putting a field other than name, status, logo or updatedAt on the public doc', async () => {
    const sales = await dbAs('Sales');
    await assertFails(setDoc(doc(sales, 'partner_public', 'P-4'), { ...PUBLIC, accountNumber: '1' }));
    await assertFails(updateDoc(doc(sales, 'partner_public', 'P-1'), { email: 'p1@example.com' }));
  });

  it('denies a user without partners create or edit', async () => {
    const db = await dbAs('Operations');
    await assertFails(setDoc(doc(db, 'partner_public', 'P-5'), PUBLIC));
    await assertFails(updateDoc(doc(db, 'partner_public', 'P-1'), { name: 'X' }));
  });
});
