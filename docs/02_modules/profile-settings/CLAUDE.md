# User Profile & Settings: module notes for Claude

Full map: [README.md](README.md). Cross-module chains: [CROSS_MODULE_TRIGGERS.md](../../01_architecture/CROSS_MODULE_TRIGGERS.md). Review findings: [FINDINGS.md](FINDINGS.md). There are no Cloud Functions; all automation is client code (`src/App.jsx`, components) or `api/*.js`.

## What it does

One self-service profile page plus a theme toggle. There is no separate settings screen.

## Code

- `src/features/profile/UserProfile.jsx`, theme toggle and `handleUpdateUser` in `src/App.jsx`

## Firestore collections it owns or writes

- Writes `users/{identifier}`; mirrors into `partners` or `customers` for those roles; `auditLog` (`UPDATE`, `Profile`). localStorage: `ptf_theme`, `ptf_user`.

## Triggers and side effects

- Photos are cropped to base64 and stored inline in `photoURL` (no Storage).
- Partner and customer records are written only by `handleUpdateUser` in `App.jsx` (FEA-8, FEA-13): a Partner's `partners` record by id; a Customer or Business Client's `customers` record found by `email` alone (the rules let a client read only rows whose email or nic equals their token email, so a query on the real NIC is denied). Phone, address and company are written even when empty, so clearing a field clears it. `UserProfile.jsx` writes only `users`.

## Before you edit

- The form defaults an empty location to the placeholder `Kadawatha, Sri Lanka`, so a profile with no location saves that text unless the user clears the field.
- Password change is a stub (toast only).
- Role, status and email are protected only by the client payload; rules block role / status changes for non-admins.
- `src/constants/companyInfo.js` is unused.
