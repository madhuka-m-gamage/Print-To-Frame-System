# Employees: module notes for Claude

Full map: [README.md](README.md). Cross-module chains: [CROSS_MODULE_TRIGGERS.md](../../01_architecture/CROSS_MODULE_TRIGGERS.md). Review findings: [FINDINGS.md](FINDINGS.md). There are no Cloud Functions; all automation is client code (`src/App.jsx`, components) or `api/*.js`.

## What it does

There is no separate Employees feature; employee-like data is the `users` collection managed in User Management. No HR data exists.

## Code

- No Employees module. Staff are `users` documents: see [user-management-rbac.md](../user-management-rbac/README.md).
- Drivers and vehicles are stored in `settings/fleet` (FEA-4, Admin-edited); `DRIVER_DIRECTORY` in `logisticsEngine.js` is only the fallback. Linking drivers to `users` (D2) is not done.

## Firestore collections it owns or writes

- `users`, `pendingUsers`, `auditLog`.

## Triggers and side effects

- Enrolling creates an Auth account (`api/admin-user.js`), the `users` doc, an `ENROLL` audit entry and an `employee_invite` email.
- Approving a registration into a staff role (outside `ROLE_CATEGORIES.EXTERNAL`) sends `employee_approved` after `users/{email}` is written; a partner application approved into a staff role gets `employee_invite` with the password the admin set (FEA-8, D6).

## Before you edit

- Decide whether an Employees module is planned before adding one; do not create an `employees` collection without updating rules, RBAC and these docs.
- Roles "Sales Executive" and "Fabricator" do not exist; use `Sales` and `Operations`.
