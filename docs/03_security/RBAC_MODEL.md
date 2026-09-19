# RBAC Model

> Roles, per-module permissions, and how client and rules enforcement relate. Read directly from `src/context/PermissionsContext.jsx`, `src/constants/roles.js` and `firestore.rules`. The live matrix is the `settings/permissions` Firestore document, which admins can edit; the table below is the **default** seeded when that document is missing, not necessarily what is live.

## Roles

`SYSTEM_ROLES` (`src/constants/roles.js`): Admin, Manager, Sales, Operations, Support, Accounts, Logistics, Partner, Business Client, Customer. Public registration allows only Partner and Business Client (`PUBLIC_REGISTRATION_ROLES`). A first-time Google sign-in with no profile is provisioned as `Customer`, unapproved and Pending. `Operations` is the role labelled "Fabrication Master" in the UI. There is no Employee role; staff are `users` documents with one of the internal roles (see [employees.md](../02_modules/employees.md)).

## Permission matrix (defaults)

Actions per module: `view`, `create`, `edit`, `delete`, `export`. Presets in code: `full` (all five), `write` (view, create, edit), `read` (view), `ops` (view, create, edit, delete), `none`, plus custom objects.

| Module | Admin | Manager | Sales | Operations | Support | Accounts | Logistics | Partner | Customer / Business Client |
|---|---|---|---|---|---|---|---|---|---|
| dashboard | full | full | full | full | read | read | read | full | full |
| notifications | full | full | full | full | full | full | full | full | full |
| messages | full | full | full | full | full | full | full | **none** | full |
| leads | full | full | write | none | read | read | none | none | none |
| pipeline (Deals) | full | full | write | none | read | read | none | none | none |
| customers | full | full | write | read | read | read | read | none | none |
| partners | full | full | write | none | read | read | none | full | none |
| invoices | full | full | write | none | read | view/create/edit/export (no delete) | none | none | read |
| receipts | full | full | write | none | read | view/create/edit/export (no delete) | none | none | read |
| projects (Fabrication) | full | full | read | ops | read | read | read | none | read |
| logistics | full | full | read | ops | read | none | ops | none | read |
| agents (User Management) | full | read | none | none | none | none | none | none | none |
| calculator | full | full | full | full | none | view/create/edit/export | none | none | none |
| admin (System Overview) | full | read | none | none | none | none | none | none | none |

Modules present in the matrix: dashboard, notifications, messages, leads, pipeline, customers, partners, invoices, receipts, projects, logistics, agents, calculator, admin. **There is no `quotations` module** in the matrix.

## Client enforcement

- `usePermissions()` exposes `canAccess(role, module, action?)`; `App.jsx` uses it to decide which nav links and routes render. Every module calls it.
- `PermissionsContext` seeds `DEFAULT_PERMISSIONS` if `settings/permissions` is missing, migrates legacy `{read, write}` entries, and writes the whole document on `updatePermissions`. `PermissionsManager.jsx` forces the Admin entry back to full access.
- **Partner routing is restricted redundantly** in `App.jsx`'s route guard (dashboard, notifications, partners, profile only) in addition to the matrix.
- Access levels in the editor: full, write, view, ops, none, custom.

## Firestore rules enforcement

`checkPermission(module, action)` in `firestore.rules` re-reads the same `settings/permissions` document and the caller's `users/{email}` role. It maps `read` to `view`, and `write` to `create` or `edit`. Admin always passes. Details and gaps are in [FIRESTORE_RULES_NOTES.md](FIRESTORE_RULES_NOTES.md).

## Bootstrap admins

Two hardcoded owner emails are treated as a self-healing super-admin: forced back to `Admin` / Active on every login in `App.jsx` (`BOOTSTRAP_ADMIN_EMAILS`, `isSuperAdminEmail`), and mirrored in `firestore.rules` (`isBootstrapSuperAdmin`). Intentional per the project instructions; the two lists must be edited together.

## Where the three layers must stay in sync

1. `src/context/PermissionsContext.jsx`: `DEFAULT_PERMISSIONS` and `canAccess`.
2. `firestore.rules`: `checkPermission` and each collection block.
3. `src/constants/roles.js`: `SYSTEM_ROLES`, `PUBLIC_REGISTRATION_ROLES`, `ROLE_METADATA`.

## Open questions

- The live `settings/permissions` document may differ from the defaults above; it has not been read.
- `CLAUDE.md` says approval auto-provisions partners / customers records; the code pre-fills forms instead ([user-management-rbac.md](../02_modules/user-management-rbac.md)).
