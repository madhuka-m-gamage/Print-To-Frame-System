# Auth (Google Sign-In)

> Module map. Source: Phase 3 mapping pass (read-only), OAuth scopes and `authDomain` spot-checked in `src/services/firebase.js`. No secret values are recorded here, only variable names.

## Files and folders

- `src/features/auth/Login.jsx`: login / register UI; `googleSignIn`; shows an `unauthorized-domain` hint for admins.
- `src/services/firebase.js`: Firebase init and config, Google provider, `initAuth`, `googleSignIn`, `getAccessToken`, `getScopedAccessToken`, `logout`, `handleFirestoreError`, `emailLogin`, `emailRegister`. Exports `db`, `auth`, `storage`.
- `src/App.jsx`: `BOOTSTRAP_ADMIN_EMAILS` / `isSuperAdminEmail`, the auth listener and approval gate (~574-682), `handleLogin`, `handleRegister`, `approvePending`, `users` and `pendingUsers` listeners.
- `src/main.jsx`: optional Sentry init (only if `VITE_SENTRY_DSN` is a valid http(s) value).
- `api/_lib/firebaseAdmin.js` (Admin SDK from `FIREBASE_SERVICE_ACCOUNT_JSON`, raw JSON or base64; `getAdminAuth`, `getAdminFirestore`) and `api/admin-user.js`, `api/generate.js`, `api/send-email.js` (verify ID tokens).
- `firebase-applet-config.json` (fallback web config), `src/constants/roles.js` (`PUBLIC_REGISTRATION_ROLES`), `firestore.rules`.

## Firestore collections read/written

- `users/{lowercased email}`: read at login; written for the photoURL sync, the super-admin self-heal and the bootstrap-admin auto-create.
- `pendingUsers/{email}`: written for a first-time non-admin Google sign-in and for email registration; admins listen to it.
- `partners`: photoURL sync. `auditLog` via `logActivity` (`LOGIN`, `REGISTER`). Server side: all three `api/` endpoints read `users/{decodedToken.email}`.
- `test/connection`: connectivity probe in `firebase.js`.

## Cloud Functions / triggers

No Cloud Functions. Flows:

- **Config:** each `VITE_FIREBASE_*` variable (PROJECT_ID, APP_ID, API_KEY, AUTH_DOMAIN, DATABASE_ID, STORAGE_BUCKET, MESSAGING_SENDER_ID, OAUTH_CLIENT_ID) falls back to `firebase-applet-config.json`. `authDomain` ignores the default `print-to-frame-erp.firebaseapp.com` env value and falls back to the config file's custom domain **`auth.print2frame.xyz`**. Firestore database id falls back to `(default)`.
- **Google:** `signInWithPopup`. **Only** `userinfo.email` and `userinfo.profile` scopes are requested (`firebase.js` lines 44-45). The access token is cached in a module variable and in `sessionStorage` (`ptf_google_access_token`), cleared on logout / auth null.
- **Email / password:** `handleRegister` creates the account, writes `pendingUsers/{identifier}` without the password, then signs out with a "wait for admin approval" message.
- **Approval gate:** `users` doc exists: allowed if `isApproved`, or `status === 'Active'`, or status undefined, or a bootstrap admin; else signed out ("disabled or deactivated"). No `users` doc but a `pendingUsers` doc: signed out ("pending"). Neither: bootstrap-admin emails get an auto-created Admin profile; everyone else gets a `pendingUsers` doc (role Customer, status Pending) and is signed out. Firestore error: signed out ("Database access denied"). Two hardcoded bootstrap emails are forced back to Admin / Active on every login. A distinct "Rejected" status is not handled in the client.
- **API authentication (all three endpoints):** require `Authorization: Bearer <idToken>` (401), `verifyIdToken(idToken, true)` so revoked tokens fail (401), then require the caller's `users` doc approved / active (403). `admin-user.js` also requires `role === 'Admin'`. A missing service-account variable surfaces as a 500. Each handler sets its own CORS headers.

## Depends on / called by

Depends on `firebase/*`, `firebase-admin`, `@sentry/react`, `firestoreSync`, `logActivity`, `roles.js`, `firestore.rules`. Depended on by everything that imports `services/firebase` (`App.jsx`, `Messages.jsx`, `MessagingContext.jsx`, `PermissionsContext.jsx`, `UserProfile.jsx`, `PartnerRegistration.jsx`, `AgentDatabase.jsx`, `ReferralForm.jsx`, `Partners.jsx`, `contactsService.js`, `driveService.js`).

## Summary

Client-driven Firebase Auth via Google popup or email / password. After sign-in `App.jsx` looks up `users/{email}`; approved or active users get in, others are queued in `pendingUsers` and signed out. Two hardcoded bootstrap admins self-heal as Admin. The Vercel `api/` endpoints verify the Firebase ID token with the Admin SDK and repeat the approval check.

## Open questions

- **Scope mismatch (resolved in Phase 7 5.1):** sign-in requests identity scopes only. `driveService.js` (`drive.readonly`) and `contactsService.js` (`contacts.readonly`) now get their token from `getScopedAccessToken(scope)`, an on-demand consent popup cached per scope for 55 minutes. Not tested against the live app.
- There is no `functions/` folder (an empty placeholder was removed in Phase 7 8.2).
- Authorized domains in Firebase Console (Authentication > Settings) are not visible from the repo.
