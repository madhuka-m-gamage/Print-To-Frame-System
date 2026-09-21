# User Management & RBAC: module notes for Claude

Full map: [README.md](README.md). Cross-module chains: [CROSS_MODULE_TRIGGERS.md](../../01_architecture/CROSS_MODULE_TRIGGERS.md). Review findings: [FINDINGS.md](FINDINGS.md). There are no Cloud Functions; all automation is client code (`src/App.jsx`, components) or `api/*.js`.

## What it does

Registration queue, admin approval, role and status management, password reset, and the role-by-module permission matrix stored at `settings/permissions`.

## Code

- `src/features/admin/AdminPanel.jsx`, `AgentDatabase.jsx`, `PermissionsManager.jsx`
- `src/context/PermissionsContext.jsx`, `src/constants/roles.js`, `src/features/admin/adminUsers.js`, `auditLog.js`; `api/admin-user.js`; `firestore.rules`

## Firestore collections it owns or writes

- `users`, `pendingUsers`, `settings/permissions`, `auditLog`; sets `partner_applications` status.

## Triggers and side effects

- `approvePending` batch-writes `users` and deletes `pendingUsers`. It does **not** create partners / customers; it pre-fills their registration form.
- `api/admin-user.js` needs an Admin caller; delete removes the Auth account only.

## Before you edit

- The permission matrix is enforced in three places that must stay in sync: `PermissionsContext.jsx`, `firestore.rules` (`checkPermission`), `roles.js`. See [RBAC_MODEL.md](../../03_security/RBAC_MODEL.md).
- Never make `role`, `isApproved` or `status` client-settable outside the approve / self-heal paths (see the top of the `users` block in the rules).
- The two bootstrap admin email lists (App.jsx and rules) must be edited together.

- `DEFAULT_PERMISSIONS` does not change the live matrix; `settings/permissions` needs the 3.3 migration. `PERMISSIONS_FIXTURE` in `tests/helpers/emulator.js` is a hand-kept copy (synced at Phase 7 3.2). `App.jsx` opens each Firestore listener only when the role can read that module. Only Admin holds the `admin` (System Overview) module; `agents` stays delegable to Manager.

- `api/admin-user.js` accepts Admin and Manager callers, rejects Deactivated/Disabled callers, and refuses a Manager acting on an Admin account or granting Admin. Only the Firebase Auth account is handled here; role changes are Firestore writes governed by the rules.

- Step 3.5 rules (written, not deployed): active-account check in `checkPermission`; Managers with `agents` may administer non-Admin users; see `docs/03_security/FIRESTORE_RULES_NOTES.md`. Deploy order: matrix migration (3.3), additive rules (3.4d), then these.
