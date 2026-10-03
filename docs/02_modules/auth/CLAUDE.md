# Auth (Google Sign-In): module notes for Claude

Full map: [README.md](README.md). Audit findings: [FINDINGS.md](FINDINGS.md). Cross-module chains: [CROSS_MODULE_TRIGGERS.md](../../01_architecture/CROSS_MODULE_TRIGGERS.md). There are no Cloud Functions; all automation is client code (`src/App.jsx`, components) or `api/*.js`.

## What it does

Firebase Auth via Google popup or email / password; an approval gate against `users` / `pendingUsers`; Vercel endpoints verify ID tokens and re-check approval.

## Code

- `src/features/auth/Login.jsx`, `src/services/firebase.js`, auth gate in `src/App.jsx`, `api/_lib/firebaseAdmin.js`, `api/*.js`

## Firestore collections it owns or writes

- Reads `users`; writes `pendingUsers` (always signed in with a verified email, doc id = the login email, `uid` = the login uid: the rules refuse anything else, SEC-13 and SEC-15), `registrationDrafts/{uid}` (email sign-up form data until the email is verified), and `users` for bootstrap admins and photo sync; `auditLog` (`LOGIN`, `REGISTER`).

## Triggers and side effects

- Unapproved users are queued and signed out. Two bootstrap emails self-heal to Admin every login; the list and `isSuperAdminEmail` live in `src/features/auth/superAdmin.js` (mirrored by `isBootstrapSuperAdmin()` in `firestore.rules`).
- `api/*`: Bearer ID token (revocation checked), approved / active user, `Admin` role for `admin-user`.

## Before you edit

- Google scopes at sign-in: identity only. Drive and Contacts are for the super admin only (owner decision DEC-8): `getScopedAccessToken` refuses anyone else before any popup (`assertGoogleWorkspaceAllowed`), and the Drive and Contacts buttons render only when `canUseGoogleWorkspace(currentUser)`. Drive uses Google Picker with the narrow `drive.file` scope (`pickDriveFiles` in `src/services/driveService.js`); Contacts still uses `contacts.readonly`. `driveService` and `contactsService` call `getScopedAccessToken(scope)`, which opens a consent popup for that one scope (so start them from a click), caches it per scope for 55 minutes and clears it on sign-out. See [FINDINGS.md](FINDINGS.md) DP-01.
- `authDomain` falls back to `auth.print2frame.xyz` (from `firebase-applet-config.json`), not `print-to-frame-erp.firebaseapp.com`; authorized domains live only in the Firebase Console.
- Never print or commit `.env` values or the service-account JSON.
- A sign-up in progress sets `registeringRef`; the auth listener then waits for `handleRegister` instead of writing a shell pending record (`newUserAction`). A signed-in user whose own record becomes deactivated, disabled or unapproved is signed out at once (`shouldEvict`, run by `syncSelf` from the listener on the user's own `users` document in `App.jsx`); bootstrap admins are exempt. Keep that own-document listener: the rules refuse the `users` collection listener to a Deactivated caller, so it never delivers the record that evicts them (SEC-11). `LOGIN` is audit logged when the auth listener accepts a session.
- Verified email (SEC-15): `handleRegister` sends the verification mail (`sendVerificationEmail`), saves the form data without the password to `registrationDrafts/{uid}` and signs out. On a first sign-in with no record, `newUserAction` returns `verify_email` for an unverified login (mail resent, signed out with a "verify your email" message); a verified login files `pendingUsers` from the draft (`name`, `role`, `mobile`, `company`, `specialty` only) or, with no draft (Google), as Customer, then deletes the draft. Bootstrap admins skip this.
- Login gate (SEC-11): an existing `users` record starts a session only if `canSignIn(record, isBootstrapAdmin)` in `src/features/auth/authFlow.js` passes. A Deactivated or Disabled status is refused even with `isApproved: true` (the shape the Deactivate button leaves), as is `isApproved === false`; otherwise `isApproved`, `status === 'Active'` or no status (legacy) is admitted. Bootstrap admins always pass and self-heal.
