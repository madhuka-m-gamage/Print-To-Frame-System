import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
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

  it('lets an anonymous visitor submit a partner application and pending sign-up, but not read them', async () => {
    const anon = unauthedFirestore(testEnv);
    await assertSucceeds(setDoc(doc(anon, 'partner_applications', 'app1'), { name: 'Z' }));
    await assertSucceeds(setDoc(doc(anon, 'pendingUsers', 'new@example.com'), { name: 'Z' }));
    await assertFails(getDoc(doc(anon, 'partner_applications', 'app1')));
  });

  it('lets an anonymous visitor create a Referral lead but no other lead', async () => {
    const anon = unauthedFirestore(testEnv);
    await assertSucceeds(setDoc(doc(anon, 'leads', 'ref1'), { source: 'Referral', name: 'Z' }));
    await assertFails(setDoc(doc(anon, 'leads', 'other1'), { source: 'Walk-in', name: 'Z' }));
  });
});

describe('known gaps in today\'s rules (characterisation)', () => {
  // The Partner role holds view and edit on partners in the matrix (Phase 7 3.2 removed
  // create, delete and export), so a partner can still read every other partner: the rule
  // checks the module permission, not whose record it is. Not changed in 3.5: limiting it to
  // the partner's own record needs the Partners screen to query its own document first.
  it('lets a Partner read another partner\'s document because the matrix grants partners view', async () => {
    await seedDoc('partners', 'p2@example.com', { name: 'P2' });
    const db = await dbAs('Partner', 'p1@example.com');
    await assertSucceeds(getDoc(doc(db, 'partners', 'p2@example.com')));
  });

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

  // partners FINDINGS D-5 (public read of Active partners) is deliberately NOT applied in
  // Phase 7 3.4: a partner document holds bank name, account number and branch, and a
  // Firestore rule cannot hide fields, so the accepted rule would publish them to anyone.
  // Held for a decision (for example a separate public partner-profile document). Until
  // then an anonymous visitor cannot read a partner.
  it('denies an anonymous read of an Active partner', async () => {
    await seedDoc('partners', 'pub@example.com', { name: 'Pub', status: 'Active' });
    await assertFails(getDoc(doc(unauthedFirestore(testEnv), 'partners', 'pub@example.com')));
  });
});

describe('target behaviour to enable with the Phase 7 rules changes', () => {
  it.todo('follow-up: a Partner role limited to its own partners record (needs the Partners screen to query its own document, and field limits so a partner cannot edit its own commission rate)');
  it.todo('held: an Active partner readable by anyone (partners D-5) needs a public profile document, not the full partner record');
});
