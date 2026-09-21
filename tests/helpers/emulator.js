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
const viewCreate = { ...none, view: true, create: true };
const viewEdit = { ...none, view: true, edit: true };

// Matrix for the modules firestore.rules passes to checkPermission(), plus quotations,
// messages and agents, which the Phase 7 rules changes will check. It is an independent
// fixture, not an import of DEFAULT_PERMISSIONS: that module imports src/services/firebase.js,
// which calls initializeApp against real Firebase. Update it by hand when the matrix changes
// (last synced with DEFAULT_PERMISSIONS at Phase 7 step 3.2).
export const PERMISSIONS_FIXTURE = {
  Admin: { leads: full, pipeline: full, customers: full, partners: full, invoices: full, receipts: full, projects: full, logistics: full, quotations: full, messages: full, agents: full },
  Manager: { leads: full, pipeline: full, customers: full, partners: full, invoices: full, receipts: { ...full, delete: false }, projects: full, logistics: full, quotations: full, messages: full, agents: full },
  Sales: { leads: write, pipeline: write, customers: write, partners: write, invoices: write, receipts: write, projects: read, logistics: read, quotations: full, messages: full, agents: none },
  Operations: { leads: none, pipeline: none, customers: read, partners: none, invoices: viewCreate, receipts: none, projects: ops, logistics: ops, quotations: none, messages: full, agents: none },
  Support: { leads: read, pipeline: read, customers: read, partners: read, invoices: read, receipts: read, projects: read, logistics: read, quotations: read, messages: full, agents: none },
  Accounts: {
    leads: read, pipeline: read, customers: read, partners: read,
    invoices: { ...write, export: true }, receipts: { ...write, export: true },
    projects: read, logistics: none, quotations: read, messages: full, agents: none,
  },
  Logistics: { leads: none, pipeline: none, customers: read, partners: none, invoices: read, receipts: none, projects: read, logistics: ops, quotations: none, messages: full, agents: none },
  Partner: { leads: none, pipeline: none, customers: none, partners: viewEdit, invoices: none, receipts: none, projects: none, logistics: none, quotations: none, messages: none, agents: none },
  Customer: { leads: none, pipeline: none, customers: none, partners: none, invoices: read, receipts: none, projects: read, logistics: read, quotations: none, messages: none, agents: none },
  'Business Client': { leads: none, pipeline: none, customers: none, partners: none, invoices: read, receipts: none, projects: read, logistics: read, quotations: none, messages: none, agents: none },
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
