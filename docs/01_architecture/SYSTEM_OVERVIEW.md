# System Overview

> Repo layout and the frontend / backend / functions / shared-code split. Facts below were read from the repo; anything not verified is marked.

## Repo shape (single app or monorepo)

**Single app**, not a monorepo. One `package.json` (name `mcp-erp-app`), one Vite build, one Firestore rules file. About 25k lines across `src/`, `api/`, `firestore.rules`. Tests live in `tests/unit` and `tests/integration`.

## Frontend (`src/`)

React 18 + Vite SPA. `src/main.jsx` mounts `src/App.jsx`, which owns all top-level state (leads, customers, partners, projects, logistics, invoices, quotations, users), subscribes to Firestore in real time, and picks the screen by an `activeTab` string (no router library). Public pages (`ReferralForm`, `PartnerRegistration`) are mounted separately from `main.jsx`.

| Folder | Contents |
|---|---|
| `src/features/<domain>/` | One folder per business domain, holding its screens, logic and any domain-only client: `auth` (Login, authFlow), `profile` (UserProfile), `dashboard` (Dashboard, NotificationsView), `messaging` (Messages, MiniChatDrawer, FloatingMessageToast, MessagingContext, messageFilters), `leads` (Leads, LeadCardDetails, leadLineage, audioProcessing), `customers` (Customers, ContactSyncModal), `quotations` (QuotationBuilder, CostCalculator, pricingEngine, quotePricing, quotationStatus), `deals` (Deals, dealSettlement, dealProjectSync), `invoicing` (Invoices, Receipts, invoiceTemplate, receiptTemplate, invoiceSettlement, invoicePrintData), `partners` (Partners, PartnerQRModal, PartnerRegistration, ReferralForm), `fabrication` (FabricationWorks, FabricationCardDetails, FrameBlueprintPreview, cutListEngine, fabricationLink, qaGate), `logistics` (Logistics, LogisticsCardDetails, logisticsEngine, logisticsTask), `admin` (AdminPanel, AgentDatabase, PermissionsManager, adminUsers) |
| `src/shared/` | Code used by several features and belonging to none: `ui/` presentational primitives, `components/` (DeleteModal, ErrorBoundary, pickers, EmailTemplateModal ...), `utils/` with no domain (dates, validation, csv, toast, entity matching ...) |
| `src/services/` | Infrastructure clients: `firebase`, `firestoreSync` (CRUD + `COLLECTIONS` map + atomic ID/invoice numbering), `auditLog`, `gemini`, `mailer`, `driveService`, `contactsService`, `googleMapsService`, `dataDefaults` |
| `src/context/` | `PermissionsContext` (RBAC) |
| `src/constants/` | `roles`, `emailTemplates`, `companyInfo` |

Import rule: a feature may import `@/shared`, `@/services`, `@/context`, `@/constants` and other features by `@/features/<name>/...`; `shared` never imports a feature. Outside its own folder, code imports with the `@/` alias (`@/` means `src/`).

Firestore collections (from `COLLECTIONS` in `src/services/firestoreSync.js`): `leads`, `customers`, `partners`, `partner_applications`, `partner_payouts`, `projects`, `logistics`, `invoices`, `receipts`, `quotations`, `messages`, `auditLog`, `users`, `pendingUsers`, `settings`, `referral_claims`, `typing_indicators`, `counters`.

## Backend (`api/`)

Three Vercel serverless functions plus one helper. Same origin as the SPA (`vercel.json` rewrites `/api/*` to `api/*`, everything else to `index.html`).

- `api/generate.js`: Gemini proxy (requires Firebase ID token and an approved user)
- `api/admin-user.js`: Auth user create / reset / delete via the Firebase Admin SDK
- `api/send-email.js`: email sending (nodemailer)
- `api/_lib/firebaseAdmin.js`: Admin SDK init from `FIREBASE_SERVICE_ACCOUNT_JSON`

`vite.config.js` re-implements these endpoints as dev middleware, so `npm run dev` works without Vercel.

## Cloud Functions

None, and there is no `functions/` folder (the empty placeholder was removed in Phase 7 8.2). See [GCP_INVENTORY.md](GCP_INVENTORY.md): the GCP project has no Cloud Functions, Eventarc triggers or Scheduler jobs.

## Shared code

No shared package. Frontend-only helpers sit in `src/utils/` and `src/services/`. The dev proxy in `vite.config.js` imports both `src/constants/emailTemplates.js` and `api/_lib/firebaseAdmin.js`, the only frontend/backend crossover. `firestore.rules` is the security layer shared by all clients.

## Organisation (by layer vs by module)

**By business domain.** Each domain's screens and logic live together in `src/features/<domain>`, so a change to invoicing or fabrication stays in one folder. The business modules are described in `docs/02_modules/`.

## Deployment (from CLAUDE.md, unverified here)

`staging` branch deploys a Vercel preview; `main` deploys production. `firestore.rules` is **not** deployed by Vercel and needs `firebase deploy --only firestore:rules`. See [DEPLOY_PROCESS.md](../04_workflows/DEPLOY_PROCESS.md).
