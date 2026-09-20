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
- `counters` (updated in step 3.4): only the prefixes `INV-ADV`, `INV-FIN`, `L-DL`, `L-PK`, `PTF`, `QT`, holding a single positive integer that can step ahead by at most one. Lowering a counter is still allowed, because a strict "must increase" check rejects legitimate transactions under contention; closing that needs server-side numbering.
- Step 3.4 also added: `isAdmin()` accepts the bootstrap owner emails; a pending applicant may update (not approve) their own `pendingUsers` record; customers may read and update their own record's profile fields (`name`, `photoURL`, `phone`, `address`); new `referral_claims` and `partner_payouts` blocks. **Not applied:** public read of Active partners (partners D-5), because a partner document holds bank details and rules cannot hide fields.
- The `users` create / update guard means a non-admin cannot change their own `role`, `isApproved` or `status` (matches the intent stated in the file's comments and `tests/integration/firestoreRules.test.js`).

## Step 3.5 (restrictive rules; not deployed)

- `checkPermission` and `isAdmin()` (except for the bootstrap emails) require `isActiveUser()`: status `Deactivated` or `Disabled` is always denied; otherwise `isApproved == true` or `status == 'Active'`. A document with neither field is denied.
- `/quotations` follows the `quotations` permission, so the live matrix must have that module (step 3.3) before this deploys, or Sales and Manager lose quotations.
- `/messages`: read needs the `messages` permission and being a participant (or Admin); create needs `fromId` to be the caller and a participant; only `readBy` and `updatedAt` may change on a message you did not send.
- `/users`: read for Admin, self, or `agents`/`messages` view. Create, update and delete by a role with the matching `agents` permission are allowed only on non-Admin targets, never granting Admin and never on your own document.
- `/pendingUsers` and `/partner_applications` may also be reviewed by roles with `agents` edit.
- `/leads`: read with `leads` or `pipeline`; create and update check `pipeline` when the document is a deal (`isDeal`), else `leads`; delete follows `leads` delete. Invoices, receipts, projects and logistics deletes follow their own `delete` permission.
- Not done: limiting the Partner role to its own `partners` document (the Partners screen still lists the whole collection), and field limits on what a partner may edit about themselves.

## Deployment (rules are not deployed by Vercel)

Editing `firestore.rules` and pushing to `staging` or `main` only changes the file in git. Rules go live only with `firebase deploy --only firestore:rules --project print-to-frame-erp`. `firebase.json` maps the same file to three databases; confirm which one the app uses (`VITE_FIREBASE_DATABASE_ID`, default `(default)`). A rules edit that is merged but never deployed silently keeps the old ruleset; this caused a live admin lockout once (see [CLAUDE.md](../../CLAUDE.md)).

## Tests

`npm run test:rules` runs `tests/integration/*` against a local Firestore + Auth emulator (needs Java; project id `demo-print2frame-test`). `firestoreRules.test.js` covers role-escalation prevention. `rulesAccess.test.js` (B4) covers permission-gated writes, owner reads, the audit log and the public forms, and records each gap listed in the observations above as a characterisation test, with `it.todo` entries for the target rules. Note the Partner matrix grants full `partners` access, so a partner can read other partners today.

## Open questions

- Compare the deployed rules with this file (not done).
- Are the `deals` block and the `pipeline` module intended to guard a `deals` collection that no longer exists?
