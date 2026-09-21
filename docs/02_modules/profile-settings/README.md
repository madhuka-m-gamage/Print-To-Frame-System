# User Profile & Settings

> Module map. Source: Phase 3 mapping pass (read-only). Line numbers are approximate. Firestore rules were not examined for profile edits.

## Files and folders

- `src/components/common/UserProfile.jsx`: the profile page (lazy-loaded; tab `profile`).
- `src/components/common/ui/ImageCropModal.jsx`: photo cropping (via `common/ui`).
- `src/App.jsx`: theme state and toggle, `handleUpdateUser`, `handleSignOut`.
- `src/constants/companyInfo.js` (`COMPANY_INFO`): a static object **not imported anywhere** under `src`.
- Integrations that use the sign-in token but have no settings UI: `GoogleDrivePickerModal.jsx`, `driveService.js`, `contactsService.js`, `ContactSyncModal.jsx`, `getAccessToken` in `services/firebase.js`.
- Related: `PermissionsContext.jsx`, `roles.js`. **There is no dedicated settings screen** and no dashboard-preferences UI.

## Firestore collections read/written

- `users/{lowercased identifier}`: `setDoc(..., { merge: true })` with name, contactNumber, company, location, jobTitle, bio, specialty, workshopType, photoURL, selectedPreset, notificationsEnabled, audioAlertsEnabled, updatedAt.
- `partners` (Partner role): matched by `email` or `partnerId`; updates name, contactPerson, photoURL, and phone / address / company when non-empty.
- `customers` (Customer / Business Client role): matched by `email` or `nic`; updates name, photoURL, and phone / address when non-empty.
- `settings/permissions`: only in `PermissionsContext.jsx`; no other `settings` documents exist.
- **Storage:** none. Photos are cropped to a base64 data URL stored inline in `photoURL` (5 MB limit).
- **localStorage:** `ptf_theme` (applied as `data-theme` on `<html>`), `ptf_user` (cached user; set in `handleUpdateUser`, removed on sign-out).

## Cloud Functions / triggers

No Cloud Functions.

- **Profile mirroring:** `UserProfile.jsx` syncs to `partners` / `customers` directly (errors only warned); then `App.jsx` `handleUpdateUser` also updates `partners` for Partner users and updates local state. `handleUpdateUser` does not sync `customers`, so the two paths differ.
- **Audit log:** `logActivity(..., 'UPDATE', 'Profile', ...)` on save.
- **Editable:** the `users` fields listed above. **Protected on the client only:** role, status, email and identifier are absent from the save payload and display-only in the UI; whether rules also block them was not examined here (see [user-management-rbac.md](../user-management-rbac/README.md)).
- **Password change is a stub:** `handlePasswordReset` only shows a toast; there is no `updatePassword`, `reauthenticate` or `sendPasswordResetEmail` call. Emails: not found.

## Depends on / called by

`services/firebase` (`db`, `getAccessToken`), `firestoreSync` (`COLLECTIONS`, `updateDocument`), `auditLog`, `toast`, `dateUtils`, `common/ui`, app-level `users` / `partners` state, `PermissionsContext`.

## Summary

One self-service profile page plus an App-level theme toggle. Users edit display, contact and preference fields, saved to `users/{identifier}` and mirrored into `partners` or `customers` for those roles. Photos are inline base64. Saves are audit-logged. Role and status cannot be changed from the page.

## Open questions

- Password change shows a success-style message but does nothing.
- `companyInfo.js` is dead code as far as `src` is concerned.
- Photos as base64 in Firestore documents inflate every read of `users` (and, if mirrored, `partners` / `customers`).
