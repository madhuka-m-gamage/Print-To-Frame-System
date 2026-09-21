# Employees

> Module map. Source: Phase 3 mapping pass (read-only). Line numbers are approximate.

## Files and folders

**There is no separate Employees module.** No `employees` or `staff` collection, component or route exists. Employee-like data lives in the `users` collection, managed on the "User Management" tab (`activeTab === "agents"`), so the working files are documented in [user-management-rbac.md](../user-management-rbac/README.md). Employee-related pieces:

- `src/features/admin/AgentDatabase.jsx`: enrol users, role / status change, photo, delete, password reset, approve / reject pending registrations.
- `src/constants/roles.js`: 10 system roles: Admin, Manager, Sales, Operations, Support, Accounts, Logistics, Partner, Business Client, Customer. Roles named "Sales Executive" or "Fabricator" do not exist (closest: `Sales`, `Operations`).
- `src/features/logistics/logisticsEngine.js`: `DRIVER_DIRECTORY`, a **hardcoded** list of 4 named drivers / fabricators, not stored in Firestore; used by `Logistics.jsx` and `LogisticsCardDetails.jsx`.
- `api/admin-user.js` and `src/features/admin/adminUsers.js`: Auth account create / reset / delete (Admin only).
- Email template `employee_invite` (`src/constants/emailTemplates.js`).

## Firestore collections read/written

`users` (keyed by lowercased email), `pendingUsers`, `partner_applications`, `auditLog`, `settings/permissions`. See [user-management-rbac.md](../user-management-rbac/README.md).

## Cloud Functions / triggers

No Cloud Functions. Enrolling a user creates the Auth account (`api/admin-user.js`), writes `users/{email}`, logs `ENROLL` and sends the `employee_invite` email. Password reset sends `password_reset`. All admin actions write to `auditLog`.

## Depends on / called by

`firestoreSync`, `auditLog`, `adminUsers`, `mailer`, `PermissionsContext`, Logistics (driver list).

## Summary

Staff are `users` documents with a role from `SYSTEM_ROLES`, managed by admins in User Management. There is no HR data (attendance, payroll, contracts, employee IDs); the only staff-like data outside `users` is the hardcoded driver directory.

## Open questions

- Is an Employees module (HR data) planned, or is `users` intended to be the employee record? The doc tree lists Employees as a module; the code has none.
- The hardcoded driver list is a candidate to move into Firestore if drivers change.
