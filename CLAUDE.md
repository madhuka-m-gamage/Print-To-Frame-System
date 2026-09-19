# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Print To Frame ERP is a single-page React ERP/CRM for a Sri Lankan custom-framing business (leads → deals → fabrication → logistics → invoicing, plus a partner/referral network). It's a Vite + React 18 SPA with Firebase (Auth + Firestore + Storage) as the sole backend — there is no separate Node server; a single Vercel serverless function (`api/generate.js`) proxies Gemini AI calls.

## Commands

```bash
npm run dev          # Vite dev server on 0.0.0.0:3000 (also proxies POST /api/generate locally, see vite.config.js)
npm run build         # production build to dist/
npm run preview       # preview the production build on port 3000
npm run lint          # eslint .
```

There are two test layers, both real and runnable:
- `npm test` — Vitest unit tests (`tests/unit/`), pure logic only (email template interpolation, RBAC permission-matrix shape). No Firebase dependency, runs in ~2s.
- `npm run test:rules` — integration tests (`tests/integration/`) run against a real local Firebase Emulator (Firestore + Auth), started and torn down automatically via `firebase emulators:exec`. These exercise `firestore.rules` itself — e.g. proving a non-admin genuinely cannot escalate their own role via a direct Firestore write, not just that the UI hides the button. Needs Java installed (the emulator JARs require it) but no real Firebase project, login, or credentials — it runs against a fake `demo-print2frame-test` project id.
- `npm run test:all` runs both in sequence.

The previous `tests/e2e.test.js` (a Puppeteer script for a Windows/local Chrome path, never wired into `npm test` and non-functional in this environment) has been removed — this is what it was replaced with.

### Branching & deployment workflow

This repo deploys via Vercel from two branches, and there are two skills under `.agents/skills/` that automate the flow — prefer invoking them over ad hoc git commands when the user asks to "push to staging" or "deploy live":

- `staging` branch → Vercel **preview** deployment (day-to-day work happens here).
- `main` branch → Vercel **production** deployment (`portal.print2frame.xyz`).
- Promotion is a straight merge: `staging` → `main`, then push, then switch back to `staging`. Never commit directly to `main`.

**Critical gotcha:** editing `firestore.rules` and pushing to `staging`/`main` only updates the *file in git* — it does **not** touch the live Firestore rules engine. Vercel deploys the SPA and `api/*.js` functions; it has no relationship to Firestore rules at all. Any change to `firestore.rules` must be separately deployed with `firebase deploy --only firestore:rules --project print-to-frame-erp` (already-authenticated as `madhukagamage6@gmail.com` in this environment). A rules edit that's merged and deployed to production but never `firebase deploy`'d will silently keep enforcing the old ruleset — this exact gap caused a live admin lockout on `portal.print2frame.xyz` (rules had been edited across several commits earlier in the session, deployed via Vercel, but never pushed to Firebase itself).

**Also verify Firebase client config against `firebase apps:sdkconfig`, not the committed `firebase-applet-config.json` fallback** — that file drifted (a deleted app's `appId`, a blank `measurementId`) and gave wrong values when used to diagnose a production issue. Re-fetch it with `firebase apps:list --project print-to-frame-erp` + `firebase apps:sdkconfig WEB <appId> --project print-to-frame-erp` whenever config values matter, since the committed file is not guaranteed current. The live app's `authDomain` (`print-to-frame-erp.firebaseapp.com`) also needs the actual serving domain(s) — `portal.print2frame.xyz`, `www.print2frame.xyz` — added under Firebase Console → Authentication → Settings → **Authorized domains**, or Google sign-in fails with `auth/invalid-continue-uri` or `auth/unauthorized-domain`; this isn't tracked in any file, so it can't be verified from the repo.

### Full-repository audits

For a systematic, folder-by-folder code-review audit of the whole repo (enumerating every top-level folder and loose root file, verifying skip candidates before excluding them, and delivering one dated report per unit), use the global `repo-folder-audit` skill rather than an ad hoc review — it also knows to cross-reference client-side permission logic against `firestore.rules` before ranking a finding's severity.

## Architecture

### Everything is one Firestore-backed SPA

`src/App.jsx` is the composition root: it owns all top-level state (`leads`, `customers`, `partners`, `projects`, `logisticsJobs`, `invoices`, `quotations`, `users`), subscribes to Firestore in real time via `subscribeToCollection` (`src/services/firestoreSync.js`), and passes state + setters down as props to each lazy-loaded route component in `src/components/{crm,operations,dashboard,admin,tools}`. There is no router library — `activeTab` (a string) selects which component renders in `<main>`, gated by `canAccess(role, tab)`.

- `src/services/firebase.js` — Firebase app/auth/firestore/storage init, Google OAuth (with Drive/Contacts scopes), email login/register, `handleFirestoreError`.
- `src/services/firestoreSync.js` — the CRUD/subscription layer every feature uses: `subscribeToCollection`, `addDocument`, `updateDocument`, `setDocument`, `deleteDocument`, `batchWrite`, and `COLLECTIONS` (the canonical Firestore collection-name map — always reference `COLLECTIONS.X` rather than hardcoding a collection string).
- `src/services/dataDefaults.js` — seed/fallback data shapes when Firestore collections are empty.
- `src/services/pricingEngine.js` — the quotation/cost-calculator pricing logic (frame sizing, sq ft, commission math).
- `src/services/auditLog.js` — writes to the `auditLog` collection; call `logActivity(userId, userName, action, module, details)` after any state-changing operation (invoice created, user approved, permissions changed, etc.) — this is the established pattern throughout `App.jsx`.
- `src/services/gemini.js` — client-side helper that calls `/api/generate` (dev: Vite middleware plugin in `vite.config.js`; prod: `api/generate.js` Vercel function).

### RBAC: two layers that must stay in sync

Permissions are enforced in **three** places that all need to agree when changing access rules:
1. `src/context/PermissionsContext.jsx` — `DEFAULT_PERMISSIONS` (per-role, per-module `{view, create, edit, delete, export}`), live-synced from the `settings/permissions` Firestore doc, exposed via `usePermissions()` → `canAccess(role, module, action?)`. `App.jsx` uses this to decide which nav links/routes render.
2. `firestore.rules` — `checkPermission(module, action)` re-derives the same view/create/edit/delete/export (and legacy read/write) logic server-side, reading the *same* `settings/permissions` document, so client-side gating is never trusted alone. `settings/permissions` itself is writable only by Admins.
3. `src/constants/roles.js` — `SYSTEM_ROLES`, `PUBLIC_REGISTRATION_ROLES`, and `ROLE_METADATA` (labels/badges/categories used in UI, e.g. `AgentDatabase.jsx`, `AdminPanel.jsx`).

There are two hardcoded "bootstrap super admin" emails (see `App.jsx`'s "Self-Healing Super Admin Guard" and the matching `isBootstrapSuperAdmin()` in `firestore.rules`) that always self-heal back to role `Admin` / `status: Active` on login — this is intentional and mirrored on both client and rules, don't "fix" it away.

New users self-provision into `pendingUsers` (or `users` directly for the bootstrap admin emails) on first sign-in; an Admin approves via `AgentDatabase.jsx`, which also auto-provisions a matching `partners` or `customers` record depending on the granted role (`Partner` / `Business Client`). `role`, `isApproved`, and `status` are user-profile fields that must never be client-settable outside these narrow approve/self-heal paths — see the security comments at the top of the `users` match block in `firestore.rules` before touching that collection's rules.

### AI proxy (`api/generate.js`)

Requires a valid Firebase ID token (`Authorization: Bearer <token>`) AND that the caller's `users/{email}` doc is approved/active — mirrors the client-side gate in `App.jsx`. It tries a list of Gemini models in order (`CANDIDATE_MODELS`) and falls through on 404/503/429, but stops immediately on a 400. CORS is restricted to `ALLOWED_ORIGINS` (no wildcard). When editing this file, preserve both checks — this endpoint burns metered Gemini quota if left open.

### UI conventions

- Material Design–flavored Tailwind theme driven by CSS custom properties (`surface`, `on-surface`, `primary`, `outline-variant`, etc. — see `tailwind.config.js` and `brand-tokens.json`), with a `data-theme="dark"|"light"` attribute on `<html>` toggled from `App.jsx` and persisted to `localStorage`.
- Shared primitives live in `src/components/common/ui/` (`SortableTable`, `FilterBar`, `KanbanCard`/`KanbanColumn`, `StatusBadge`, `UserAvatar`, `PageHeader`, and the `detail-modal/` compound-component set) and are re-exported from `src/components/common/ui/index.js` — prefer these over building new list/table/modal chrome from scratch.
- Route components are `React.lazy`-loaded from `App.jsx` and each module's feature components live under `src/components/{crm,operations,dashboard,admin,tools,public,auth}/`.
- `src/context/MessagingContext.jsx` drives the in-app messaging system (floating toast + mini chat drawer + full `Messages` view) — real-time, per-user unread counts feed the sidebar badge.
- Partner-role users get a deliberately restricted nav/routing (`dashboard`, `notifications`, `partners`, `profile` only) — this restriction is enforced redundantly in `App.jsx`'s route-protection `useEffect` and in `DEFAULT_PERMISSIONS.Partner`.

### Planning & Workflow
- Maintain a single `PLAN.md` at the project root. Overwrite it in-place rather than creating dated archive files.
- Do NOT generate `.docx`, `.pdf`, or standalone audit report files inside the repository.
- Rely on git commits for historical record; never create `docs/archive/` or timestamped markdown files.
