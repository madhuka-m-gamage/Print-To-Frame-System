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
  // checks the module permission, not whose record it is. Flips in Phase 7 3.5, when the
  // rules limit the Partner role to its own record.
  it('lets a Partner read another partner\'s document because the matrix grants partners view', async () => {
    await seedDoc('partners', 'p2@example.com', { name: 'P2' });
    const db = await dbAs('Partner', 'p1@example.com');
    await assertSucceeds(getDoc(doc(db, 'partners', 'p2@example.com')));
  });

  // docs/02_modules/user-management-rbac/FINDINGS.md finding 5: /quotations is open to
  // any signed-in user, whatever their role. Flips in Phase 7 3.5 (checkPermission on a
  // new quotations module).
  it('lets a Customer read and write quotations', async () => {
    const db = await dbAs('Customer');
    await assertSucceeds(setDoc(doc(db, 'quotations', 'QT-1'), { total: 1 }));
    await assertSucceeds(getDoc(doc(db, 'quotations', 'QT-1')));
  });

  // docs/02_modules/internal-messaging/FINDINGS.md D-MSG-01 / D-MSG-02: any signed-in
  // user can read every message and create one claiming any sender. Flips in Phase 7 3.5.
  it('lets any signed-in user read a conversation they are not in and forge a sender', async () => {
    await seedDoc('messages', 'm1', { fromId: 'a@example.com', toId: 'b@example.com', participants: ['a@example.com', 'b@example.com'], text: 'private' });
    const db = await dbAs('Customer', 'outsider@example.com');
    await assertSucceeds(getDoc(doc(db, 'messages', 'm1')));
    await assertSucceeds(setDoc(doc(db, 'messages', 'm2'), { fromId: 'a@example.com', participants: ['a@example.com'], text: 'forged' }));
  });

  // user-management-rbac FINDINGS finding 12: any signed-in user can read every
  // profile. Flips in Phase 7 3.5 (Admin, self, or agents/messages view).
  it('lets a Customer read another user\'s profile', async () => {
    await seedUser(testEnv, 'boss@example.com', { role: 'Admin', isApproved: true, status: 'Active', name: 'Boss' });
    const db = await dbAs('Customer', 'nosy@example.com');
    await assertSucceeds(getDoc(doc(db, 'users', 'boss@example.com')));
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

  it('accepts the lead and deal id counters used since Phase 7 6.2 but not a look-alike prefix', async () => {
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

  // user-management-rbac FINDINGS finding 1: the rules never read users.status, so a
  // deactivated user whose role is otherwise allowed can still write. Flips in 3.5.
  it('lets a Deactivated user with a permitted role still create a lead', async () => {
    await seedUser(testEnv, 'gone@example.com', { role: 'Sales', isApproved: true, status: 'Deactivated' });
    const db = authedFirestore(testEnv, 'gone@example.com');
    await assertSucceeds(setDoc(doc(db, 'leads', 'L-gone'), { name: 'still works' }));
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

  // employees FINDINGS D4 (owner decision: Managers may administer users): today a
  // Manager cannot change another user's role or delete them. Flips in 3.5.
  it('rejects a Manager changing or deleting another user', async () => {
    await seedUser(testEnv, 'staff@example.com', { role: 'Sales', isApproved: true, status: 'Active' });
    const db = await dbAs('Manager');
    await assertFails(updateDoc(doc(db, 'users', 'staff@example.com'), { role: 'Support' }));
    await assertFails(deleteDoc(doc(db, 'users', 'staff@example.com')));
  });

  // user-management-rbac FINDINGS finding 6: delete is Admin-only on invoices even for a
  // role whose matrix grants delete. Flips in 3.5 (checkPermission(module, 'delete') or Admin).
  it('blocks a Manager with invoices:delete in the matrix from deleting an invoice', async () => {
    await seedDoc('invoices', 'INV-DEL', { amount: 1 });
    await assertFails(deleteDoc(doc(await dbAs('Manager'), 'invoices', 'INV-DEL')));
  });

  // deals FINDINGS D-8: leads reads accept only the leads permission, so a role with
  // pipeline view but no leads view cannot read leads. Flips in 3.5 (leads OR pipeline).
  it('denies a lead read to a role that has pipeline view but not leads view', async () => {
    await seedPermissions(testEnv, { Sales: { leads: { view: false }, pipeline: { view: true } } });
    await seedDoc('leads', 'L-pipe', { name: 'n' });
    await assertFails(getDoc(doc(await dbAs('Sales'), 'leads', 'L-pipe')));
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
  it.todo('held: an Active partner readable by anyone (partners D-5) needs a public profile document, not the full partner record');
  it.todo('3.5: quotations follow checkPermission(quotations); a Customer is denied');
  it.todo('3.5: messages are readable only by participants and Admin; create requires fromId to be the caller');
  it.todo('3.5: users are readable only by Admin, self, or roles with agents or messages view');
  it.todo('3.5: a Deactivated or Disabled user is denied everywhere; legacy users without status keep working');
  it.todo('3.5: a Manager can update or delete non-Admin users, but cannot grant Admin, edit an Admin or change their own role');
  it.todo('3.5: leads are readable with the leads or pipeline permission; delete follows checkPermission or Admin');
});
