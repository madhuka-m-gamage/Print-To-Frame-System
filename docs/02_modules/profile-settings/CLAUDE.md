# User Profile & Settings: module notes for Claude

Full map: [../profile-settings.md](../profile-settings.md). Cross-module chains: [CROSS_MODULE_TRIGGERS.md](../../01_architecture/CROSS_MODULE_TRIGGERS.md). There are no Cloud Functions; all automation is client code (`src/App.jsx`, components) or `api/*.js`.

## What it does

One self-service profile page plus a theme toggle. There is no separate settings screen.

## Code

- `src/components/common/UserProfile.jsx`, theme toggle and `handleUpdateUser` in `src/App.jsx`

## Firestore collections it owns or writes

- Writes `users/{identifier}`; mirrors into `partners` or `customers` for those roles; `auditLog` (`UPDATE`, `Profile`). localStorage: `ptf_theme`, `ptf_user`.

## Triggers and side effects

- Photos are cropped to base64 and stored inline in `photoURL` (no Storage).
- Two sync paths (UserProfile and `handleUpdateUser`) differ: only the first updates `customers`.

## Before you edit

- Password change is a stub (toast only).
- Role, status and email are protected only by the client payload; rules block role / status changes for non-admins.
- `src/constants/companyInfo.js` is unused.
