# Authorization map: every place that can grant, check or bypass access

Read from the code on 2026-09-21 (staging at the time, live rules equal to `main`). This answers one question: is there a hidden file that overrides the permission rules? **No.** There are seven enforcement points, listed below with what each can and cannot do. Where a claim depends on the live project (not the repository) it says so.

## How the layers combine

- **Firestore rules do not override each other.** Every `allow` that matches a request is combined with OR, so one broad `allow` anywhere wins. The final `match /{document=**} { allow read, write: if false; }` does **not** take priority over the others; it only denies paths that nothing else allows. So the way to find an over-permissive rule is to list the broad `allow` statements (below), not to look for a higher-priority file.
- **Client checks are for the interface only.** `canAccess` hides buttons and screens. Anyone with a valid sign-in can call Firestore directly, so only the rules protect data.
- **Server code using the Firebase Admin SDK ignores Firestore rules completely.** That is the one place where higher permission exists; there are only three such endpoints.

## The seven enforcement points

| # | Where | What it decides | Notes |
|---|---|---|---|
| 1 | `firestore.rules` (deployed by hand) | Who can read and write each collection | **Live rules are the old ones (= `main`)**; the stricter set on `staging` is written and tested but not deployed |
| 2 | `settings/permissions` (Firestore document) | The role by module matrix that `checkPermission` reads | Editable by Admin; live copy last changed 2026-09-01 |
| 3 | `src/context/PermissionsContext.jsx` | `canAccess(role, module, action)` for screens and listeners | Returns false for a module a role does not have; Admin always true |
| 4 | Role string checks in components | Extra buttons, for example delete only for Admin | About 55 in `src/`; interface only, cannot grant data access |
| 5 | Bootstrap admins (`isSuperAdminEmail` in `src/App.jsx`, `isBootstrapSuperAdmin` in the rules on `staging` and live) | Two Gmail identities are always Admin and self-heal | Intentional; whoever controls those two Google accounts controls the system |
| 6 | `api/admin-user.js`, `api/generate.js`, `api/send-email.js` | Admin SDK actions with the service-account credential | See "Server endpoints" |
| 7 | Vite dev proxy in `vite.config.js` | Re-implements the three endpoints for `npm run dev` | Development only, not part of the production build; see "Findings" |

Not present (checked): custom auth claims, Cloud Functions, any other server code, any other Admin SDK use. Firebase Storage has no active rules in the live project, and the two extra `ai-studio-...` Firestore databases are unused.

## Server endpoints (Admin SDK, bypass the rules)

| Endpoint | Caller must be | Can do |
|---|---|---|
| `api/admin-user.js` | signed in, approved, role Admin or Manager (a Manager cannot touch Admin accounts) | create, reset the password of, or delete Firebase Auth accounts |
| `api/generate.js` | signed in and approved, **any role** | send a prompt to Gemini (spends the quota) |
| `api/send-email.js` | signed in, approved and not Deactivated or Disabled, with a **staff role** (Partner, Business Client and Customer are refused) | send one of seven fixed templates (`client_approval`, `client_activation_confirmed`, `partner_approval`, `partner_activation_confirmed`, `employee_invite`, `password_reset`, `registration_declined`) to the address given. Free-form subject and body are not accepted. Fixed in the send-email hardening of 2026-09-21 |

## Findings

1. **Fixed (2026-09-21): any approved account could send email as the company.** `api/send-email.js` had no role check and accepted a free subject and body, so a Partner, Customer or Business Client account could send arbitrary messages from the company mailbox. It now needs a staff role, accepts only seven fixed templates, and rejects Deactivated and Disabled accounts. **Still open:** the recipient is not checked, so a staff account (or someone holding a staff session) can still send those seven templates to any address; checking the recipient against known records was left out because some approval flows email an address before its record exists (backlog).
2. **Any approved account can call the AI endpoint** and spend the Gemini quota. Lower risk; limit to roles that use it.
3. **The dev proxy skips authentication for creating and resetting Auth users.** It runs only under `npm run dev`, which binds to `0.0.0.0`, so on a shared network anyone who can reach the developer's machine could call it while a real service-account key is in `.env.local`. Fix: bind to localhost by default and require the same token checks as production.
4. **Live rules are much broader than the matrix suggests**, and the matrix is not consulted for these: any signed-in account can read and write all `quotations` and all `counters`, read every `messages` document and every `users` profile, and read `pricing`. There is no check that the account is active, so a deactivated user with a valid session keeps this access. The rules on `staging` close these; they are not deployed (`docs/04_workflows/LIVE_ROLLOUT.md`).
5. **Public writes exist by design:** anyone, signed in or not, can create a `pendingUsers` record, a `partner_applications` record, and a `leads` record whose `source` is `Referral`. Anyone can read `settings/permissions`. These support the public forms; they accept any fields.
6. **Cannot be seen from the repository, check in the consoles:** who has access to the Firebase project (IAM), what role the service account stored in Vercel holds (the default Firebase Admin SDK account is powerful), and who can edit the Vercel environment variables.

## What would settle it empirically

The rules tests run each rule against the emulator, but with a small fixed matrix. A test that loads the live matrix into the emulator and prints, for every role, collection and operation, whether the deployed rules and the new rules allow it would show the real effective access in one table and expose any surprise. It is not built yet (see the backlog in `PLAN.md`).
