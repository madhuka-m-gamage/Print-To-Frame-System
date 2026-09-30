import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { DEFAULT_PERMISSIONS } from '@/context/PermissionsContext.jsx';
import { PERMISSIONS_FIXTURE } from '../helpers/emulator.js';
import {
  OPERATIONS,
  PROBES,
  expectedAccess,
  diffAccess,
  formatAccessTable,
  loadLiveMatrix,
} from '../helpers/effectiveAccess.js';

const probe = (name) => PROBES.find((p) => p.name === name);
const allow = (matrix, role, name, op, authed = true) => expectedAccess(matrix, role, probe(name), op, authed);

describe('PERMISSIONS_FIXTURE', () => {
  it('matches DEFAULT_PERMISSIONS for every role and module it holds', () => {
    for (const [role, modules] of Object.entries(PERMISSIONS_FIXTURE)) {
      for (const [mod, perm] of Object.entries(modules)) {
        expect(perm, `${role}.${mod}`).toEqual(DEFAULT_PERMISSIONS[role][mod]);
      }
    }
  });
});

describe('expectedAccess mirrors checkPermission in firestore.rules', () => {
  it('gives Admin every operation on every probed collection except rewriting the audit log', () => {
    for (const p of PROBES) {
      for (const op of OPERATIONS) {
        if (p.name === 'auditLog' && (op === 'update' || op === 'delete')) continue;
        expect(expectedAccess(PERMISSIONS_FIXTURE, 'Admin', p, op, true), `${p.name} ${op}`).toBe(true);
      }
    }
  });

  it('denies a signed-out caller everything', () => {
    for (const p of PROBES) {
      for (const op of OPERATIONS) {
        expect(expectedAccess(PERMISSIONS_FIXTURE, null, p, op, false), `${p.name} ${op}`).toBe(false);
      }
    }
  });

  it('lets create or edit open both create and update (the rules OR them together)', () => {
    const matrix = { Ops: { invoices: { view: true, create: true, edit: false, delete: false } } };
    expect(allow(matrix, 'Ops', 'invoices', 'create')).toBe(true);
    expect(allow(matrix, 'Ops', 'invoices', 'update')).toBe(true);
    expect(allow(matrix, 'Ops', 'invoices', 'delete')).toBe(false);
  });

  it('accepts the legacy read and write keys', () => {
    const matrix = { Old: { quotations: { read: true, write: true } } };
    expect(allow(matrix, 'Old', 'quotations', 'read')).toBe(true);
    expect(allow(matrix, 'Old', 'quotations', 'create')).toBe(true);
    expect(allow(matrix, 'Old', 'quotations', 'update')).toBe(true);
    expect(allow(matrix, 'Old', 'quotations', 'delete')).toBe(false);
  });

  it('reads leads with either leads or pipeline view, writes deals by pipeline, deletes both by leads', () => {
    const matrix = { R: { leads: { delete: true }, pipeline: { view: true, edit: true, delete: false } } };
    expect(allow(matrix, 'R', 'leads', 'read')).toBe(true);
    expect(allow(matrix, 'R', 'leads', 'update')).toBe(false);
    expect(allow(matrix, 'R', 'deals (leads, isDeal)', 'update')).toBe(true);
    expect(allow(matrix, 'R', 'deals (leads, isDeal)', 'delete')).toBe(true);
  });

  it('opens users only through the agents and messages keys, without the legacy fallbacks', () => {
    const matrix = { M: { agents: { write: true }, messages: { view: true } } };
    expect(allow(matrix, 'M', 'users', 'read')).toBe(true);
    expect(allow(matrix, 'M', 'users', 'create')).toBe(false);
    expect(allow(matrix, 'M', 'users', 'update')).toBe(false);
  });

  it('keeps pricing writes and audit-log reads for Admin only', () => {
    expect(allow(PERMISSIONS_FIXTURE, 'Manager', 'pricing', 'read')).toBe(true);
    expect(allow(PERMISSIONS_FIXTURE, 'Manager', 'pricing', 'update')).toBe(false);
    expect(allow(PERMISSIONS_FIXTURE, 'Manager', 'auditLog', 'create')).toBe(true);
    expect(allow(PERMISSIONS_FIXTURE, 'Manager', 'auditLog', 'read')).toBe(false);
    expect(allow(PERMISSIONS_FIXTURE, 'Admin', 'auditLog', 'delete')).toBe(false);
  });
});

describe('diffAccess and formatAccessTable', () => {
  const key = (role, name, op) => `${role}|${name}|${op}`;

  it('lists only the cells that differ', () => {
    const before = { [key('Sales', 'leads', 'read')]: true, [key('Sales', 'leads', 'delete')]: false };
    const after = { [key('Sales', 'leads', 'read')]: true, [key('Sales', 'leads', 'delete')]: true };
    expect(diffAccess(before, after)).toEqual([
      { role: 'Sales', probe: 'leads', op: 'delete', deployed: false, next: true },
    ]);
  });

  it('prints one row per role and collection with R C U D flags for each rules version', () => {
    const results = { [key('Sales', 'leads', 'read')]: true, [key('Sales', 'leads', 'create')]: true };
    const table = formatAccessTable(['Sales'], [probe('leads')], results, { ...results, [key('Sales', 'leads', 'delete')]: true });
    expect(table).toMatch(/Sales\s+leads\s+RC--\s+RC-D/);
  });
});

describe('loadLiveMatrix', () => {
  it('returns null when no path is given or the file is absent', () => {
    expect(loadLiveMatrix(undefined, process.cwd())).toBeNull();
    expect(loadLiveMatrix(join(tmpdir(), 'no-such-live-matrix.json'), process.cwd())).toBeNull();
  });

  it('refuses a file inside the repository', () => {
    expect(() => loadLiveMatrix(join(process.cwd(), 'package.json'), process.cwd())).toThrow(/outside the repository/);
  });

  it('parses a matrix kept outside the repository', () => {
    const dir = mkdtempSync(join(tmpdir(), 'live-matrix-'));
    const file = join(dir, 'permissions.json');
    writeFileSync(file, JSON.stringify({ Sales: { leads: { view: true } } }));
    expect(loadLiveMatrix(file, process.cwd())).toEqual({ Sales: { leads: { view: true } } });
  });
});
