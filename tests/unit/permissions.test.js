import { describe, it, expect } from 'vitest';
import { DEFAULT_PERMISSIONS } from '@/context/PermissionsContext.jsx';
import { SYSTEM_ROLES } from '@/constants/roles.js';

const MODULES = [
  'dashboard', 'notifications', 'messages', 'leads', 'pipeline', 'customers',
  'partners', 'invoices', 'receipts', 'quotations', 'projects', 'logistics', 'agents', 'calculator', 'admin',
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

  // Flipped in Phase 7 3.2: the Partner role is narrowed to view and edit on partners
  // (no create, delete or export), and has no access to messages. Restricting a partner
  // to their own record is the rules' job (Phase 7 3.5), not the matrix's.
  it('Partner can only view and edit partners, and has no messages access', () => {
    expect(DEFAULT_PERMISSIONS.Partner.partners).toEqual({
      view: true, create: false, edit: true, delete: false, export: false,
    });
    expect(DEFAULT_PERMISSIONS.Partner.messages).toEqual({
      view: false, create: false, edit: false, delete: false, export: false,
    });
  });

  it('quotations: Admin, Manager and Sales have full access; only Support and Accounts can read; the rest none', () => {
    const P = DEFAULT_PERMISSIONS;
    for (const role of ['Admin', 'Manager', 'Sales']) {
      for (const action of ACTIONS) expect(P[role].quotations[action], `${role}.quotations.${action}`).toBe(true);
    }
    for (const role of ['Support', 'Accounts']) {
      expect(P[role].quotations).toEqual({ view: true, create: false, edit: false, delete: false, export: false });
    }
    for (const role of ['Operations', 'Logistics', 'Partner', 'Customer', 'Business Client']) {
      expect(P[role].quotations.view, `${role}.quotations.view`).toBe(false);
    }
  });

  it('Customer and Business Client have no receipts or messages access', () => {
    for (const role of ['Customer', 'Business Client']) {
      for (const mod of ['receipts', 'messages']) {
        for (const action of ACTIONS) expect(DEFAULT_PERMISSIONS[role][mod][action], `${role}.${mod}.${action}`).toBe(false);
      }
    }
  });

  it('Manager cannot delete receipts; Logistics can read invoices; Operations can create them', () => {
    expect(DEFAULT_PERMISSIONS.Manager.receipts.delete).toBe(false);
    expect(DEFAULT_PERMISSIONS.Manager.receipts.edit).toBe(true);
    expect(DEFAULT_PERMISSIONS.Logistics.invoices).toMatchObject({ view: true, create: false });
    expect(DEFAULT_PERMISSIONS.Operations.invoices).toMatchObject({ view: true, create: true, edit: false, delete: false });
  });

  it('only Admin holds the admin (System Overview) module', () => {
    for (const [role, modules] of Object.entries(DEFAULT_PERMISSIONS)) {
      if (role === 'Admin') continue;
      for (const action of ACTIONS) expect(modules.admin[action], `${role}.admin.${action}`).toBe(false);
    }
  });

  it('no role other than Admin/Manager can delete invoices', () => {
    for (const [role, modules] of Object.entries(DEFAULT_PERMISSIONS)) {
      if (role === 'Admin' || role === 'Manager') continue;
      expect(modules.invoices.delete, `${role}.invoices.delete`).toBe(false);
    }
  });
});
