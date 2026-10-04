// Seeds the Firebase emulators with enough data for E2E journeys. Idempotent.
// Run with `npm run seed:emulator` while `firebase emulators:start` is up.
// Refuses to run unless it is pointed at a local emulator and a demo- project.
import { readFileSync } from 'node:fs';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { loadDefaultPermissions } from './defaultPermissions.mjs';

const projectId = process.env.GCLOUD_PROJECT || '';
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST || '';
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || '';

if (!firestoreHost || !projectId.startsWith('demo-') || !/^(127\.0\.0\.1|localhost)(:|$)/.test(firestoreHost)) {
  console.error(
    `Refusing to seed: need FIRESTORE_EMULATOR_HOST set to a local host and GCLOUD_PROJECT starting with "demo-" (got host "${firestoreHost}", project "${projectId}").`
  );
  process.exit(1);
}
if (!authHost) {
  console.error('Refusing to seed: FIREBASE_AUTH_EMULATOR_HOST is not set.');
  process.exit(1);
}

export const SEED_PASSWORD = 'Passw0rd!test';
export const SEED_USERS = {
  admin: 'admin@example.com',
  partner: 'partner@example.com',
  deactivated: 'deactivated@example.com',
  sales: 'sales@example.com',
  manager: 'manager@example.com',
  customer: 'customer@example.com',
  // Active on every seed; rbac.spec.js deactivates it mid-session.
  evicted: 'evicted@example.com',
};

initializeApp({ projectId });
const db = getFirestore();
const auth = getAuth();

async function ensureAuthUser(email, displayName) {
  try {
    const existing = await auth.getUserByEmail(email);
    await auth.updateUser(existing.uid, { password: SEED_PASSWORD, displayName });
  } catch (e) {
    if (e.code !== 'auth/user-not-found') throw e;
    await auth.createUser({ email, password: SEED_PASSWORD, displayName });
  }
}

const now = '2026-01-01T00:00:00.000Z';
const userDoc = (email, name, role, extra = {}) => ({
  identifier: email, name, role, isApproved: true, status: 'Active', createdAt: now, ...extra,
});

// `firebase emulators:start` does not pick up firestore.rules here (firebase.json declares
// firestore as an array of databases), so it would run allow-all. Load the real rules so
// E2E exercises them. The seed below uses the Admin SDK, which bypasses rules either way.
const rulesRes = await fetch(`http://${firestoreHost}/emulator/v1/projects/${projectId}:securityRules`, {
  method: 'PUT',
  body: JSON.stringify({
    rules: { files: [{ name: 'firestore.rules', content: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8') }] },
  }),
});
if (!rulesRes.ok) throw new Error(`Could not load firestore.rules into the emulator: ${rulesRes.status} ${await rulesRes.text()}`);

await db.doc('settings/permissions').set(loadDefaultPermissions());

await ensureAuthUser(SEED_USERS.admin, 'Seed Admin');
await ensureAuthUser(SEED_USERS.partner, 'Seed Partner');
await ensureAuthUser(SEED_USERS.deactivated, 'Seed Deactivated');
await ensureAuthUser(SEED_USERS.sales, 'Seed Sales');
await ensureAuthUser(SEED_USERS.manager, 'Seed Manager');
await ensureAuthUser(SEED_USERS.customer, 'Seed Customer');
await ensureAuthUser(SEED_USERS.evicted, 'Seed Evicted');

await db.doc(`users/${SEED_USERS.admin}`).set(userDoc(SEED_USERS.admin, 'Seed Admin', 'Admin'));
await db.doc(`users/${SEED_USERS.partner}`).set(
  userDoc(SEED_USERS.partner, 'Seed Partner', 'Partner', { partnerId: 'P-1001' })
);
await db.doc(`users/${SEED_USERS.deactivated}`).set(
  userDoc(SEED_USERS.deactivated, 'Seed Deactivated', 'Sales', { isApproved: true, status: 'Deactivated' })
);

await db.doc(`users/${SEED_USERS.sales}`).set(userDoc(SEED_USERS.sales, 'Seed Sales', 'Sales'));
await db.doc(`users/${SEED_USERS.manager}`).set(userDoc(SEED_USERS.manager, 'Seed Manager', 'Manager'));
await db.doc(`users/${SEED_USERS.customer}`).set(userDoc(SEED_USERS.customer, 'Seed Customer', 'Customer'));
await db.doc(`users/${SEED_USERS.evicted}`).set(userDoc(SEED_USERS.evicted, 'Seed Evicted', 'Sales'));

await db.doc('partners/P-1001').set({
  id: 'P-1001', partnerId: 'P-1001', name: 'Seed Art Studio', type: 'Art & Framing Studio',
  contactPerson: 'Nimal', phone: '+9471 234 5678', email: SEED_USERS.partner, address: 'Colombo',
  commissionRate: 53.5, status: 'Active', createdAt: now,
});
// SEC-6: the public mirror the anonymous referral form reads.
await db.doc('partner_public/P-1001').set({ name: 'Seed Art Studio', status: 'Active', logo: '', updatedAt: now });

await db.doc('customers/NIC-900000001V').set({
  id: 'NIC-900000001V', nic: '900000001V', name: 'Kasun Perera', email: 'kasun@example.com',
  phone: '+9477 123 4567', company: '', orders: 1, createdAt: now,
});

// Lead that has an accepted quotation and has been converted into a deal + fabrication project.
await db.doc('leads/L-100001').set({
  id: 'L-100001', name: 'Kasun Perera', company: '', phone: '+9477 123 4567', email: 'kasun@example.com',
  value: 100000, totalSqFt: 10, stage: 'Completed', stageEnteredAt: now, source: 'Manual', date: '2026-01-01',
  jobScope: 'Canvas framing', deliveryLocation: 'Colombo 07', isDeal: false,
  convertedToDeal: true, convertedDealId: 'D-100001', jobNo: 'PTF-1001',
});

await db.doc('quotations/QT-100001').set({
  id: 'QT-100001', leadId: 'L-100001', clientName: 'Kasun Perera', company: '', phone: '+9477 123 4567',
  status: 'Accepted', version: 1,
  lineItems: [{ description: 'Framed canvas', qty: 1, unit: 'pcs', unitPrice: 100000, taxPct: 0, discountPct: 0 }],
  subtotal: 100000, grandTotal: 100000, advanceDue: 75000, balanceDue: 25000, notes: '',
  scope: 'Canvas framing', createdBy: SEED_USERS.admin, createdAt: now, updatedAt: now,
});

await db.doc('leads/D-100001').set({
  id: 'D-100001', name: 'Kasun Perera', company: '', phone: '+9477 123 4567', email: 'kasun@example.com',
  value: 100000, totalSqFt: 10, stage: 'Waiting', stageEnteredAt: now, source: 'Manual', date: '2026-01-01',
  jobScope: 'Canvas framing', deliveryLocation: 'Colombo 07', isDeal: true, convertedToDeal: false,
  originalLeadId: 'L-100001', jobNo: 'PTF-1001', linkedJobNo: 'PTF-1001',
});

await db.doc('projects/PTF-1001').set({
  id: 'PTF-1001', jobNo: 'PTF-1001', title: 'Canvas framing', clientNIC: '900000001V',
  customerName: 'Kasun Perera', leadId: 'L-100001', dealId: 'D-100001', status: 'Pending',
  stageEnteredAt: now, createdAt: now, value: 100000, totalSqFt: 10, flexReceived: false,
  checklist: { materialsCut: false, frameWelded: false, primerApplied: false, canvasWrapped: false, qaPassed: false },
});

// Money journey (tests/e2e/money.spec.js): a deal with an Accepted quotation and no invoices yet.
// Invoices for it are removed on every seed so the journey starts clean on a reused emulator.
await db.doc('leads/D-200001').set({
  id: 'D-200001', name: 'Money Journey Client', company: '', phone: '+9477 555 0001', email: 'money@example.com',
  value: 200000, totalSqFt: 20, stage: 'Waiting', stageEnteredAt: now, source: 'Manual', date: '2026-01-01',
  jobScope: 'Gallery wall framing', deliveryLocation: 'Kandy', isDeal: true, convertedToDeal: false,
});
await db.doc('quotations/QT-200001').set({
  id: 'QT-200001', leadId: 'D-200001', clientName: 'Money Journey Client', company: '', phone: '+9477 555 0001',
  status: 'Accepted', version: 1,
  lineItems: [{ description: 'Gallery frames', qty: 2, unit: 'pcs', unitPrice: 100000, taxPct: 0, discountPct: 0 }],
  subtotal: 200000, grandTotal: 200000, advanceDue: 150000, balanceDue: 50000, notes: '',
  scope: 'Gallery wall framing', createdBy: SEED_USERS.admin, createdAt: now, updatedAt: now,
});
const staleInvoices = await db.collection('invoices').where('leadId', '==', 'D-200001').get();
await Promise.all(staleInvoices.docs.map((d) => d.ref.delete()));

console.log(`Seeded emulator project ${projectId}. Password for seeded accounts: ${SEED_PASSWORD}`);
