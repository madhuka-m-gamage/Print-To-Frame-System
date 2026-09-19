import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { logActivity } from '../services/auditLog';

const PermissionsContext = createContext();

// Helper to build a full-access module permission
const full = () => ({ view: true, create: true, edit: true, delete: true, export: true });
// View + create + edit (no delete, no export)
const write = () => ({ view: true, create: true, edit: true, delete: false, export: false });
// View only
const read = () => ({ view: true, create: false, edit: false, delete: false, export: false });
// No access at all
const none = () => ({ view: false, create: false, edit: false, delete: false, export: false });
// View + export only
const readExport = () => ({ view: true, create: false, edit: false, delete: false, export: true });
// Create + edit + delete (ops full)
const ops = () => ({ view: true, create: true, edit: true, delete: true, export: false });

export const DEFAULT_PERMISSIONS = {
  Admin: {
    dashboard: full(), notifications: full(), messages: full(),
    leads: full(), pipeline: full(), customers: full(), partners: full(),
    invoices: full(), receipts: full(), projects: full(), logistics: full(),
    agents: full(), calculator: full(), admin: full(),
  },
  Manager: {
    dashboard: full(), notifications: full(), messages: full(),
    leads: full(), pipeline: full(), customers: full(), partners: full(),
    invoices: full(), receipts: full(), projects: full(), logistics: full(),
    agents: read(), calculator: full(), admin: read(),
  },
  Sales: {
    dashboard: full(), notifications: full(), messages: full(),
    leads: write(), pipeline: write(), customers: write(), partners: write(),
    invoices: write(), receipts: write(), projects: read(), logistics: read(),
    agents: none(), calculator: full(), admin: none(),
  },
  Operations: {
    dashboard: full(), notifications: full(), messages: full(),
    leads: none(), pipeline: none(), customers: read(), partners: none(),
    invoices: none(), receipts: none(), projects: ops(), logistics: ops(),
    agents: none(), calculator: full(), admin: none(),
  },
  Support: {
    dashboard: read(), notifications: full(), messages: full(),
    leads: read(), pipeline: read(), customers: read(), partners: read(),
    invoices: read(), receipts: read(), projects: read(), logistics: read(),
    agents: none(), calculator: none(), admin: none(),
  },
  Accounts: {
    dashboard: read(), notifications: full(), messages: full(),
    leads: read(), pipeline: read(), customers: read(), partners: read(),
    invoices: { view: true, create: true, edit: true, delete: false, export: true },
    receipts: { view: true, create: true, edit: true, delete: false, export: true },
    projects: read(), logistics: none(),
    agents: none(), calculator: { view: true, create: true, edit: true, delete: false, export: true }, admin: none(),
  },
  Logistics: {
    dashboard: read(), notifications: full(), messages: full(),
    leads: none(), pipeline: none(), customers: read(), partners: none(),
    invoices: none(), receipts: none(), projects: read(), logistics: ops(),
    agents: none(), calculator: none(), admin: none(),
  },
  Partner: {
    dashboard: full(), notifications: full(), messages: none(),
    leads: none(), pipeline: none(), customers: none(), partners: full(),
    invoices: none(), receipts: none(), projects: none(), logistics: none(),
    agents: none(), calculator: none(), admin: none(),
  },
  Customer: {
    dashboard: full(), notifications: full(), messages: full(),
    leads: none(), pipeline: none(), customers: none(), partners: none(),
    invoices: read(), receipts: read(), projects: read(), logistics: read(),
    agents: none(), calculator: none(), admin: none(),
  },
  'Business Client': {
    dashboard: full(), notifications: full(), messages: full(),
    leads: none(), pipeline: none(), customers: none(), partners: none(),
    invoices: read(), receipts: read(), projects: read(), logistics: read(),
    agents: none(), calculator: none(), admin: none(),
  },
};

// ── Migration helper: convert old {read, write} schema to new granular schema ──
function migratePermissions(perms) {
  if (!perms) return DEFAULT_PERMISSIONS;
  const migrated = {};
  for (const [role, modules] of Object.entries(perms)) {
    migrated[role] = {};
    for (const [mod, access] of Object.entries(modules)) {
      // If the module already has the new schema (has 'view' key), keep it
      if (typeof access === 'object' && 'view' in access) {
        migrated[role][mod] = access;
      } else if (typeof access === 'object' && ('read' in access || 'write' in access)) {
        // Convert old schema
        const isAdmin = role === 'Admin';
        const hasRead = access.read === true;
        const hasWrite = access.write === true;
        migrated[role][mod] = {
          view: hasRead || isAdmin,
          create: hasWrite || isAdmin,
          edit: hasWrite || isAdmin,
          delete: isAdmin ? true : (hasWrite && ['Admin', 'Manager'].includes(role)),
          export: isAdmin ? true : hasRead,
        };
      } else {
        // Fallback to DEFAULT
        migrated[role][mod] = DEFAULT_PERMISSIONS[role]?.[mod] || none();
      }
    }
  }
  return migrated;
}

export const PermissionsProvider = ({ children }) => {
  const [permissions, setPermissions] = useState(DEFAULT_PERMISSIONS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const permDocRef = doc(db, 'settings', 'permissions');
    
    const unsubscribe = onSnapshot(permDocRef, async (docSnap) => {
      if (docSnap.exists()) {
        // Migrate from old schema if needed
        const raw = docSnap.data();
        const firstRole = Object.values(raw)[0];
        const firstMod = firstRole ? Object.values(firstRole)[0] : null;
        const needsMigration = firstMod && !('view' in firstMod);
        
        if (needsMigration) {
          const migrated = migratePermissions(raw);
          try {
            await setDoc(permDocRef, migrated, { merge: false });
            // Snapshot will fire again with migrated data
          } catch (err) {
            setPermissions(migrated);
            setLoading(false);
          }
        } else {
          setPermissions(raw);
          setLoading(false);
        }
      } else {
        try {
          await setDoc(permDocRef, DEFAULT_PERMISSIONS);
        } catch (err) {
          setPermissions(DEFAULT_PERMISSIONS);
          setLoading(false);
        }
      }
    }, (error) => {
      setPermissions(DEFAULT_PERMISSIONS);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const getRolePermissions = (role) => {
    return permissions[role] || DEFAULT_PERMISSIONS.Customer;
  };

  /**
   * Check if a role can perform an action on a module.
   * @param {string} role
   * @param {string} module
   * @param {string} action - 'view'|'create'|'edit'|'delete'|'export' (or legacy 'read'|'write')
   */
  const canAccess = (role, module, action = 'view') => {
    if (module === 'profile') return true;
    if (role === 'Admin') return true;
    const rolePerms = getRolePermissions(role);
    if (!rolePerms[module]) return false;

    // Legacy compatibility: map old 'read'/'write' to new granular actions
    let resolvedAction = action;
    if (action === 'read') resolvedAction = 'view';
    if (action === 'write') resolvedAction = 'create';

    return rolePerms[module][resolvedAction] === true;
  };

  const updatePermissions = async (newPermissions, actingUser) => {
    try {
      const oldPerms = permissions;
      await setDoc(doc(db, 'settings', 'permissions'), newPermissions);

      // Log permission changes to audit log
      try {
        const changedRoles = Object.keys(newPermissions).filter(role => {
          return JSON.stringify(oldPerms[role]) !== JSON.stringify(newPermissions[role]);
        });
        if (changedRoles.length > 0) {
          await logActivity(
            actingUser?.identifier || 'system',
            actingUser?.name || 'Admin',
            'PERMISSION_CHANGED',
            'Admin',
            `Role permissions updated for: ${changedRoles.join(', ')}`
          );
        }
      } catch (logErr) {
        console.warn('[PermissionsContext] Could not log permission change:', logErr);
      }
    } catch (error) {
      console.error('Failed to update permissions:', error);
      alert('Failed to update permissions. You might not have admin rights.');
    }
  };

  return (
    <PermissionsContext.Provider value={{ permissions, setPermissions, getRolePermissions, canAccess, loading, updatePermissions }}>
      {children}
    </PermissionsContext.Provider>
  );
};

export const usePermissions = () => {
  return useContext(PermissionsContext);
};
