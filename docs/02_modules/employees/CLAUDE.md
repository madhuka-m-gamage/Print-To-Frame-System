# Employees: module notes for Claude

Full map: [../employees.md](../employees.md). Cross-module chains: [CROSS_MODULE_TRIGGERS.md](../../01_architecture/CROSS_MODULE_TRIGGERS.md). There are no Cloud Functions; all automation is client code (`src/App.jsx`, components) or `api/*.js`.

## What it does

There is no separate Employees feature; employee-like data is the `users` collection managed in User Management. No HR data exists.

## Code

- No Employees module. Staff are `users` documents: see [user-management-rbac.md](../user-management-rbac.md).
- `src/utils/logisticsEngine.js` has a hardcoded `DRIVER_DIRECTORY`.

## Firestore collections it owns or writes

- `users`, `pendingUsers`, `auditLog`.

## Triggers and side effects

- Enrolling creates an Auth account (`api/admin-user.js`), the `users` doc, an `ENROLL` audit entry and an `employee_invite` email.

## Before you edit

- Decide whether an Employees module is planned before adding one; do not create an `employees` collection without updating rules, RBAC and these docs.
- Roles "Sales Executive" and "Fabricator" do not exist; use `Sales` and `Operations`.
