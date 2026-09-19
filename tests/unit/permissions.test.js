import { describe, it, expect } from 'vitest';
import { DEFAULT_PERMISSIONS } from '../../src/context/PermissionsContext.jsx';
import { SYSTEM_ROLES } from '../../src/constants/roles.js';

const MODULES = [
  'dashboard', 'notifications', 'messages', 'leads', 'pipeline', 'customers',
  'partners', 'invoices', 'projects', 'logistics', 'agents', 'calculator', 'admin',
];
const ACTIONS = ['view', 'create', 'edit', 'delete', 'export'];

describe('DEFAULT_PERMISSIONS shape', () => {
  it('defines every system role', () => {
    for (const role of SYSTEM_ROLES) {
      expect(DEFAULT_PERMISSIONS[role], `role "${role}"`).toBeDefined();
    }
  });

  it('every role defines every module with all five boolean actions', () => {
    for (const [role, modules] of Object.entries(DEFAULT_PERMISSIONS)) {
      for (const mod of MODULES) {
        const perm = modules[mod];
        expect(perm, `${role}.${mod}`).toBeDefined();
        for (const action of ACTIONS) {
          expect(typeof perm[action], `${role}.${mod}.${action}`).toBe('boolean');
        }
      }
    }
  });

  it('Admin has full access to every module', () => {
    for (const mod of MODULES) {
      for (const action of ACTIONS) {
        expect(DEFAULT_PERMISSIONS.Admin[mod][action], `Admin.${mod}.${action}`).toBe(true);
      }
    }
  });

  it('external roles (Partner/Customer/Business Client) have no access to internal-only modules', () => {
    // agents (user management) and admin (permissions manager) must never be
    // reachable by an external-facing role, regardless of future edits elsewhere.
    for (const role of ['Partner', 'Customer', 'Business Client']) {
      for (const mod of ['agents', 'admin', 'calculator']) {
        for (const action of ACTIONS) {
          expect(DEFAULT_PERMISSIONS[role][mod][action], `${role}.${mod}.${action}`).toBe(false);
        }
      }
    }
  });

  it('Partner has broad access to the partners module but not to other partners-adjacent data', () => {
    // Documented asymmetry (see Phase 7 of the business task-list plan): a logged-in
    // Partner gets full() on the *entire* partners module in this config, not scoped
    // to their own record — row-level restriction, if any, lives in firestore.rules,
    // not here. This test pins today's documented shape so a future change to it is
    // a deliberate edit, not an accidental one.
    expect(DEFAULT_PERMISSIONS.Partner.partners).toEqual({
      view: true, create: true, edit: true, delete: true, export: true,
    });
    expect(DEFAULT_PERMISSIONS.Partner.messages).toEqual({
      view: false, create: false, edit: false, delete: false, export: false,
    });
  });

  it('no role other than Admin/Manager can delete invoices', () => {
    for (const [role, modules] of Object.entries(DEFAULT_PERMISSIONS)) {
      if (role === 'Admin' || role === 'Manager') continue;
      expect(modules.invoices.delete, `${role}.invoices.delete`).toBe(false);
    }
  });
});
