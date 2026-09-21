# Auth (Google Sign-In): module notes for Claude

Full map: [README.md](README.md). Audit findings: [FINDINGS.md](FINDINGS.md). Cross-module chains: [CROSS_MODULE_TRIGGERS.md](../../01_architecture/CROSS_MODULE_TRIGGERS.md). There are no Cloud Functions; all automation is client code (`src/App.jsx`, components) or `api/*.js`.

## What it does

Firebase Auth via Google popup or email / password; an approval gate against `users` / `pendingUsers`; Vercel endpoints verify ID tokens and re-check approval.

## Code

- `src/features/auth/Login.jsx`, `src/services/firebase.js`, auth gate in `src/App.jsx`, `api/_lib/firebaseAdmin.js`, `api/*.js`

## Firestore collections it owns or writes

- Reads `users`; writes `pendingUsers`, and `users` for bootstrap admins and photo sync; `auditLog` (`LOGIN`, `REGISTER`).

## Triggers and side effects

- Unapproved users are queued and signed out. Two bootstrap emails self-heal to Admin every login.
- `api/*`: Bearer ID token (revocation checked), approved / active user, `Admin` role for `admin-user`.

## Before you edit

- Google scopes at sign-in: identity only. `driveService` and `contactsService` call `getScopedAccessToken(scope)`, which opens a consent popup for that one scope (so start them from a click), caches it per scope for 55 minutes and clears it on sign-out. See [FINDINGS.md](FINDINGS.md) DP-01.
- `authDomain` falls back to `auth.print2frame.xyz` (from `firebase-applet-config.json`), not `print-to-frame-erp.firebaseapp.com`; authorized domains live only in the Firebase Console.
- Never print or commit `.env` values or the service-account JSON.
- A sign-up in progress sets `registeringRef`; the auth listener then waits for `handleRegister` instead of writing a shell pending record (`newUserAction`). A signed-in user whose own record becomes deactivated, disabled or unapproved is signed out at once (`shouldEvict`, users listener in `App.jsx`); bootstrap admins are exempt. `LOGIN` is audit logged when the auth listener accepts a session.
