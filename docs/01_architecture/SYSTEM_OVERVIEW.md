# System Overview

> Repo layout and the frontend / backend / functions / shared-code split. Facts below were read from the repo; anything not verified is marked.

## Repo shape (single app or monorepo)

**Single app**, not a monorepo. One `package.json` (name `mcp-erp-app`), one Vite build, one Firestore rules file. About 25k lines across `src/`, `api/`, `firestore.rules`. Tests live in `tests/unit` and `tests/integration`.

## Frontend (`src/`)

React 18 + Vite SPA. `src/main.jsx` mounts `src/App.jsx`, which owns all top-level state (leads, customers, partners, projects, logistics, invoices, quotations, users), subscribes to Firestore in real time, and picks the screen by an `activeTab` string (no router library). Public pages (`ReferralForm`, `PartnerRegistration`) are mounted separately from `main.jsx`.

| Folder | Contents |
|---|---|
| `src/components/admin/` | AdminPanel, AgentDatabase, PermissionsManager |
| `src/features/<domain>/` | migrated feature folders (being filled in Phase 7 8.2): `auth` (Login, authFlow), `profile` (UserProfile), `dashboard` (Dashboard, NotificationsView), `messaging` (Messages, MiniChatDrawer, FloatingMessageToast, MessagingContext, messageFilters), `leads` (Leads, LeadCardDetails, leadLineage, audioProcessing), `customers` (Customers, ContactSyncModal), `quotations` (QuotationBuilder, CostCalculator, pricingEngine, quotePricing, quotationStatus), `deals` (Deals, dealSettlement, dealProjectSync), `invoicing` (Invoices, Receipts, invoiceTemplate, receiptTemplate, invoiceSettlement, invoicePrintData), `partners` (Partners, PartnerQRModal, PartnerRegistration, ReferralForm), `fabrication` (FabricationWorks, FabricationCardDetails, FrameBlueprintPreview, cutListEngine, fabricationLink, qaGate), `logistics` (Logistics, LogisticsCardDetails, logisticsEngine, logisticsTask) |
| `src/shared/` | `ui/` primitives, `components/` used by several features (DeleteModal, ErrorBoundary, pickers, EmailTemplateModal ...), `utils/` with no domain (dates, validation, csv, toast ...) |
| `src/services/` | `firebase`, `firestoreSync` (CRUD + `COLLECTIONS` map + atomic ID/invoice numbering), `auditLog`, `gemini`, `adminUsers`, `mailer`, `driveService`, `contactsService`, `googleMapsService`, `dataDefaults` |
| `src/utils/` | `cutListEngine`, `logisticsEngine`, `invoiceTemplate`, `receiptTemplate`, `stringMatch` |
| `src/context/` | `PermissionsContext` (RBAC) |
| `src/constants/` | `roles`, `emailTemplates`, `companyInfo` |

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

**Being reorganised by feature (Phase 7 8.2).** Business code is moving from technical folders into `src/features/<domain>`, with cross-feature code in `src/shared` and infrastructure clients in `src/services`. Features still under `src/components/` are listed in the table above; the business modules are mapped in `docs/02_modules/`.

## Deployment (from CLAUDE.md, unverified here)

`staging` branch deploys a Vercel preview; `main` deploys production. `firestore.rules` is **not** deployed by Vercel and needs `firebase deploy --only firestore:rules`. See [DEPLOY_PROCESS.md](../04_workflows/DEPLOY_PROCESS.md).
