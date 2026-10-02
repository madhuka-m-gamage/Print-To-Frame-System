import { execFileSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { isAbsolute, relative, resolve } from 'path';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

// SEC-9: which rule actually wins. PROBES describe, per collection, what firestore.rules
// grants in terms of the permission matrix; probeAccess runs the real operations against
// the emulator so the two can be compared.

export const DEPLOYED_RULES_REF = 'origin/main';
export const OPERATIONS = ['read', 'create', 'update', 'delete'];

// checkPermission(module, action) in firestore.rules: Admin always; otherwise the exact
// key, with 'read' also accepting view and 'write' also accepting create or edit.
function permissionChecker(matrix, role) {
  return (mod, action) => {
    if (role === 'Admin') return true;
    const perm = matrix?.[role]?.[mod] || {};
    if (perm[action] === true) return true;
    if (action === 'read') return perm.view === true;
    if (action === 'write') return perm.create === true || perm.edit === true;
    return false;
  };
}

const canRead = (can, mod) => can(mod, 'view') || can(mod, 'read');
const canWrite = (can, mod) => can(mod, 'create') || can(mod, 'edit') || can(mod, 'write');

const gated = (mod) => ({ can }) => ({
  read: canRead(can, mod),
  create: canWrite(can, mod),
  update: canWrite(can, mod),
  delete: can(mod, 'delete'),
});

const OWNER = 'owner@example.com';

export const PROBES = [
  {
    name: 'leads', collection: 'leads', data: { name: 'Probe', isDeal: false },
    rule: ({ can }) => ({
      read: canRead(can, 'leads') || canRead(can, 'pipeline'),
      create: canWrite(can, 'leads'),
      update: canWrite(can, 'leads'),
      delete: can('leads', 'delete'),
    }),
  },
  {
    name: 'deals (leads, isDeal)', collection: 'leads', data: { name: 'Probe', isDeal: true },
    rule: ({ can }) => ({
      read: canRead(can, 'leads') || canRead(can, 'pipeline'),
      create: canWrite(can, 'pipeline'),
      update: canWrite(can, 'pipeline'),
      delete: can('leads', 'delete'),
    }),
  },
  ...['quotations', 'invoices', 'receipts', 'customers', 'projects', 'logistics'].map((mod) => ({
    name: mod, collection: mod, data: { name: 'Probe', customerId: OWNER, email: OWNER }, rule: gated(mod),
  })),
  {
    // SEC-7: the Partner role reaches only its own partners record, never this probe's.
    name: 'partners', collection: 'partners', data: { name: 'Probe', customerId: OWNER, email: OWNER },
    rule: ({ can, role }) => {
      const staff = role !== 'Partner';
      return {
        read: staff && canRead(can, 'partners'),
        create: staff && canWrite(can, 'partners'),
        update: staff && canWrite(can, 'partners'),
        delete: can('partners', 'delete'),
      };
    },
  },
  {
    name: 'users', collection: 'users', targetId: 'probe-target@example.com', newId: 'probe-new@example.com',
    data: { name: 'Probe', role: 'Sales', isApproved: true, status: 'Active' },
    rule: ({ can }) => ({
      read: can('agents', 'view') || can('messages', 'view'),
      create: can('agents', 'create'),
      update: can('agents', 'edit'),
      delete: can('agents', 'delete'),
    }),
  },
  {
    name: 'pricing', collection: 'pricing', data: { rate: 1 },
    rule: ({ authed, admin }) => ({ read: authed, create: admin, update: admin, delete: admin }),
  },
  {
    name: 'auditLog', collection: 'auditLog', data: { action: 'probe' },
    rule: ({ authed, admin }) => ({ read: admin, create: authed, update: false, delete: false }),
  },
];

// role is null for a signed-out caller.
export function expectedAccess(matrix, role, probe, op, authed) {
  const can = authed ? permissionChecker(matrix, role) : () => false;
  return probe.rule({ can, authed, role, admin: authed && role === 'Admin' })[op];
}

async function attempt(fn) {
  try {
    await fn();
    return true;
  } catch (err) {
    if (err?.code === 'permission-denied') return false;
    throw err;
  }
}

const emailFor = (role) => `${role.toLowerCase().replace(/\s/g, '')}@example.com`;

// Runs every probe for each role (and signed out) on a fresh database seeded with the
// matrix, the caller's approved users document and one existing record per probe.
export async function probeAccess(testEnv, matrix, roles) {
  const results = {};
  for (const role of [...roles, null]) {
    const label = role ?? 'signed out';
    await testEnv.clearFirestore();
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const admin = ctx.firestore();
      await setDoc(doc(admin, 'settings', 'permissions'), matrix);
      if (role) {
        await setDoc(doc(admin, 'users', emailFor(role)), {
          identifier: emailFor(role), name: `${role} User`, role, isApproved: true, status: 'Active',
        });
      }
      for (const p of PROBES) await setDoc(doc(admin, p.collection, p.targetId || `probe-${p.name}`), p.data);
    });
    const db = role
      ? testEnv.authenticatedContext(emailFor(role), { email: emailFor(role) }).firestore()
      : testEnv.unauthenticatedContext().firestore();
    for (const p of PROBES) {
      const target = doc(db, p.collection, p.targetId || `probe-${p.name}`);
      const fresh = doc(db, p.collection, p.newId || `probe-${p.name}-new`);
      results[`${label}|${p.name}|read`] = await attempt(() => getDoc(target));
      results[`${label}|${p.name}|create`] = await attempt(() => setDoc(fresh, p.data));
      results[`${label}|${p.name}|update`] = await attempt(() => updateDoc(target, { note: 'probe' }));
      results[`${label}|${p.name}|delete`] = await attempt(() => deleteDoc(target));
    }
  }
  return results;
}

export function diffAccess(deployed, next) {
  const keys = [...new Set([...Object.keys(deployed), ...Object.keys(next)])];
  return keys
    .filter((key) => deployed[key] !== next[key])
    .map((key) => {
      const [role, probe, op] = key.split('|');
      return { role, probe, op, deployed: deployed[key], next: next[key] };
    });
}

const flags = (results, role, name) =>
  OPERATIONS.map((op) => (results[`${role}|${name}|${op}`] ? op[0].toUpperCase() : '-')).join('');

export function formatAccessTable(roles, probes, deployed, next) {
  const lines = [`${'role'.padEnd(16)} ${'collection'.padEnd(22)} deployed new`];
  for (const role of roles) {
    for (const p of probes) {
      const before = flags(deployed, role, p.name);
      const after = flags(next, role, p.name);
      lines.push(`${role.padEnd(16)} ${p.name.padEnd(22)} ${before}     ${after}${before === after ? '' : '  *'}`);
    }
  }
  return lines.join('\n');
}

export function readDeployedRules(ref = DEPLOYED_RULES_REF) {
  return execFileSync('git', ['show', `${ref}:firestore.rules`], { encoding: 'utf8' });
}

// The live matrix is copied by hand from the console and must never be committed.
export function loadLiveMatrix(path, repoRoot) {
  if (!path) return null;
  const file = resolve(path);
  const rel = relative(resolve(repoRoot), file);
  if (!rel.startsWith('..') && !isAbsolute(rel)) {
    throw new Error('LIVE_PERMISSIONS_JSON must be kept outside the repository');
  }
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, 'utf8'));
}
