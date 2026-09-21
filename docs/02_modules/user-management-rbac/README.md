# User Management & RBAC

> Module map. Source: Phase 3 mapping pass (read-only). Line numbers are approximate. Firestore rule conditions for `users` create / update were not read in this pass; see [FIRESTORE_RULES_NOTES.md](../../03_security/FIRESTORE_RULES_NOTES.md).

## Files and folders

- UI: `src/components/admin/AdminPanel.jsx` ("System Overview": audit log viewer plus `PermissionsManager`), `AgentDatabase.jsx` ("User Management": users, enrolment, pending registrations, role / status, password reset), `PermissionsManager.jsx` (role-by-module matrix editor).
- State and constants: `src/context/PermissionsContext.jsx` (`DEFAULT_PERMISSIONS`, live `settings/permissions` sync, `canAccess`, `updatePermissions`), `src/constants/roles.js` (`SYSTEM_ROLES`, `PUBLIC_REGISTRATION_ROLES`, `ROLE_METADATA`, `getRoleCategory`), `src/services/adminUsers.js` (client wrapper for `/api/admin-user`), `src/services/auditLog.js` (`logActivity`).
- Server: `api/admin-user.js` (create, resetPassword, delete), `api/_lib/firebaseAdmin.js`.
- Rules and tests: `firestore.rules`, `tests/integration/firestoreRules.test.js`, `tests/integration/adminUser.test.js`.
- In `src/App.jsx`: Self-Healing Super Admin Guard (`isSuperAdminEmail`, guard around 603-613), sign-in / register / pending handling (~585-660, `handleRegister` ~770), `approvePending` (~803), Partner route lock (~277-283), `pendingUsers` subscription (~721).

## Firestore collections read/written

- `users/{email}`, `pendingUsers/{email}`, `settings/permissions`, `auditLog`, `partner_applications` (merged into the review queue; status set to Approved / Rejected).
- Writes to other modules' collections: **none found.** Approving a Partner or Business Client does not create `partners` or `customers` documents; `approvePending` only sets prefill state and switches tab.
- Rules (from the pass): `settings/permissions` read open, write admin only; `users` reads need auth, create / update / delete admin only with a role-escalation guard and bootstrap-admin exception; `pendingUsers` create open, owner reads own, admin reads / updates / deletes; `auditLog` create needs auth, read admin only, update / delete denied; `checkPermission` reads `settings/permissions` for every module's rules.

## Cloud Functions / triggers

No Cloud Functions. Client-side and Vercel:

- **Sign-up:** `handleRegister` calls `emailRegister`, writes `pendingUsers/{email}` without the password, logs `REGISTER` and signs the user out. A first-time Google / Auth login with no `users` doc creates a `pendingUsers` doc (role Customer, status Pending). Only the bootstrap super-admin emails skip the queue.
- **Approval:** `approvePending` does a `batchWrite`: sets `users/{email}` (`isApproved`, `status: Active`, `approvedAt`, `approvedBy`) and deletes the `pendingUsers` doc; logs `APPROVE`. No email is sent from approval itself; welcome emails are sent later from `Partners.jsx` / `Customers.jsx` when the handed-off form is submitted.
- **Partner application approval:** `AgentDatabase.jsx` calls `createUserAccount` (`api/admin-user.js` `create`).
- **Rejection:** `handleExecuteRejection` sends `registration_declined`. Other emails: `password_reset`, `employee_invite`.
- **Enrolment:** `createUserAccount`, `setDoc` to `users`, `logActivity('ENROLL')`, `employee_invite` email.
- **`api/admin-user.js`:** requires a Bearer ID token and that the caller's `users` doc is approved with role `Admin`; delete removes the Auth account only and treats a missing account as success.
- **Audit actions:** `DELETE`, `ROLE_CHANGE`, `STATUS_CHANGE`, `PASSWORD_RESET`, `ENROLL`, `APPROVE`, `REGISTER`, `LOGIN`, and permission updates (`PermissionsContext`).
- **Permission matrix:** stored at `settings/permissions`; seeded from `DEFAULT_PERMISSIONS` if missing and migrated from legacy `{read, write}`; `updatePermissions` writes the whole doc; the Admin entry is forced back to full access. Access levels: full, write, view, ops, none, custom (each sets view / create / edit / delete / export).
- **Roles:** Admin, Manager, Sales, Operations, Support, Accounts, Logistics, Partner, Business Client, Customer. Public registration allows only Partner and Business Client.
- **Matrix modules:** CRM (leads, pipeline, customers), Operations (projects, logistics), Finance (invoices, receipts, partners, calculator), System (dashboard, notifications, messages, agents, admin). No dedicated `quotations` entry was found (the `custom` group was not inspected).

## Depends on / called by

- Depends on: `firestoreSync`, `services/firebase`, `mailer` (`api/send-email.js`), `common` components, `toast`, `validation`, Partners / Customers (approval hand-off).
- Called by: every module (`canAccess`), and `Dashboard`, `Leads`, `Invoices`, `Customers`, `Partners`, `Receipts`, `UserProfile` (`logActivity`). `firestore.rules` uses the matrix for leads, deals, invoices, receipts, customers, partners, projects and logistics.

## Summary

Self-registrants and Google sign-ins land in `pendingUsers` (or `partner_applications`). Admins review them in `AgentDatabase.jsx`, and `approvePending` promotes each to `users/{email}`. Role permissions live in one `settings/permissions` document, edited in `PermissionsManager`, enforced client-side by `canAccess` and server-side by `firestore.rules`. Admin-only Auth create / reset / delete go through `api/admin-user.js`. Actions are recorded in `auditLog`. Two hardcoded emails self-heal to Admin.

## Open questions

- `CLAUDE.md` says `AgentDatabase.jsx` "auto-provisions a matching partners or customers record"; the code hands off to a pre-filled registration form instead. One of the two is out of date.
- Whether every matrix module (e.g. quotations, calculator, messages) has a matching rules-side `checkPermission` was not verified.
