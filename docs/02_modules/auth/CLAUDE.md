# Auth (Google Sign-In): module notes for Claude

Full map: [../auth.md](../auth.md). Audit findings: [FINDINGS.md](FINDINGS.md). Cross-module chains: [CROSS_MODULE_TRIGGERS.md](../../01_architecture/CROSS_MODULE_TRIGGERS.md). There are no Cloud Functions; all automation is client code (`src/App.jsx`, components) or `api/*.js`.

## What it does

Firebase Auth via Google popup or email / password; an approval gate against `users` / `pendingUsers`; Vercel endpoints verify ID tokens and re-check approval.

## Code

- `src/components/auth/Login.jsx`, `src/services/firebase.js`, auth gate in `src/App.jsx`, `api/_lib/firebaseAdmin.js`, `api/*.js`

## Firestore collections it owns or writes

- Reads `users`; writes `pendingUsers`, and `users` for bootstrap admins and photo sync; `auditLog` (`LOGIN`, `REGISTER`).

## Triggers and side effects

- Unapproved users are queued and signed out. Two bootstrap emails self-heal to Admin every login.
- `api/*`: Bearer ID token (revocation checked), approved / active user, `Admin` role for `admin-user`.

## Before you edit

- Google scopes requested: identity only. Drive and Contacts code calls the APIs with that token; `CLAUDE.md` claims otherwise. Accepted architecture: keep identity scopes for core sign-in; implement on-demand incremental authorization for Drive/Contacts (see [FINDINGS.md](FINDINGS.md)).
- `authDomain` falls back to `auth.print2frame.xyz` (from `firebase-applet-config.json`), not `print-to-frame-erp.firebaseapp.com`; authorized domains live only in the Firebase Console.
- Never print or commit `.env` values or the service-account JSON.
