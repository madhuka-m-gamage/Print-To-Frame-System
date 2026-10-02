# Follow-up Backlog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement an item. Steps use checkbox (`- [ ]`) syntax. **This file is a work list, not a script.** Each item below is scoped and has its first steps and tests; before starting one, expand it into a full step-by-step plan with `superpowers:writing-plans`, then execute that.

**Goal:** One shared, self-contained list of everything that was deliberately left undone at the end of Phase 7 of the Print To Frame ERP work, so any engineer or agent can pick an item up without the original conversation.

**Architecture:** Items are grouped by kind of work and given stable IDs (`DEC-`, `MON-`, `FEA-`, `SEC-`, `TST-`, `ENG-`, `LIVE-`). Each item says why it matters, where the code is, how to test it, whether it touches the live site, and what it depends on. Work each item on its own branch and pull request.

**Tech Stack:** React 18 + Vite SPA, Firebase (Auth, Firestore, Storage), Vercel serverless functions in `api/`, Vitest (unit, component, API, rules on the Firebase emulator), Playwright, ESLint, Node 22.

**Spec:** [PLAN.md](../../PLAN.md) (progress and the short backlog list), [LIVE_ROLLOUT.md](LIVE_ROLLOUT.md) (live steps), [AUTHORIZATION_MAP.md](../03_security/AUTHORIZATION_MAP.md) (security findings), [0002-deferred-until-live-rollout.md](../05_decisions/0002-deferred-until-live-rollout.md), [0003-source-layout.md](../05_decisions/0003-source-layout.md), and each module's `docs/02_modules/<module>/FINDINGS.md` and `CLAUDE.md`. The owner's decisions are recorded in `PLAN.md` and `CHANGELOG.md`.

## Global Constraints

Every item implicitly includes these.

- **Repository:** `github.com/madhuka-m-gamage/Print-To-Frame-System`, checked out at the project root `Print-To-Frame-System/` (it used to be in an `erp-system/` subfolder; older docs and notes may say so).
- **Branching:** branch from `staging`, open a pull request into `staging`. Do not push to `main` without the owner's explicit go. `staging` and `main` were made identical on 2026-09-21.
- **What is live:** production (`portal.print2frame.xyz`, Vercel project `print-to-frame-erp`) deploys `main` of the **original** repository `madhukagamage6/Print-To-Frame-ERP-System`, not this one, until the owner reconnects it (see LIVE-3). Merging here does not change the live site.
- **Live-affecting actions need the owner's explicit go at that moment:** deploying `firestore.rules` or Storage rules, writing the live `settings/permissions` document, changing Vercel or Firebase configuration or environment variables, deleting data. Pushing to a branch never deploys rules. Always pass `--project print-to-frame-erp` explicitly; never run a bare `firebase deploy`.
- **Full gate for every change:** `npm run lint`, `npm test`, `npm run test:api`, `npm run test:component`, `npm run test:rules` (needs Java), `npm run build`; add `npm run test:e2e` for anything a user clicks through. A refactor pull request changes no behaviour.
- **Tests first** for money and access paths: write the failing test, watch it fail, then implement. Read `docs/04_workflows/TESTING.md` ("Planning a change", coverage map, characterisation register) before planning; update it when a characterisation test flips.
- **Code layout:** `src/features/<domain>` for a domain's screens and logic, `src/shared` for code used by several features, `src/services` for infrastructure clients. Outside its own folder a file imports with the `@/` alias; `shared` never imports a feature. ESLint enforces this (ADR 0003).
- **Permissions live in three places that must agree:** `src/context/PermissionsContext.jsx` (`DEFAULT_PERMISSIONS`), `firestore.rules`, `src/constants/roles.js`. The live matrix is a Firestore document, not a file.
- **Docs in the same change:** `CHANGELOG.md` (top of "Unreleased"), the module's `docs/02_modules/<module>/CLAUDE.md`, `TESTING.md`, and tick or update the item here and in `PLAN.md`. `PROJECT_INDEX.md` when a doc is added. Single `PLAN.md` at root; no `docs/archive/`; no timestamped markdown; docs hold variable names only, never values.
- **Commits and PRs:** commit messages end with `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`; pull request bodies end with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- **Never commit secrets.** Do not paste keys, tokens or credentials into the repository, the pull requests or chat.

**Status legend:** `[ ]` open, `[~]` partly done, `[x]` done. **Size:** S under a day, M 1 to 3 days, L more. **Live:** does it change the live project or need something deployed by hand?

---

## Index

| ID | Item | Kind | Size | Live? | Owner decision first? | Depends on |
|---|---|---|---|---|---|---|
| DEC-1 | One default partner commission rate | decision | S | no | yes | none |
| DEC-2 | May drivers record cash on delivery | decision | S | matrix | yes | none |
| DEC-3 | Enable Firebase Storage, or drop uploads | decision | S | yes | yes | none |
| DEC-4 | Cancelled projects: block Final invoice and delivery job | decision | S | no | yes | FEA-3 |
| DEC-5 | Old manual fabrication jobs that still carry a value | decision | S | no | yes | none |
| DEC-6 | Which repository is canonical | decision | S | yes | yes | none |
| DEC-7 | Are any live roles too broad; do Operations and Logistics need quotations or receipts | decision | S | matrix | yes | LIVE-1 |
| DEC-8 | Google Drive and Contacts access approach | decision | S | no | yes | none |
| DEC-9 | Add a LICENSE | decision | S | no | yes | none |
| MON-1 | Deal completion must wait for its Final invoice | money | M | no | no | none |
| MON-2 | Stamp `leadId` and `dealId` on every invoice | money | M | no | no | none |
| MON-3 | Two remaining single-id lookups | money | S | no | no | none |
| MON-4 | Server-side guard against duplicate invoices | money | M | rules | no | none |
| MON-5 | Server-side numbering (counters, public-form ids) | money | L | api + rules | no | none |
| MON-6 | Old data: leads without frame size, inline blueprints | data | M | Storage | partly | DEC-3, DEC-5 |
| MON-7 | List and alert defaulted-commission leads | money | M | rules | no | FEA-2 |
| MON-8 | Round the 75 / 25 invoice split to cents | money | S | no | **yes** | none |
| FEA-1 | Real partner payout (step 4.1) | feature | M | rules | no | LIVE-1 (to work live) |
| FEA-2 | Persistent notifications and claim resolution (step 4.3) | feature | L | rules | no | none |
| FEA-3 | Fabrication board statuses: Cancelled, On Hold, Archived, Other (done) | feature | M | no | DEC-4 | none |
| FEA-4 | Fleet and driver directory in Firestore | feature | M | rules | no | LIVE-1 |
| FEA-5 | Inspection: revision alert and "Email client: QA passed" | feature | M | api | no | FEA-2 |
| FEA-6 | Messaging polish (D-MSG items) (done) | ux | L | no | no | none |
| FEA-7 | Notification persistence and toast decoupling | ux | M | rules | no | FEA-2 |
| FEA-8 | Profile and user-management items (done) | ux | S | no | no | none |
| FEA-9 | Employees HR model | feature | L | rules | no | none |
| FEA-10 | Task-assignment fields across modules | feature | L | rules | no | FEA-9 |
| FEA-11 | Staff screen to open partner-application BR/NIC files (done) | feature | S | no | no | none |
| FEA-12 | Batch the read-receipt writes (D-MSG-02, second half) | ux | S | no | no | none |
| FEA-13 | Profile sync: the Customer write path and clearing fields | ux | S | rules? | no | none |
| SEC-1 | Check the recipient in `api/send-email.js` | security | S | api | no | none |
| SEC-2 | Restrict `api/generate.js` to staff roles | security | S | api | no | none |
| SEC-3 | Make the dev proxy safe | security | S | no | no | none |
| SEC-4 | Console-only security checks | security | S | consoles | owner | none |
| SEC-5 | Store the service-account key as a Sensitive variable | security | S | Vercel | owner | none |
| SEC-6 | Public partner profile document (partners D-5) | security | M | rules | no | LIVE-1 |
| SEC-7 | Partner limited to its own record | security | M | rules | no | LIVE-1 |
| SEC-8 | Partner-scoped reads on leads and invoices (partners D-9) | security | M | rules | no | SEC-7 |
| SEC-9 | Effective-access test (which rule wins) | security | M | no | no | none |
| SEC-10 | Restrict the browser API key to the app's domains | security | S | GCP console | owner | LIVE-3 |
| SEC-11 | Deactivated users can still sign in (done) | security | S | no | no | none |
| SEC-12 | Scope `typing_indicators` rules to the chat's participants | security | S | rules | no | none |
| TST-1 | Component tests for the lead card (done) | tests | M | no | no | none |
| TST-2 | End-to-end journeys (money, RBAC) (done) | tests | L | no | no | none |
| TST-3 | Tests for Leads, QuotationBuilder, Customers; refresh the coverage map (done) | tests | M | no | no | none |
| TST-4 | Manual check: Picker attach and staff uploads on a deployment | tests | S | deployment | owner | none |
| ENG-1 | Split the very large files | health | L | no | no | TST-1, TST-3 |
| ENG-2 | Add Prettier | health | S | no | no | ENG-1 |
| ENG-3 | Repository hygiene | health | S | no | partly | DEC-9 |
| ENG-4 | Remove the two unused Firestore databases from `firebase.json` (done) | health | S | deploy target | no | none |
| ENG-5 | Unsafe release scripts in `package.json` (skipped by owner 2026-10-01) | health | S | no | no | none |
| ENG-6 | Documentation that no longer matches reality | health | S | no | no | none |
| ENG-7 | Coverage and CI gaps: component coverage, e2e on staging PRs | health | S | no | no | none |
| LIVE-1 | Live rollout: matrix, code, rules | rollout | M | **yes** | **yes** | DEC-6 |
| LIVE-2 | Separate staging and production environments (Part 1) | rollout | L | **yes** | yes | LIVE-3 |
| LIVE-3 | One canonical repository and one deploy path | rollout | M | **yes** | yes | DEC-6 |
| LIVE-4 | Give the tooling access to the live Vercel project | rollout | S | Vercel | owner | none |

**Status at Milestone 1 (2026-09-27):** DEC-1..9 done (see each item). Milestone 2: MON-1, MON-3, MON-2, SEC-1, SEC-2, SEC-3, SEC-9, SEC-11, TST-1, TST-2, FEA-6, FEA-3, ENG-4, FEA-8, FEA-11 and TST-3 done. Wave A2: MON-8, ENG-7, FEA-13 and FEA-12 done. MON-6 is moot: live data is test-only and the fresh setup replaces it (DEC-5). ENG-3's LICENSE part is done. Order of work: the waves in [PLAN.md](../../PLAN.md).

---

## Owner decisions

Each is a question only the owner can answer. Record the answer in `PLAN.md` and `CHANGELOG.md`, then unblock the dependent item.

### DEC-1: One default partner commission rate
- **Why:** a referral lead with no partner rate is quoted at **LKR 30.00 per sq ft** (`DEFAULT_REFERRAL_COMMISSION_RATE` in `src/features/quotations/quotePricing.js`, decided by the owner and flagged with `pricingMetadata.commissionRateDefaulted`), but other places still fall back to **LKR 53.50**: the new-partner default and payout maths in `src/features/partners/Partners.jsx`, the payment-cleared handler in `src/App.jsx`, and the deal commission fallback in `src/features/deals/dealSettlement.js`.
- **Ask the owner:** which single number, and is it per sq ft for every case?
- **Then:** find every use with `grep -rn "53.5" src`, replace with one exported constant, update the tests that pin 53.5 (`tests/component/Deals.test.jsx`, `tests/unit/dealSettlement.test.js`), and note it in `docs/02_modules/partners/CLAUDE.md`.
- **Decided (owner, 2026-09-27):** one default of **LKR 38.00 per sq ft** for every case, replacing both 30.00 (quotes) and 53.50 (Partners, payment-cleared handler, deal settlement). Implement as its own change: one exported constant, update the pinned tests. **Done 2026-09-27:** `DEFAULT_REFERRAL_COMMISSION_RATE = 38` in `quotePricing.js` is used everywhere; area recovered from a saved quote now uses the quote's own rate (`sqFtFromPricing`).

### DEC-2: May drivers record cash on delivery
- **Why:** step 6.5b added "Record cash collection" on the delivery card, shown only to roles that can edit invoices and create receipts (Admin and Manager today). The Logistics role has read-only invoices and no receipts in `DEFAULT_PERMISSIONS`, and the live matrix gives Logistics full `invoices` but no `receipts` module.
- **Options:** (a) drivers record it, which needs Logistics `receipts: create` in the matrix and later rules; (b) a dispatcher (Manager or Accounts) records it for them (no change).
- **Live:** option (a) writes the live matrix (LIVE-1) and depends on the rules deploy.
- **Decided (owner, 2026-09-27):** option (b), a dispatcher (Manager or Accounts) records it. No code, matrix or rules change.

### DEC-3: Enable Firebase Storage, or drop uploads
- **Why:** the live project has **no active Storage rules** (read-only check, 2026-09-21), so uploads are expected to fail: public partner registration documents (`src/features/partners/PartnerRegistration.jsx`, falls back to a placeholder name), the Partners screen document upload (`src/features/partners/Partners.jsx`), and fabrication blueprints (`src/features/fabrication/FabricationCardDetails.jsx`, keeps files under 500KB inline and rejects larger ones). The bucket `print-to-frame-erp.firebasestorage.app` exists.
- **Options:** enable Storage with narrow rules (signed-in write to `blueprints/` and `partners/`; the anonymous registration form needs its own design), or remove the upload features.
- **Live:** yes (Storage rules are deployed by hand).
- **Decided (owner, 2026-09-27):** enable Storage with narrow rules (signed-in write to `blueprints/` and `partners/`); the anonymous registration upload gets its own design. Storage rules are written and tested in the repo; deploying them waits for the fresh environment setup or explicit sign-off. **Done in the repo 2026-09-27:** `storage.rules` (tests in `tests/integration/storageRules.test.js`), `firebase.json` storage entry and emulator; the registration form stores file paths. **Deployed 2026-09-27** with the owner's sign-off (bucket created in `asia-south1`, Storage service agent granted `roles/firebaserules.firestoreServiceAgent`). Follow-up: staff have no screen yet to open an application's BR/NIC files.

### DEC-4: Cancelled projects: block a Final invoice and a delivery job
- **Recommended: yes.** A deleted deal marks its project `Cancelled` (step 6.4a). Block QA-pass Final invoice creation and delivery-job creation for a Cancelled project, with a clear message.
- **Decided (owner, 2026-09-27):** yes, block both with a clear message. Client code only. **Done 2026-09-27:** `cancelledProjectBlock` guards the QA pass, Fabrication dispatch and the Logistics new-delivery form.

### DEC-5: Old manual fabrication jobs that still carry a value
- New manual jobs carry no value (billed through a deal or marked non-billable). Older ones may have `value > 0` and still get a 25% Final invoice at QA pass. **Ask:** leave them, clear the value, or link them to a deal? To count them, query `projects` for `origin != 'manual'` with `value > 0` and no `dealId`.
- **Decided (owner, 2026-09-27):** no migration. The live data is test data only; the owner plans a fresh environment setup (new Firebase/GCP data store, Vercel), so old jobs are discarded rather than cleaned. The code path for new manual jobs is already correct.

### DEC-6: Which repository is canonical
- Three places exist: the original personal repository `madhukagamage6/Print-To-Frame-ERP-System` (own history, last commit 2026-09-15, what production deploys from), this repository, and an old local folder. The owner has said this repository is the correct one. **Ask:** approve LIVE-3 (reconnect the live Vercel project here) and archive the others.
- **Decided (owner, 2026-09-27):** this repository (`madhuka-m-gamage/Print-To-Frame-System`) is canonical. LIVE-3 is approved; the reconnect itself still runs step by step with sign-off, and the other repositories get archived after it.

### DEC-7: Role breadth and the two new modules
- The live matrix differs from the defaults in 58 cells (see `docs/03_security/RBAC_MODEL.md`): Support has edit on most modules including `agents`; Logistics has full `invoices`; Operations edits `leads`, `pipeline` and `agents`; Manager has `admin`. **Ask:** is any of that more than the business intends? Changing it needs no code: an Admin edits cells in Permissions Manager. Also decide whether Operations and Logistics need `quotations` or `receipts` view (the migration defaults give them none).
- **Decided (owner, 2026-09-27):** review the live-vs-default table cell by cell before changing anything. The 57-cell table (live read 2026-09-27) is in `docs/03_security/RBAC_MODEL.md`. Because the fresh environment will be seeded from `DEFAULT_PERMISSIONS`, the review effectively decides the defaults. **Decided (owner, 2026-09-27): use the default for every cell.** `DEFAULT_PERMISSIONS` stays as it is; the live `settings/permissions` document is replaced by the defaults when the environment is set up fresh (or through LIVE-1, an Admin action in Permissions Manager, with sign-off). No code change.

### DEC-8: Google Drive and Contacts access
- Drive uses the restricted `drive.readonly` scope; Contacts uses `contacts.readonly`. Staff click through Google's "unverified app" warning. **Options:** use Google Picker with the narrow `drive.file` scope (no verification needed; a code change in `src/services/driveService.js` and `src/shared/components/GoogleDrivePickerModal.jsx`), and/or submit the OAuth app for verification.
- **Decided (owner, 2026-09-27):** switch Drive to Google Picker with the narrow `drive.file` scope, and offer Drive and Contacts connection only to the super admin (developer) accounts for now; other roles do not connect Drive or Contacts. Code change in this repository only; the old live deployment is not touched. **Done 2026-09-27:** `src/features/auth/superAdmin.js` gates both (token request and buttons); Drive uses Google Picker with `drive.file`; the old file-listing modal is removed. Owner console step before it works on a deployment: enable the **Google Picker API** in the Firebase project's Google Cloud console and make sure the browser API key is allowed to call it.

### DEC-9: Add a LICENSE
- The repository has none. Decide the licence (or that it is proprietary) and add `LICENSE`.
- **Decided (owner, 2026-09-27):** proprietary, all rights reserved. `LICENSE` added.

---

## Money and data integrity

### MON-1: Deal completion must wait for its Final invoice
- **Why:** in `src/features/deals/Deals.jsx`, `handleMoveForwardInner` completes a deal and calls `onSaveInvoice(...)` without waiting for it, inside a `setLeads` updater. `handleSaveInvoice` (`src/App.jsx`) now returns `true` or `false`, and Fabrication's QA pass already aborts on `false`. A failed save still completes the deal and loses the Final invoice.
- **Files:** `src/features/deals/Deals.jsx`, `tests/component/Deals.test.jsx`.
- [x] **Step 1: Write the failing test** in `tests/component/Deals.test.jsx` (see the existing "creates a 25% Final invoice when a deal in Hand Over is moved to Completed" for the setup): render with `onSaveInvoice = vi.fn(async () => false)`, click Move forward on a Hand Over deal, expect the deal is **not** written as `Completed` (`updateDocument` not called with `stage: 'Completed'`) and `toast.error` mentions the invoice.
- [x] **Step 2: Run it and see it fail:** `npx vitest run --config vitest.component.config.js tests/component/Deals.test.jsx`.
- [x] **Step 3: Implement.** Move the invoice save out of the synchronous `setLeads` updater: compute the completion inputs first, `const saved = await onSaveInvoice(...)`, and only if `saved !== false` update the lead and accrue commission. Keep the existing reserved-id and `getExistingFinalInvoice` guards.
- [x] **Step 4: Run the whole component suite and the gate.** Existing tests that pass `onSaveInvoice = vi.fn()` (returns `undefined`) must still pass, so treat only an explicit `false` as failure, like Fabrication does.
- [x] **Step 5: Update `docs/02_modules/deals/CLAUDE.md` and `CHANGELOG.md`; commit.**
- **Done 2026-09-27:** the Final invoice is built from the deal before the `setLeads` update and awaited; a `false` result aborts the move with an error toast. Tests in `tests/component/Deals.test.jsx`.

### MON-2: Stamp `leadId` and `dealId` on every invoice
- **Why:** a Deal is the same lead continuing (`originalLeadId` links back). The Advance invoice is keyed by the lead id (created before conversion) and the Final by the Deal id. Lookups work through `getLineageIds` / `invoicesForLineage` (`src/features/leads/leadLineage.js`), but the stored data is uneven.
- **Files:** `src/features/leads/Leads.jsx` (`handleConvertConfirm`), `src/features/quotations/QuotationBuilder.jsx` (invoice creation), `src/features/deals/Deals.jsx`, `src/features/fabrication/FabricationWorks.jsx` (QA-pass invoice).
- [x] Test first (unit or component): after converting a lead, its existing invoices gain `dealId`; a new Final invoice carries both `leadId` (original) and `dealId`.
- [x] Implement: on conversion, `updateDocument` the lead's invoices with `dealId`; new invoices set both fields from the lineage. Keep reads on `invoicesForLineage`.
- [x] Backfill of old invoices: not needed. Live data is test-only and a fresh environment is planned (DEC-5), so no live data is written.
- **Done 2026-09-27:** `invoiceLineageFields` and `leadForInvoice` in `src/features/leads/leadLineage.js`. `Leads.jsx` stamps `dealId` on the lead's invoices at conversion; `QuotationBuilder.jsx` and `Deals.jsx` stamp both ids on new invoices (`FabricationWorks.jsx` already did, from the job). `handleMarkInvoicePaid` in `App.jsx` updates the Deal when the invoice carries `dealId`, so referral eligibility still follows the Deal. Tests: `tests/unit/leadLineage.test.js`, `tests/component/Deals.test.jsx`, `tests/component/Leads.lineage.test.jsx`.

### MON-3: Two remaining single-id lookups
- `src/features/leads/Leads.jsx` finds a logistics job with `j.leadId === lead.id`; `src/features/invoicing/Invoices.jsx` prints `Lead: <leadId>`. Change both to use `getLineageIds`. Add a unit or component test where the id is the Deal id or the original lead id.
- **Done:** `logisticsJobForLineage` and `lineageIdsForLeadId` in `src/features/leads/leadLineage.js`, used by `Leads.jsx` and `Invoices.jsx` (which now gets `leads` from `App.jsx`). Tests: `tests/unit/leadLineage.test.js`, `tests/component/Leads.lineage.test.jsx`, `tests/component/Invoices.lineage.test.jsx`.

### MON-4: Server-side guard against duplicate invoices
- **Why:** the Advance and Final guards (`getExistingFinalInvoice` in `src/shared/utils/entityUtils.js`, the `isConvertingAdvance` flags) use client state, so two sessions acting at the same moment can create two.
- **Idea:** create a small guard document with a deterministic id (for example `invoice_guards/<rootLeadId>_<Advance|Final>`) in the same write as the invoice, using the existing `createDocumentIfAbsent` transaction in `src/services/firestoreSync.js`; a second attempt fails. Needs a rules block for the new collection and an emulator test. **Live:** rules deploy.

### MON-5: Server-side numbering
- **Why:** counters (`INV-ADV`, `INV-FIN`, `L`, `D`, `PTF`, `QT`, `L-DL`, `L-PK`) are written by the browser in a transaction, and rules can only limit a step to at most one ahead, so any signed-in user can still **lower** a counter. Public forms use clock-based ids (`LD-` in `src/features/partners/ReferralForm.jsx`, `APP-` in `PartnerRegistration.jsx`) because signed-out users cannot write counters; imported contacts use clock-based NIC ids in `src/features/customers/Customers.jsx`.
- **Approach:** a small Vercel function (for example `api/next-id.js`, Admin SDK transaction on `counters/<prefix>`, same auth pattern as `api/admin-user.js`), have `generateAtomicId` call it, then make the rules deny direct writes to `counters`. Public forms can call an unauthenticated, rate-limited variant. **Live:** new function plus a rules change; do after LIVE-1.

### MON-6: Old data
- Leads created before step 6.4b have no saved frame size, so their fabrication jobs stay editable until pricing is applied on the lead. Old jobs keep inline Base64 blueprints; migrate them to Storage once DEC-3 is decided. Legacy manual jobs with a value: DEC-5.

### MON-7: List and alert defaulted-commission leads
- **Why:** a quote with no partner rate uses LKR 30.00, sets `pricingMetadata.commissionRateDefaulted` and shows a warning only to whoever applied the pricing.
- **Build:** a filtered list (Leads or Partners screen) of leads where the flag is true, and a stored notification to Admins and Managers (needs FEA-2's notifications collection). Query key: `pricingMetadata.commissionRateDefaulted == true`.

---

### MON-8: Round the 75 / 25 invoice split to cents
- **Why (found by TST-3, 2026-10-01):** `QuotationBuilder.jsx` computes the Advance and Final amounts as `grandTotal * 0.75` and `* 0.25` and stores them unrounded, so a total of LKR 33,333.33 gives an Advance of 24,999.9975. A characterisation test in `tests/component/QuotationBuilder.test.jsx` and a row in the TESTING.md register lock in the current behaviour.
- **Owner decision (2026-10-02):** round the Advance to cents and make the Final the remainder, so the two always add up to the total. Nothing stored is rewritten.
- **Done:** `splitInvoiceAmounts` in `src/features/quotations/` (Advance = 75% half up to cents, Final = total minus Advance) used by `QuotationBuilder`, `getFinalInvoiceAmounts` (Deals completion fallback) and the Fabrication QA pass; unit test `tests/unit/splitInvoiceAmounts.test.js`, flipped QuotationBuilder test, new Deals and FabricationWorks checks. Not changed (outside this item): `invoiceTemplate.js`, `invoicePrintData.js` and `EmailTemplateModal.jsx` still derive display figures with `* 0.75` / `* 0.25`, so a printed or emailed figure can differ from the stored amount by a cent.
- **Build:** a pure helper in `src/features/quotations/` used by QuotationBuilder, Deals completion and the Fabrication QA pass, with a unit test. Flip the characterisation test.

## Features

### FEA-1: Real partner payout (step 4.1, partners D-1)
- **Why:** `Disburse Payout` on the Partners screen only shows a success toast; nothing is written (a characterisation test records this).
- **Files:** `src/features/partners/Partners.jsx` (the button is near `Disburse Payout`, handler to add: `handleDisbursePayout`), a new pure helper `src/features/partners/payout.js`, `src/services/firestoreSync.js` (`batchWrite`), `src/services/auditLog.js`, `tests/unit/payout.test.js`, `tests/component/Partners.test.jsx`, `tests/integration/rulesAccess.test.js`. The `partner_payouts` and `referral_claims` rules blocks already exist in `firestore.rules` on `staging` (not deployed).
- **Helper shape:**
  ```js
  // src/features/partners/payout.js
  // Returns { leads: [...eligible leads], amount, leadIds } for the referrals whose commState is 'Eligible for Payout'
  export function buildPayout(referrals, partner) { /* pure, no I/O */ }
  ```
- [ ] **Step 1: Write failing unit tests for `buildPayout`:** converted lead stubs excluded, only fully paid deals counted, already `payoutStatus: 'Paid'` skipped, empty input gives `amount: 0`, amounts use each referral's `calculatedCommAmount`.
- [ ] **Step 2: Flip the characterisation test** "shows a success toast on Disburse Payout but writes nothing" in `tests/component/Partners.test.jsx` to expect exactly one `batchWrite` with: a `partner_payouts` create (partnerId, amount, `TXN-######` reference, settled lead ids, `createdAt`, `createdBy`), an update per lead (`payoutStatus: 'Paid'`), and a partner update (reduce `pending`, increase the settled total). Strike its row in the `TESTING.md` register.
- [ ] **Step 3: Implement** `handleDisbursePayout`: build the payout, toast and return if nothing is eligible, disable the button while running, one atomic `batchWrite`, then `logActivity(..., 'PAYOUT_DISBURSED', 'Partners', ...)`, show the reference; on failure toast and leave local state unchanged.
- [ ] **Step 4: Rules test** (add if missing): a non-Admin cannot write `partner_payouts`; a partner can read only its own.
- [ ] **Step 5: Gate, docs (`docs/02_modules/partners/CLAUDE.md`, `FINDINGS.md` checklist D-1, `CHANGELOG.md`), commit.**
- **Live:** works live only after the additive rules are deployed (LIVE-1 step 3). Before that, the batch is rejected by the catch-all rule (safe, but looks broken); do not promote this before the rules.

### FEA-2: Persistent notifications and claim resolution (step 4.3, partners D-11 and D-12, NOTIF-04)
- **Why:** the "commission cleared" notification is an in-memory event seen only by whoever marked the invoice paid; the partner never receives it, and it is lost on refresh. Offline referral claims have a "Verify & Credit Commission" button (`handleVerifyClaim` in `src/features/partners/Partners.jsx`) that does not link the claim to a lead.
- **Files:** `src/services/firestoreSync.js` (`COLLECTIONS.NOTIFICATIONS`), `firestore.rules` (new block), `src/App.jsx` (`handleMarkInvoicePaid`, the listener, `emitNotification`), `src/features/dashboard/NotificationsView.jsx`, `src/features/partners/Partners.jsx`, `src/shared/utils/events.js`, `tests/integration/rulesAccess.test.js`, a claim-modal component test.
- [ ] **Rules first:** add a `/notifications/{id}` block (read by the addressed `recipientEmail` or an Admin; create by staff with `invoices` edit; the recipient may update only a read flag) and emulator tests for each case. Do not deploy.
- [ ] **Write the notification** from `handleMarkInvoicePaid` with `recipientEmail` (the partner's email from `findPartnerForLead`) and `targetRole: 'Partner'`; remove the duplicate local notification; read the user's own notifications in `NotificationsView`.
- [ ] **Claim modal:** an Admin links the claim to an existing lead (sets `partnerId` via `partnerFieldsFor`) or converts it into a new lead with `source: 'Referral'` (id from `generateAtomicId('L')`). Component test both paths.
- **Live:** needs the rules deployed (LIVE-1); this is also the shared prerequisite for MON-7, FEA-5 and FEA-7.

### FEA-3: Fabrication board statuses
- **Why:** `STAGES` in `src/features/fabrication/FabricationWorks.jsx` has five columns (Pending, Ongoing, Ready For Inspection, Revision, Completed). A project with any other status disappears from the board; deleting a deal already sets `Cancelled` (step 6.4a).
- **Build:** a muted read-only **Cancelled** column showing `cancelledReason`; an **On Hold** status with a Hold button (asks for a reason, stores `holdFromStatus`) and a Resume button that returns the job to its previous stage; **Archived** as a "Show archived" filter, allowed only for Completed and Cancelled jobs; an **Other** bucket so an unrecognised status never hides a job. `projectStatusForDealStage` (`src/features/deals/dealProjectSync.js`) already ignores these statuses. Apply DEC-4 (block Final invoice and delivery job for Cancelled) if the owner agrees.
- [x] Tests first in `tests/component/FabricationWorks.test.jsx`: a job with status `Weird` still renders (in "Other"); Hold stores `holdFromStatus`; Resume restores it; Archive is refused for an Ongoing job.
- **Done 2026-10-01:** files `src/features/fabrication/FabricationWorks.jsx`, `src/features/fabrication/fabricationLink.js` (`archiveBlock`); tests in `tests/component/FabricationWorks.test.jsx` (8 new), `tests/unit/fabricationLink.test.js` (archive guard) and `tests/unit/dealProjectSync.test.js` (Cancelled, On Hold, Archived and unknown statuses are ignored). DEC-4 is kept. Archive is an `archived: true` flag (status stays Completed or Cancelled, so the Cancelled guard still applies); "Archive refused for Ongoing" is proved twice: the button is not offered, and `archiveBlock` (unit tested) refuses it in `handleArchiveJob`. No rules change: the `projects` block in `firestore.rules` gates on create/edit permission and does not restrict fields.

### FEA-4: Fleet and driver directory in Firestore (logistics D-7, employees D2)
- **Why:** `FLEET_VEHICLES` and `DRIVER_DIRECTORY` are hardcoded in `src/features/logistics/logisticsEngine.js` and used by `LogisticsCardDetails.jsx`.
- **Build:** store them in `settings/fleet` (or a collection) editable by Admin in Settings; keep the constants as a fallback when the document is missing. Needs a rules block and tests. **Live:** rules deploy.

### FEA-5: Inspection follow-ups
- **Revision alert (inspection #5):** notify the deal's sales owner when a linked job goes to Revision (defect category and notes). Needs FEA-2's stored notifications.
- **"Email client: QA passed" (inspection #8):** a button that previews and sends the `fabrication_ready_inspection` template (exists in `src/constants/emailTemplates.js`, never used) through `/api/send-email`. **`api/send-email.js` only allows eight templates** (`SENDABLE_TEMPLATES`); add this one there deliberately and add an API test. Staff roles only.

### FEA-6: Messaging polish (internal-messaging)
Source: `docs/02_modules/internal-messaging/FINDINGS.md`, section "Resolved Decisions" and its checklist. D-MSG-01, 02 and 10 were addressed by the stricter rules and default matrix (written, not deployed); verify D-MSG-03 against `src/App.jsx` before starting.
- D-MSG-04 typing indicator debounce (800 ms) and channel scoping in `Messages.jsx`
- D-MSG-05 message history scalability and paging in `MessagingContext.jsx`
- D-MSG-06 audio chime and background-tab notifications (respect `audioAlertsEnabled`)
- D-MSG-07 optimistic sends and input recovery on error in `MiniChatDrawer.jsx`
- D-MSG-08 single check for sent, double for read
- D-MSG-09 quoted-reply workflow and one `replyTo` schema
- D-MSG-11 document that broadcast announcements are a future milestone
- D-MSG-12 hide your own sent messages from `NotificationsView.jsx`; remove the dead `onUnreadCountChange` prop
- Rule: one small commit per decision; component test at the cheapest layer for each.
- **Done:** D-MSG-03 was **not** done: `src/App.jsx` mounted `FloatingMessageToast`, `MiniChatDrawer` and the mobile dock's Messages button for every role; all three now need `canAccess(role, 'messages')`. D-MSG-04 (`Messages.jsx`: one typing write per 800 ms, indicator only for the open channel), D-MSG-05 (`MessagingContext.jsx`: listener bounded to 30 days by `documentId() >= msg_<since>`, `loadOlderMessages` and a "Load older messages" button in `Messages.jsx`; no index or rules change), D-MSG-06 (`audioAlert.js` chime unless `audioAlertsEnabled === false`; alerts also fire when the chat is open but the page is hidden or unfocused), D-MSG-07 (optimistic `status: 'sending'` until acknowledged; the drawer and full view restore the text and toast on failure, the toast keeps its reply text), D-MSG-08 (`MessageStatus.jsx`, `isReadByRecipient`), D-MSG-09 (Reply button and cancel in `Messages.jsx`; `buildReplyTo` stores `{ id, text, fromId, senderName }`), D-MSG-11 (boundary in `docs/02_modules/internal-messaging/CLAUDE.md`), D-MSG-12 (already done in Phase 7 step 1; wiring test added). Tests: `tests/component/App.messagingGate.test.jsx`, `Messages.test.jsx`, `MessagingContext.test.jsx`, `MiniChatDrawer.test.jsx`, `FloatingMessageToast.test.jsx`, `NotificationsView.test.jsx`, `tests/unit/messageFilters.test.js`.
- **Left for later:** the `writeBatch` half of D-MSG-02 (`markChatAsRead` and `markAllAsRead` still send one write per message; client only, not in the FEA-6 list). **Wave B (rules):** `typing_indicators` is readable and writable by any signed-in user (`allow read, write: if isAuthenticated()`), so the D-MSG-04 channel check is client-side only and any user can overwrite another's indicator; limit writes to the user's own document and reads to channel participants. **Unverified:** the D-MSG-05 query (`array-contains` plus a `__name__` range) should be served by the automatic single-field index, but the emulator does not enforce indexes; check it once against a real project.

### FEA-7: Notification persistence and toast decoupling
Source: `docs/02_modules/notifications/FINDINGS.md`. NOTIF-01 (sign-out leak) is done; NOTIF-04 is FEA-2.
- NOTIF-02 store system notifications in Firestore (needs FEA-2's collection and rules)
- NOTIF-03 stop mirroring every `toast.*` into the notification centre (`src/shared/utils/toast.js`)
- NOTIF-05 and NOTIF-06 feed integrity in `NotificationsView.jsx` (own messages, "Clear all" for messages)
- NOTIF-07 icon and badge for `type: 'commission'` in `src/shared/ui/TwoToneIcon.jsx`
- NOTIF-08 remove dead `showToast` and the obfuscated helpers `oT()`, `uT()` in `src/App.jsx`

### FEA-8: Profile and user-management items
- Profile write double-updates `partners` (`UserProfile.jsx` and `handleUpdateUser` in `src/App.jsx`): keep one path (`docs/02_modules/profile-settings/FINDINGS.md`, decision 2).
- Employees D7: remove the dead "Execution Plan" (`roadmap`) button in `src/features/profile/UserProfile.jsx`.
- Employees D8: add `active` and `deactivated` to `src/shared/ui/StatusBadge.jsx`, use it in `AgentDatabase.jsx`, fix the `Customer` email default around `AgentDatabase.jsx:L752`.
- Employees D6: send an approval email to staff when an applicant is approved (`employee_invite` is already an allowed template; check whether an `employee_approved` template exists before adding one, and add it to `SENDABLE_TEMPLATES` if so).
- **Done:** profile save: `UserProfile.jsx` no longer writes `partners`; `handleUpdateUser` in `src/App.jsx` is the one path and now also mirrors `location` to `address` and `company` (the Customer branch in `UserProfile.jsx` is untouched). D7: the Execution Plan button and its `Map` icon import are removed. D8: `StatusBadge.jsx` matches `active` (success) and `deactivated` (danger); `AgentDatabase.jsx` renders the member status with it; the Email button passes no `initialTemplateId`, so `EmailTemplateModal`'s role default applies (Partner `partner_approval`, Business Client `client_approval`, staff `employee_invite`, anything else `quote_submission`). D6: no `employee_approved` template existed; it is added to `src/constants/emailTemplates.js` (no password) and to `SENDABLE_TEMPLATES` in `api/send-email.js`. `handleExecuteApproval` in `AgentDatabase.jsx` sends it for a role outside `ROLE_CATEGORIES.EXTERNAL` after `onApprove` writes `users/{email}` (the recipient the SEC-1 check looks up); a partner application approved into a staff role gets `employee_invite` with the admin-set password instead. A failed send shows an error toast and does not undo the approval. Tests: `tests/component/App.profileSync.test.jsx`, `UserProfile.test.jsx`, `AgentDatabase.test.jsx` (status badge, email default, three approval-email cases), `tests/unit/emailTemplates.test.js`, `tests/api/sendEmail.test.js`.

### FEA-9: Employees HR model (employees D1)
- **Accepted design:** extend internal staff documents in `users` with an embedded `hrProfile` (official `employeeId`, department, NIC, join date, emergency contact, compensation). Read `docs/02_modules/employees/FINDINGS.md` section 6 first.
- **Care:** compensation data is sensitive; the `users` rules currently let Admin, self, or roles with `agents` or `messages` view read profiles, so a separate document or a stricter rule is needed before storing pay. Own plan, own PR series; not a small change.

### FEA-10: Task-assignment fields (employees D3)
- **Accepted design:** real user references: `assignedSalesId` on leads and deals, `assignedFabricatorId` on projects, `inspectorId` on QA, `assignedDriverId` on logistics, each pointing at an active `users` record.
- **Build order:** shared helper and picker, then one module per pull request (leads, fabrication, inspection, logistics), each with tests. The QA inspector is already the signed-in user (step 6.4c); reconcile. Depends on FEA-9 only if HR data feeds the picker.

### FEA-11: Staff screen to open partner-application BR/NIC files
- **Why:** since DEC-3 the public registration form stores `brCertPath` and `nicCopyPath` (Storage paths under `partners/applications/`) on the `partner_applications` document, because a signed-out visitor cannot read the file back. Nothing in the app opens them yet.
- **Where:** `src/features/admin/AgentDatabase.jsx` (application review). Resolve each path with `getDownloadURL(ref(storage, path))` on click; `storage.rules` already lets staff read `partners/applications/**`.
- **Test:** a component test that shows "Open BR copy" / "Open NIC copy" for an application with paths, and nothing when the paths are empty.
- **Done:** `AgentDatabase.jsx` adds `brCertPath` / `nicCopyPath` to the normalised application item and renders a Documents row in the review modal with an "Open BR copy" and an "Open NIC copy" button, each only when its path is set; `openApplicationFile` resolves `getDownloadURL(ref(storage, path))`, opens it with `window.open(url, '_blank', 'noopener,noreferrer')` and toasts "Could not open the BR copy." / "...NIC copy." on error. The paths are destructured out before `onApprove`, so they are not written to `users/{email}`. Tests in `tests/component/AgentDatabase.test.jsx` (5: both open in a new tab, only the uploaded one shows, none when empty, error toast and nothing opened, paths not copied to the approved user). Not covered: a real Storage read of an application file (the rules test covers the staff read of `partners/applications/**`).

---

### FEA-12: Batch the read-receipt writes (D-MSG-02, second half)
- **Why (found by FEA-6, 2026-10-01):** `markChatAsRead` and `markAllAsRead` in `src/features/messaging/MessagingContext.jsx` still send one Firestore write per message. Use `batchWrite` from `src/services/firestoreSync.js` (500-write chunks). Client only; a component or unit test on the batching.
- **Done 2026-10-02:** both functions now build one `update` op per unread message and send them through `batchWrite` in chunks of 500 (`sendReadReceipts` in `MessagingContext.jsx`); same messages and `readBy` values as before. A failed chunk is logged and does not stop the others. Tests: `tests/component/MessagingContext.test.jsx` (0, 1, 3 and 501 unread; no `updateDocument`).

### FEA-13: Profile sync: the Customer write path and clearing fields
- **Why (found by FEA-8, 2026-10-01):** `UserProfile.jsx` still writes the `customers` record directly for Customer and Business Client; profile-settings FINDINGS says that write always fails under the current rules (not checked). Profile sync also cannot clear a field: an emptied phone, address or company keeps its old value in `partners` and `customers` (profile-settings finding 7).
- **Build:** route the Customer write through `handleUpdateUser` like the Partner path, or confirm the rule and add one. Write empty values on purpose. Needs a rules test if the rule changes.
- **Done 2026-10-02:** the rule already existed (`firestore.rules` `/customers` self-update of `name`, `photoURL`, `phone`, `address`), so no rules change. The old write failed because the lookup by the real NIC is denied by the read rule and rejected the whole `Promise.all`. `handleUpdateUser` in `App.jsx` now looks the record up by email and writes via `updateDocument`; `UserProfile.jsx` no longer writes `customers`. Phone, address (and company for partners) are written even when empty. Tests: `tests/integration/rulesAccess.test.js` (email query allowed, NIC query denied, clearing allowed), `tests/component/App.profileSync.test.jsx`.
- **Note:** a customer whose `customers.email` differs from their login email is not synced (the rules allow nothing else). The form pre-fills an empty location with `Kadawatha, Sri Lanka`; left as is.

## Security

Read [AUTHORIZATION_MAP.md](../03_security/AUTHORIZATION_MAP.md) first: no file overrides another; Firestore rules combine with OR, so only a broad `allow` widens access.

### SEC-1: Check the recipient in `api/send-email.js`
- Staff-only and seven-template-only were done on 2026-09-21. **Open:** a staff session can still send those templates to any address. Restrict the recipient to known records (`users`, `pendingUsers`, `customers`, `partners`, `partner_applications`). **Care:** some approval flows email an address before its record exists (`client_approval`, `partner_approval`, `registration_declined`), so test each caller in `Customers.jsx`, `Partners.jsx` and `AgentDatabase.jsx` before enforcing. Tests in `tests/api/sendEmail.test.js`.
- **Done 2026-09-27:** `isKnownRecipient` in `api/send-email.js` looks the address up (as given and lower-cased) as a `users` / `pendingUsers` document id and as the `email` field of `customers`, `partners` and `partner_applications`; no match is a 403. Traced callers: `client_approval` / `client_activation_confirmed` (`Customers.jsx`) and `partner_approval` / `partner_activation_confirmed` (`Partners.jsx`) send after their record is added; `employee_invite` and `password_reset` (`AgentDatabase.jsx`, `Partners.jsx`) go to an existing `users` document; `registration_declined` (`AgentDatabase.jsx`) now sends before `onReject` deletes the `pendingUsers` document, and a rejected partner application keeps its document. Limit: a partner application whose `email` was typed in mixed case is looked up by the lower-cased identifier and will not match, so its decline email is refused (logged, not shown). Tests: `tests/api/sendEmail.test.js`, `tests/component/AgentDatabase.test.jsx`.

### SEC-2: Restrict `api/generate.js`
- Any approved account, including Partner and Customer, can call the AI endpoint and spend the Gemini quota. Apply the same staff-role gate as `send-email` (`SYSTEM_ROLES` minus `ROLE_CATEGORIES.EXTERNAL`) and add API tests for each external role.
- **Done 2026-09-27:** `STAFF_ROLES` in `api/generate.js` (same expression as `api/send-email.js`) is checked after the token and approved/active checks; any other role gets a 403 and Gemini is not called. Tests: `tests/api/generate.test.js` (Partner, Business Client, Customer, unknown and missing role refused; Admin, Manager, Sales let through).

### SEC-3: Make the dev proxy safe
- `vite.config.js` re-implements `/api/admin-user` for `npm run dev` **without** token or role checks, and the dev server binds to `0.0.0.0` (`package.json` scripts pass `--host 0.0.0.0`). Bind to localhost by default and make the proxy call the real handler or apply the same checks.
- **Done 2026-09-27:** `apiProxyPlugin` in `vite.config.js` maps `/api/admin-user`, `/api/generate` and `/api/send-email` to the real handlers in `api/`, parsing the JSON body (400 if malformed) and adding `res.status` / `res.json`; the dev-only `/api/generate-invoice` alias is dropped. `server.host` is `127.0.0.1` and `allowedHosts: true` is removed; `dev`, `dev:emulated` and `preview` no longer pass `--host 0.0.0.0`. Tests: `tests/api/devProxy.test.js` (binding and scripts; admin-user without token 401 and as Sales 403 with no account created, as Admin 200; generate as Partner 403 with no Gemini call; send-email without token 401; malformed JSON 400; other paths passed to Vite).

### SEC-4: Console-only checks (owner)
- Firebase Console: Project settings, Users and permissions: who has access to `print-to-frame-erp`. IAM: what role the service account whose key is stored in Vercel holds. Vercel: who can edit environment variables. Record the outcome in `AUTHORIZATION_MAP.md`.

### SEC-5: Store the service-account key as a Sensitive variable (owner)
- In Vercel project `print-to-frame-system`, `FIREBASE_SERVICE_ACCOUNT_JSON` is a normal encrypted variable targeted at development, preview and production and is flagged `readable-secret`. Recreate it as **Sensitive** (its value cannot be read back afterwards). Do the same in the live project. Rotate the key if it may have been exposed.

### SEC-6: Public partner profile document (partners D-5)
- The public referral form needs a partner's name and status, but a partner document holds bank details and rules cannot hide fields. Create `partner_public/{partnerId}` (name, status, logo, nothing sensitive) written when a partner is approved or edited, world-readable in rules; `ReferralForm.jsx` reads only that. Migrate existing partners. **Live:** rules deploy.

### SEC-7: Partner limited to its own record
- Full design in `docs/05_decisions/0002-deferred-until-live-rollout.md`: a rules helper `ownsPartner(partnerId)`; staff-only reads except the partner's own; a Partner may update only its profile fields, never `commissionRate`, `status` or balances; `App.jsx` queries `where('email', '==', identifier)` for a Partner. **Check first:** partner emails that differ in case from the login email would stop matching. Today a Partner can save a changed `commissionRate` through the profile form.

### SEC-8: Partner-scoped reads (partners D-9)
- Let a partner read only its own referred leads and invoices (rules on `leads` and `invoices`, plus scoped subscriptions in `src/App.jsx`). Builds on SEC-7.

### SEC-9: Effective-access test
- An emulator test that loads a permission matrix and prints, for every role, collection and operation, whether the **deployed** rules (`git show origin/main:firestore.rules`) and the **new** rules allow it. Use the live matrix (copy it from the console into a JSON file kept outside the repository) to settle "which rule actually wins" with data. Start from `tests/helpers/emulator.js` (`PERMISSIONS_FIXTURE`) and `tests/integration/rulesAccess.test.js`.
- **Done 2026-09-27:** `tests/integration/effectiveAccess.test.js` runs read, create, update and delete for every role in `PERMISSIONS_FIXTURE` (and signed out) on leads, deals (`leads` with `isDeal`), quotations, invoices, receipts, customers, partners, projects, logistics, users, pricing and auditLog, first under `git show origin/main:firestore.rules`, then under the working-tree rules, and prints both side by side. It fails if the working-tree rules grant anything other than what the matrix implies (`expectedAccess` in `tests/helpers/effectiveAccess.js`, which mirrors `checkPermission`), or if they differ from `origin/main` outside the test's `EXPECTED_RULE_CHANGES` list (empty today: the two files are identical). `origin/main` is the ruleset the repository would deploy; the live Firestore rules engine may still run an older one, since rules go live only with `firebase deploy`. `LIVE_PERMISSIONS_JSON=<path outside the repo>` runs the same check with a copy of the live matrix; it is skipped when unset or missing and refused if the path is inside the repository. The CI `rules` job now checks out full history so `origin/main` exists. `tests/unit/effectiveAccess.test.js` covers the helper and checks `PERMISSIONS_FIXTURE` equals `DEFAULT_PERMISSIONS` for every module it holds. **What the data shows:** the rules OR create and edit together (`create, update: if ... create || edit || write`), so a create-only or edit-only grant opens both: Operations (invoices view+create) can update invoices, and Partner (partners view+edit) can create partner documents. Deleting a deal needs `leads:delete`, not `pipeline:delete`. Running it against the live matrix is an owner step (copy the document from the console).

### SEC-10: Restrict the browser API key to the app's domains
- **Why:** the Firebase browser key ("Browser key (auto created by Firebase)" in project `print-to-frame-erp`) has API restrictions but no website restrictions, so any site can use it for the APIs it allows (checked read-only 2026-09-27).
- **Owner steps:** Google Cloud console → APIs & Services → Credentials → that key → Application restrictions: Websites → add the production domain(s), the Vercel preview domain pattern and `localhost` origins. Do it once LIVE-3 settles the production domain, then check sign-in and the Drive Picker still work.

### SEC-11: Deactivated users can still sign in
- **Why (TST-2 finding):** `handleToggleStatus` in `src/features/admin/AgentDatabase.jsx` sets only `status: 'Deactivated'` and leaves `isApproved: true`. The login check in `src/App.jsx` admitted `userData.isApproved || userData.status === 'Active' || userData.status === undefined`, so a deactivated user reached the Dashboard. The live eviction (`shouldEvict` in `syncSelf`) did not sign them out either.
- **Files:** `src/features/auth/authFlow.js`, `src/App.jsx`; tests in `tests/unit/authFlow.test.js`, `tests/component/App.eviction.test.jsx`, `tests/integration/rulesAccess.test.js`, `tests/e2e/rbac.spec.js`, seed in `tests/fixtures/seed.mjs`.
- **Done 2026-10-01:** the login check is `canSignIn(record, isBootstrapAdmin)` in `authFlow.js`: a bootstrap super admin always passes (the self-heal is unchanged); otherwise a record that `shouldEvict` would evict (Deactivated or Disabled status, or `isApproved === false`) is refused, and the rest keep the old rule (`isApproved`, `status === 'Active'`, or no status). **Why eviction failed:** every role that holds `agents` or `messages` view (all staff roles) fed `syncSelf` only from the `users` collection listener, and `firestore.rules` refuse that list query to a caller who is not `isActiveUser()`. A Deactivated user therefore never received their own record through it, whether they signed in already deactivated (TST-2) or were deactivated mid-session (reproduced in `rbac.spec.js` before the fix). Customers and Partners used their own-document listener and were evicted. `App.jsx` now always listens to the user's own document (which the rules let the user read in any status) and runs `syncSelf` from it; the collection listener only fills the user list. Tests: `canSignIn` unit cases (Deactivated with `isApproved` true refused, Active passes, pending refused, bootstrap admin passes); component cases for the login gate and for a staff user whose list listener is refused; a rules case (a Deactivated user reads their own document but cannot list `users`); `rbac.spec.js` now expects the deactivated user to see the sign-in form and adds a mid-session deactivation journey (seed user `evicted@example.com`).
- **Rules:** no change needed. `isActiveUser()` already refuses Deactivated and Disabled accounts everywhere except reading their own `users` document, which the login check and eviction need. That rule is part of the step 3.5 set, written and tested but not deployed; server-side refusal on the live project arrives with the LIVE-1 rules deploy.

---

### SEC-12: Scope `typing_indicators` rules to the chat's participants
- **Why (found by FEA-6, 2026-10-01):** `firestore.rules` has `allow read, write: if isAuthenticated()` on `typing_indicators`, so any signed-in user can read or overwrite anyone's typing indicator. The FEA-6 channel check exists only in the app.
- **Build:** allow a write only when the caller is the indicator's own user, and a read only to the channel's participants. Add an emulator rules test. **Live:** Wave B, goes out with the next rules deploy.

## Tests

### TST-1: Component tests for the lead card
- `src/features/leads/LeadCardDetails.jsx` (about 1,776 lines) has none. Cover: the Convert button shows only at the `Received` stage; choosing an agent fills `partnerId`, names and the partner's rate and changes the quote's commission (`partnerFieldsFor`, `pricingLeadView`); invoice reprint uses the saved invoice as issued (`resolveInvoiceForPrint`); oversized audio is downsampled, not rejected. The lead card is heavy to render: mock `@/services/firestoreSync`, `@/services/gemini` and `@/shared/utils/toast`, as `tests/component/FabricationCardDetails.test.jsx` does.
- **Done 2026-09-27:** `tests/component/LeadCardDetails.test.jsx`, 6 tests: Convert to Deal shows only at `Received` (not at other stages or once converted); choosing an agent saves `agentId`, `partnerId`, both names and the partner's rate, and switching agents changes the quoted rate per sq ft; the Advance reprint passes the saved invoice's id, amount, total and customer name (not the renamed lead); with no invoice saved the Final print is `DRAFT-FINAL` at 25%; a 4 MB WAV goes through `downsampleAudio` and is accepted, a small MP3 is sent as-is. No bug found.

### TST-2: End-to-end journeys (B6)
- **Money journey:** quotation to Advance invoice to Final invoice, exactly one `INV-FIN`. **RBAC journey:** Admin, Sales, Partner and Customer each see only their navigation; the seeded deactivated user cannot sign in. Needs `tests/fixtures/seed.mjs` extended with Sales, Customer and Manager users. Specs go in `tests/e2e/`, run with `npm run test:e2e` (Playwright against the emulators; see `tests/e2e/README.md`). Should exist before the restrictive rules are deployed.
- **Done:** `tests/e2e/money.spec.js` (1 test: quotation to Advance to Final, exactly one `INV-FIN`), `tests/e2e/rbac.spec.js` (6 tests: Admin, Manager, Sales, Partner, Customer navigation, deactivated user), seed extended with Sales, Manager, Customer and a money-journey deal.
- **Finding (not fixed, tests only):** a deactivated user can still sign in. `AgentDatabase.jsx` `handleToggleStatus` sets only `status: 'Deactivated'` and leaves `isApproved: true`; the login check in `App.jsx` admits `userData.isApproved || userData.status === 'Active' || ...`, so the user reaches the Dashboard. The live eviction (`shouldEvict` in `syncSelf`) did not sign the user out within the test either (cause not verified). `rbac.spec.js` records the current behaviour; flip it when the login check honours `status`. **Fixed by SEC-11** (login check and eviction; the test is flipped).

### TST-3: More coverage
- No component tests yet for `Leads`, `QuotationBuilder`, `Customers`. Add wiring tests where money moves (quote to invoice). Then run `npm run coverage` and refresh the coverage map and register in `docs/04_workflows/TESTING.md`.
- **Done:** `tests/component/QuotationBuilder.test.jsx` (13 tests: discount then tax per line and the 75 / 25 split; save creates `QT` quote v1 through `generateAtomicId` and syncs the lead value; update in place; clone to the next version; the Advance invoice at 75% with the id from `generateInvoiceId('Advance')`, both lineage ids, `quotationId`, and the quote marked Invoiced; the Final at 25% with `advancePaid` 75% for a deal; no invoice button for Draft, Sent or Rejected; Final on a plain lead only once the Advance is Paid; static confirmation once an invoice exists; nothing saved when the number cannot be allocated; one invoice per double click), `tests/component/Leads.test.jsx` (13 tests: pipeline value excludes deals; `onSaveInvoice` wired through the lead card to the Advance and Final invoices; stage advance writes the stage and no invoice; the conversion modal's quoted value and 75%; `D` and `PTF` ids from `generateAtomicId`, deal, lead and project writes; an existing job number kept; nothing written when an id fails; a converted lead not converted twice; customer order count by phone spelling, or an `AUTO-` customer; `dealId` stamped on the lead's invoices) and 6 new tests in `tests/component/Customers.test.jsx` (billing panel lists the lineage's invoices with amounts and no one else's; NIC and exact-name matching; empty state; register saves one order under the NIC and refuses a duplicate; deleting a Business Client removes its `users` document and login, an Individual only the customer). Coverage map and register refreshed in `TESTING.md`.
- **Finding (not fixed, characterised):** `QuotationBuilder` splits the grand total with plain `* 0.75` and `* 0.25` and stores the result unrounded, so a total of LKR 33,333.33 gives an Advance `amount` of 24,999.9975; the screen rounds to cents for display only. Locked by "stores unrounded amounts when the total does not divide into whole cents" in `QuotationBuilder.test.jsx`. A fix (round the split to cents and make the Final the remainder so the two add to the total) touches invoice numbers, so it is an owner call; it would flip that test.

### TST-4: Manual check of Picker attach and staff uploads on a deployment
- On this repository's Vercel deployment (not the old portal): as the super admin, attach a Drive file to a quotation through the Picker; as an Operations user, upload a blueprint on a fabrication card; as an Admin, upload a partner document; submit a public partner registration with a BR copy. Each should succeed; as a Partner, the vault upload should be refused. Record the result in `CHANGELOG.md`.

---

## Engineering health

### ENG-1: Split the very large files
- Over 800 lines: `src/features/partners/Partners.jsx` 1,809, `src/features/leads/LeadCardDetails.jsx` 1,776, `src/features/fabrication/FabricationWorks.jsx` 1,657, `src/App.jsx` 1,641 (state, listeners and handlers mixed), `src/features/admin/AgentDatabase.jsx` 1,358, `src/features/customers/Customers.jsx` 1,113, `src/features/logistics/Logistics.jsx` 1,051, and others. **Method:** tests first (TST-1, TST-3), then extract logic and sub-components into the feature's own folder one at a time, no behaviour change, full gate each step. Start with `App.jsx` (extract the Firestore listeners and the invoice and receipt handlers into hooks under `src/`).

### ENG-2: Add Prettier
- Its own pull request, done after ENG-1 so the formatting churn does not bury real changes. Add `prettier` and a `format` script; the repo already has `.editorconfig` (2 spaces, LF).

### ENG-3: Repository hygiene
- `public/portal-login-template.html` and `public/web and erp design theme.md` (unused? verify with a search first); the `@google/genai` dependency (the browser calls the AI through the server proxy, so it may be used only by `vite.config.js`; verify); about 90 stale `claude/*` branches on the remote (list with `git branch -r`, delete only merged ones with the owner's OK); a pull request template under `.github/`; `LICENSE` (DEC-9). **Milestone 1:** `LICENSE` done (DEC-9); merged `claude/*` branches cleaned.

### ENG-4: Remove the two unused Firestore databases from `firebase.json`
- The owner confirmed (2026-09-21) that `ai-studio-printtoframeerp-...` and `ai-studio-printtoframe-...` are unused. Removing their entries makes a rules deploy touch `(default)` only. The databases themselves can be deleted later, separately, with the owner's go. Do this before the rules deploy in LIVE-1.
- **Done:** `firebase.json` `firestore` now holds the `(default)` entry only (emulators, hosting and storage untouched); `tests/unit/firebaseJson.test.js` (2 tests) fails if another database or an emulator is dropped. The `claude/rules-3-4d-deploy` branch still carries the old three-database file. Docs updated: `GCP_INVENTORY.md`, `DEPLOY_PROCESS.md`, `LIVE_ROLLOUT.md`, `FIRESTORE_RULES_NOTES.md`, ADR 0002.

### ENG-5: Unsafe release scripts
- `package.json` has `push:staging` (`git add .` then commit and push) and `deploy:live` (merge and push `main`). They commit everything blindly and skip review. Replace them with the documented steps in `docs/04_workflows/DEPLOY_PROCESS.md`, or remove them, with the owner's OK.

### ENG-6: Documentation that no longer matches reality
- Root `CLAUDE.md`, "Branching & deployment workflow": it says `main` is production and mentions two skills under `.agents/skills/`. Today production deploys from the original repository, and `.agents/skills/` is not in this repository. Correct it (see LIVE-3). Also re-check `docs/04_workflows/DEPLOY_PROCESS.md` and `GIT_WORKFLOW.md` once the deploy path is settled. **Partly done in Milestone 1** (PLAN, handoff, git workflow, root `CLAUDE.md`, README, index, module maps); re-check again after LIVE-3.

---

### ENG-7: Coverage and CI gaps
- **Why (found by TST-3 and the Wave A run review, 2026-10-01):** `npm run coverage` counts unit and API tests only (13.41% statements), not the component layer (41.9% measured with a one-off command, documented in TESTING.md). CI skips the e2e job on PRs into `staging`, so e2e first runs in CI on the promotion PR to `main`. None of the 8 PRs in the 2026-10-01 run had e2e in CI.
- **Build:** a `coverage:all` script that includes the component config, and run the e2e job on PRs into `staging` when `src/`, `tests/e2e/` or `tests/fixtures/` change (the `changes` job already filters paths).
- **Done (ENG-7 PR):** `npm run coverage:all` (unit and API 13.54%, component 43.33% statements, reported separately) and the e2e job now runs for PRs into `staging` and `main`.

## Live rollout and environments

These change the live project. Nothing here has been applied. Each step needs the owner's explicit go.

### LIVE-1: Live rollout (matrix, code, rules)
- Fully written in [LIVE_ROLLOUT.md](LIVE_ROLLOUT.md): pre-flight, verification and rollback for each step. Summary for a non-technical reader:
  1. **Permission matrix.** The table of which role can do what lives in one Firestore document. The live copy has no `quotations` or `receipts` rows, and the new code hides any screen whose row is missing. An Admin fixes this with one button (Permissions Manager, on the staging preview, which uses the live database) and Save. This is invisible to the old code, so it goes first, any time.
  2. **Code.** The live site runs the old code because it deploys from the original repository. Either reconnect the live Vercel project to this repository (LIVE-3, recommended) or copy the code into the original repository.
  3. **Rules.** Firestore security rules are deployed by hand, not by pushing. Deploy the additive set first (branch `claude/rules-3-4d-deploy`, commit `1776444`: the 3.4 rules plus the `L` and `D` counter prefixes; **not** the bare 3.4 commit, which would reject new lead and deal ids), check each role, and only later the stricter set from `staging`. The stricter set's `isActiveUser()` is the server-side half of SEC-11 (Deactivated and Disabled accounts refused everywhere but their own `users` document); after deploying it, check that a deactivated staff account is refused at sign-in and signed out mid-session.
- **Owner actions:** a backup of the matrix, a smoke test on the preview, the go for each step, and the Vercel reconnect. Until this is done, the live site keeps working as it is, but the security fixes on `staging` (send-email hardening, stricter rules) do not take effect.

- **Post-deploy checks added 2026-10-01:** the D-MSG-05 message-history query (`participants` array-contains plus a `documentId() >= msg_<since>` range) should run without a custom composite index, but the emulator does not enforce indexes, so check it once on the real project. `claude/rules-3-4d-deploy` still has the three-database `firebase.json`; deploy with `--only firestore:rules` from a branch that has ENG-4, or note that the two extra databases are unused.

### LIVE-2: Separate staging and production environments (Part 1)
- **Why:** the app has one Firebase project and one Firestore, so rules and matrix changes can only be tested on live data. Goal: a real staging environment sharing nothing with production.
- **Design:** local emulator + a new staging Firebase/GCP project (for example `print-to-frame-erp-stg`) + production; staging domain `portal-staging.print2frame.xyz`; staging holds synthetic data only and cannot email real addresses.
- **Tasks (each its own pull request, in this order):**
  - [ ] **E2.1 Fail closed:** `src/services/firebase.js` must refuse to start without `VITE_FIREBASE_*` (today it falls back to `firebase-applet-config.json`, hard-wired to the live project); add `VITE_APP_ENV` and a visible ribbon when not production; test the validator and the ribbon.
  - [ ] **E2.2 CLI aliases:** add `.firebaserc` with `staging` (default) and `production`, so a bare `firebase` command can never hit production; scripts `deploy:rules:staging` and a guarded `deploy:rules:prod`.
  - [ ] **E2.3 Origins from environment:** replace the hardcoded `ALLOWED_ORIGINS` arrays in `api/generate.js`, `api/send-email.js`, `api/admin-user.js` with one `api/_lib/cors.js` reading `ALLOWED_ORIGINS`.
  - [ ] **E2.4 Remove hardcoded URLs:** `src/constants/companyInfo.js`, `src/constants/emailTemplates.js`, `src/shared/components/EmailTemplateModal.jsx`, `src/features/partners/PartnerQRModal.jsx` and `Partners.jsx` use `VITE_APP_URL`, `VITE_SUPPORT_EMAIL`, `VITE_PUBLIC_SITE_URL`.
  - [ ] **E2.5 Staging cannot email real people:** `api/send-email.js` outside production sends only to `EMAIL_ALLOWLIST` and prefixes `[STAGING]`.
  - [ ] **E2.6 Docs:** `docs/04_workflows/ENVIRONMENTS.md` (matrix, promotion runbook, incident note).
  - [ ] **E4.1 Seed script:** `scripts/seed-staging.mjs` with hard guards (refuses any project id that is not the staging one).
- **Gate:** never merge E2.1, E2.3 or E2.4 into whatever production deploys from before the matching Production-scope Vercel variables exist, or the live site breaks. Owner tasks: create the staging Firebase project, Vercel scopes and DNS, per-environment keys, budget alerts, two-factor authentication, branch protection. Because production deploys from a different repository today, settle LIVE-3 first.

### LIVE-3: One canonical repository and one deploy path
- **Facts:** the live Vercel project `print-to-frame-erp` deploys `main` of `madhukagamage6/Print-To-Frame-ERP-System`; this repository has no shared git history with it, but its source code is nearly identical (only two files differed under `src/`, `api/` and the rules at the time of the copy, both from test work).
- **Recommended path (B1):** in the live Vercel project, Settings, Git: disconnect the original repository, connect `madhuka-m-gamage/Print-To-Frame-System` with Production Branch `main`. Confirm first that the GitHub app can be installed for the `madhuka-m-gamage` account in the Vercel team that owns the project. Rollback: reconnect the original repository, or Vercel's Instant Rollback.
- **Fallback (B2):** keep Vercel as it is and apply this code to the original repository as one change through its usual pull-request flow. Histories are unrelated, so this is not a merge and loses detailed history there.
- Then archive the other locations and fix ENG-6.

### LIVE-4: Give the tooling access to the live Vercel project
- The Vercel connection used in these sessions sees only the team `print-to-frame1`, whose one ERP project (`print-to-frame-system`) is a preview project. The live project is in another Vercel team, so its variables and deployments could not be read. Either connect that account to the tooling or check by hand (first check: no `VITE_FIREBASE_DATABASE_ID` override).

---

## Where each item came from

The original per-step prompts and the audit findings are in `docs/HANDOFF_REPORT.md` and each `docs/02_modules/<module>/FINDINGS.md`. The steps of Phase 7 that shipped are listed in `CHANGELOG.md`. The short list in `PLAN.md` ("Follow-up backlog") points here.

## Self-review

- **Coverage:** every item in the `PLAN.md` follow-up backlog and the deferred list has an ID here (invoice ids, lookups, duplicate guard, counters and public ids, commission default, defaulted-commission list, Drive scope, lead-card tests, D-5, own-record, fabrication statuses, Storage, legacy jobs, frame size, inspection #5 and #8, deal completion await, fleet, cash on delivery, large files, Prettier, hygiene, `firebase.json`, Vercel keys and access, role review, repositories, security sweep, effective-access test, steps 4.1, 4.3, 7, B6, live rollout, environments).
- **Placeholders:** none. Where a step depends on an owner answer the item says so instead of guessing; where the exact template or field could not be verified (FEA-8 `employee_approved`), the item says to check first.
- **Consistency:** helper and file names (`partnerFieldsFor`, `pricingLeadView`, `getLineageIds`, `invoicesForLineage`, `SENDABLE_TEMPLATES`, `resolveInvoiceForPrint`) match the code as of 2026-09-21.
