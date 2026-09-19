# Firestore Rules Notes

> Notes on `firestore.rules` (240 lines), read directly from the file. This documents the **committed** rules. The rules actually enforced in production are whatever was last deployed with `firebase deploy --only firestore:rules`; that has not been compared here.

## Structure

`rules_version = '2'`, one `match /databases/{database}/documents` block, per-collection blocks, and a final catch-all `match /{document=**} { allow read, write: if false; }`. The same file is deployed to three databases (`firebase.json`: `(default)` and two `ai-studio-*` databases).

## Helper functions

- `isAuthenticated()`, `hasRole(role)` (looks up `users/{token.email}`), `isAdmin()` (role `admin` or `Admin`).
- `isBootstrapSuperAdmin(email)`: two hardcoded owner emails; mirrors the client self-healing admin guard.
- `checkPermission(module, action)`: Admin passes; otherwise requires the caller's `users` doc and `settings/permissions` to exist and the role's module entry to have `action` true. `read` also accepts `view`; `write` also accepts `create` or `edit`. **It does not check `isApproved` or `status`.**

## Collections and their rules

| Collection | Read | Write |
|---|---|---|
| `settings/permissions` | **anyone, including signed-out** | Admin only |
| `users/{email}` | authenticated | create: Admin, or self as Customer / unapproved / Pending, or bootstrap admin as Admin; update: Admin, or self without changing `role`, `isApproved`, `status` (or bootstrap admin); delete: Admin |
| `pendingUsers/{email}` | own doc, or Admin | create by anyone (signed-out too); update / delete Admin |
| `partner_applications` | Admin | create by anyone; update / delete Admin |
| `leads` | `leads` view | create: `leads` create, **or any request with `source == 'Referral'`** (no auth check); update: edit; delete Admin |
| `deals` | `pipeline` view | `pipeline` create / edit; delete Admin |
| `quotations` | **any authenticated user** | **any authenticated user** |
| `counters` | any authenticated | any authenticated |
| `invoices` | `invoices` view, or own (`customerId` / `partnerId` == token email) | `invoices` create / edit; delete Admin |
| `receipts` | `receipts` view, or own | `receipts` create / edit; delete Admin |
| `customers` | `customers` view | create / edit; delete: `customers` delete or Admin |
| `partners` | `partners` view, or own (doc id == token email) | create / edit; delete: `partners` delete or Admin |
| `projects` | `projects` view, or own customer | create / edit; delete Admin |
| `logistics` | `logistics` view, or own customer | create / edit; delete Admin |
| `pricing` | authenticated | Admin |
| `messages` | any authenticated | create any authenticated; update Admin, sender, or a participant changing only `readBy`; delete Admin or sender within 15 minutes |
| `typing_indicators` | any authenticated | any authenticated |
| `auditLog` | Admin | create any authenticated; update / delete denied |
| `test` | anyone | none |
| everything else | denied (catch-all) | denied |

## Observations from reading the file (not a review; recorded because they affect how the app behaves)

- **No rule exists for `referral_claims` or `partner_payouts`.** Both are in `COLLECTIONS` and `referral_claims` is written from `Partners.jsx`; under the committed rules the catch-all denies those writes. The live rules may differ.
- **The `deals` rule block is unused by the app:** deals are stored as `leads` documents (`isDeal: true`), so deals are governed by the `leads` rules and the `leads` permission, not `pipeline`.
- **`quotations` is not permission-gated:** any authenticated user (including Partner, Customer, Business Client) can read and write every quotation.
- **`messages` reads are not restricted to participants.** The client filters by `participants`, but the rules let any authenticated user read all messages, and the `messages` permission (Partner: none) is not checked here.
- **`checkPermission` ignores `status` / `isApproved`:** any user with a `users` doc and a role keeps rule-level access even if marked deactivated, unless their Firebase Auth account is also disabled. Client and `api/*` gates do check approval / status.
- **Anonymous creates are allowed** on `pendingUsers`, `partner_applications`, and `leads` with `source == 'Referral'` (needed for the public forms); `settings/permissions` is world-readable.
- `counters` is writable by any authenticated user (invoice / receipt numbering is transactional in the client, not enforced here).
- The `users` create / update guard means a non-admin cannot change their own `role`, `isApproved` or `status` (matches the intent stated in the file's comments and `tests/integration/firestoreRules.test.js`).

## Deployment (rules are not deployed by Vercel)

Editing `firestore.rules` and pushing to `staging` or `main` only changes the file in git. Rules go live only with `firebase deploy --only firestore:rules --project print-to-frame-erp`. `firebase.json` maps the same file to three databases; confirm which one the app uses (`VITE_FIREBASE_DATABASE_ID`, default `(default)`). A rules edit that is merged but never deployed silently keeps the old ruleset; this caused a live admin lockout once (see [CLAUDE.md](../../CLAUDE.md)).

## Tests

`npm run test:rules` runs `tests/integration/*` against a local Firestore + Auth emulator (needs Java; project id `demo-print2frame-test`). `firestoreRules.test.js` covers role-escalation prevention.

## Open questions

- Compare the deployed rules with this file (not done).
- Are the `deals` block and the `pipeline` module intended to guard a `deals` collection that no longer exists?
