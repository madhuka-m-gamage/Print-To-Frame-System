import { readFileSync } from 'fs';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';

// Shared setup for tests that exercise firestore.rules against the Firebase Emulator
// (run through `npm run test:rules`, which wraps vitest in `firebase emulators:exec`).
// Ports match firebase.json.
export const PROJECT_ID = 'demo-print2frame-test';

export function setupRulesEnv() {
  return initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: 'localhost',
      port: 8080,
    },
  });
}

export function clearAll(testEnv) {
  return testEnv.clearFirestore();
}

export function authedFirestore(testEnv, email) {
  return testEnv.authenticatedContext(email, { email }).firestore();
}

export function unauthedFirestore(testEnv) {
  return testEnv.unauthenticatedContext().firestore();
}

export async function seedUser(testEnv, email, data) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', email), data);
  });
}

const full = { view: true, create: true, edit: true, delete: true, export: true };
const write = { view: true, create: true, edit: true, delete: false, export: false };
const read = { view: true, create: false, edit: false, delete: false, export: false };
const ops = { view: true, create: true, edit: true, delete: true, export: false };
const none = { view: false, create: false, edit: false, delete: false, export: false };

// Matrix for the modules firestore.rules passes to checkPermission(). It is an independent
// fixture, not an import of DEFAULT_PERMISSIONS: that module imports src/services/firebase.js,
// which calls initializeApp against real Firebase. Update it when the matrix changes.
export const PERMISSIONS_FIXTURE = {
  Admin: { leads: full, pipeline: full, customers: full, partners: full, invoices: full, receipts: full, projects: full, logistics: full },
  Manager: { leads: full, pipeline: full, customers: full, partners: full, invoices: full, receipts: full, projects: full, logistics: full },
  Sales: { leads: write, pipeline: write, customers: write, partners: write, invoices: write, receipts: write, projects: read, logistics: read },
  Operations: { leads: none, pipeline: none, customers: read, partners: none, invoices: none, receipts: none, projects: ops, logistics: ops },
  Support: { leads: read, pipeline: read, customers: read, partners: read, invoices: read, receipts: read, projects: read, logistics: read },
  Accounts: {
    leads: read, pipeline: read, customers: read, partners: read,
    invoices: { ...write, export: true }, receipts: { ...write, export: true },
    projects: read, logistics: none,
  },
  Logistics: { leads: none, pipeline: none, customers: read, partners: none, invoices: none, receipts: none, projects: read, logistics: ops },
  Partner: { leads: none, pipeline: none, customers: none, partners: full, invoices: none, receipts: none, projects: none, logistics: none },
  Customer: { leads: none, pipeline: none, customers: none, partners: none, invoices: read, receipts: read, projects: read, logistics: read },
  'Business Client': { leads: none, pipeline: none, customers: none, partners: none, invoices: read, receipts: read, projects: read, logistics: read },
};

// Writes settings/permissions with security rules disabled. checkPermission() reads this
// document with get(), and nearly every rule denies by default when it is missing.
// overrides is merged per role and module, e.g. { Sales: { invoices: { delete: true } } }.
export async function seedPermissions(testEnv, overrides = {}) {
  const merged = {};
  const roles = new Set([...Object.keys(PERMISSIONS_FIXTURE), ...Object.keys(overrides)]);
  for (const role of roles) {
    merged[role] = {};
    const mods = new Set([
      ...Object.keys(PERMISSIONS_FIXTURE[role] || {}),
      ...Object.keys(overrides[role] || {}),
    ]);
    for (const mod of mods) {
      merged[role][mod] = { ...(PERMISSIONS_FIXTURE[role]?.[mod] || none), ...(overrides[role]?.[mod] || {}) };
    }
  }
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'settings', 'permissions'), merged);
  });
  return merged;
}

// Seeds users/{email} as an approved, active user with the given role and returns the
// authenticated context; call .firestore() on it to get a db handle.
export async function asRole(testEnv, role, email) {
  await seedUser(testEnv, email, {
    identifier: email,
    name: `${role} User`,
    role,
    isApproved: true,
    status: 'Active',
  });
  return testEnv.authenticatedContext(email, { email });
}
