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
| FEA-1 | Real partner payout (step 4.1) | feature | M | rules | no | LIVE-1 (to work live) |
| FEA-2 | Persistent notifications and claim resolution (step 4.3) | feature | L | rules | no | none |
| FEA-3 | Fabrication board statuses: Cancelled, On Hold, Archived, Other | feature | M | no | DEC-4 | none |
| FEA-4 | Fleet and driver directory in Firestore | feature | M | rules | no | LIVE-1 |
| FEA-5 | Inspection: revision alert and "Email client: QA passed" | feature | M | api | no | FEA-2 |
| FEA-6 | Messaging polish (D-MSG items) | ux | L | no | no | none |
| FEA-7 | Notification persistence and toast decoupling | ux | M | rules | no | FEA-2 |
| FEA-8 | Profile and user-management items | ux | S | no | no | none |
| FEA-9 | Employees HR model | feature | L | rules | no | none |
| FEA-10 | Task-assignment fields across modules | feature | L | rules | no | FEA-9 |
| SEC-1 | Check the recipient in `api/send-email.js` | security | S | api | no | none |
| SEC-2 | Restrict `api/generate.js` to staff roles | security | S | api | no | none |
| SEC-3 | Make the dev proxy safe | security | S | no | no | none |
| SEC-4 | Console-only security checks | security | S | consoles | owner | none |
| SEC-5 | Store the service-account key as a Sensitive variable | security | S | Vercel | owner | none |
| SEC-6 | Public partner profile document (partners D-5) | security | M | rules | no | LIVE-1 |
| SEC-7 | Partner limited to its own record | security | M | rules | no | LIVE-1 |
| SEC-8 | Partner-scoped reads on leads and invoices (partners D-9) | security | M | rules | no | SEC-7 |
| SEC-9 | Effective-access test (which rule wins) | security | M | no | no | none |
| TST-1 | Component tests for the lead card | tests | M | no | no | none |
| TST-2 | End-to-end journeys (money, RBAC) | tests | L | no | no | none |
| TST-3 | Tests for Leads, QuotationBuilder, Customers; refresh the coverage map | tests | M | no | no | none |
| ENG-1 | Split the very large files | health | L | no | no | TST-1, TST-3 |
| ENG-2 | Add Prettier | health | S | no | no | ENG-1 |
| ENG-3 | Repository hygiene | health | S | no | partly | DEC-9 |
| ENG-4 | Remove the two unused Firestore databases from `firebase.json` | health | S | deploy target | no | none |
| ENG-5 | Unsafe release scripts in `package.json` | health | S | no | no | none |
| ENG-6 | Documentation that no longer matches reality | health | S | no | no | none |
| LIVE-1 | Live rollout: matrix, code, rules | rollout | M | **yes** | **yes** | DEC-6 |
| LIVE-2 | Separate staging and production environments (Part 1) | rollout | L | **yes** | yes | LIVE-3 |
| LIVE-3 | One canonical repository and one deploy path | rollout | M | **yes** | yes | DEC-6 |
| LIVE-4 | Give the tooling access to the live Vercel project | rollout | S | Vercel | owner | none |

**Suggested order when there is no other guidance:** decisions the owner can answer in a sentence (DEC-1, DEC-4, DEC-5, DEC-8) then the small money fixes (MON-1, MON-3, MON-2), the security items that need no live change (SEC-1, SEC-2, SEC-3, SEC-9), the lead-card tests (TST-1), then features (FEA-3, FEA-1, FEA-2, FEA-5). Do the live items (LIVE-x, SEC-6 to SEC-8, FEA-4) together in one sitting with the owner, because each needs a deploy by hand.

---

## Owner decisions

Each is a question only the owner can answer. Record the answer in `PLAN.md` and `CHANGELOG.md`, then unblock the dependent item.

### DEC-1: One default partner commission rate
- **Why:** a referral lead with no partner rate is quoted at **LKR 30.00 per sq ft** (`DEFAULT_REFERRAL_COMMISSION_RATE` in `src/features/quotations/quotePricing.js`, decided by the owner and flagged with `pricingMetadata.commissionRateDefaulted`), but other places still fall back to **LKR 53.50**: the new-partner default and payout maths in `src/features/partners/Partners.jsx`, the payment-cleared handler in `src/App.jsx`, and the deal commission fallback in `src/features/deals/dealSettlement.js`.
- **Ask the owner:** which single number, and is it per sq ft for every case?
- **Then:** find every use with `grep -rn "53.5" src`, replace with one exported constant, update the tests that pin 53.5 (`tests/component/Deals.test.jsx`, `tests/unit/dealSettlement.test.js`), and note it in `docs/02_modules/partners/CLAUDE.md`.

### DEC-2: May drivers record cash on delivery
- **Why:** step 6.5b added "Record cash collection" on the delivery card, shown only to roles that can edit invoices and create receipts (Admin and Manager today). The Logistics role has read-only invoices and no receipts in `DEFAULT_PERMISSIONS`, and the live matrix gives Logistics full `invoices` but no `receipts` module.
- **Options:** (a) drivers record it, which needs Logistics `receipts: create` in the matrix and later rules; (b) a dispatcher (Manager or Accounts) records it for them (no change).
- **Live:** option (a) writes the live matrix (LIVE-1) and depends on the rules deploy.

### DEC-3: Enable Firebase Storage, or drop uploads
- **Why:** the live project has **no active Storage rules** (read-only check, 2026-09-21), so uploads are expected to fail: public partner registration documents (`src/features/partners/PartnerRegistration.jsx`, falls back to a placeholder name), the Partners screen document upload (`src/features/partners/Partners.jsx`), and fabrication blueprints (`src/features/fabrication/FabricationCardDetails.jsx`, keeps files under 500KB inline and rejects larger ones). The bucket `print-to-frame-erp.firebasestorage.app` exists.
- **Options:** enable Storage with narrow rules (signed-in write to `blueprints/` and `partners/`; the anonymous registration form needs its own design), or remove the upload features.
- **Live:** yes (Storage rules are deployed by hand).

### DEC-4: Cancelled projects: block a Final invoice and a delivery job
- **Recommended: yes.** A deleted deal marks its project `Cancelled` (step 6.4a). Block QA-pass Final invoice creation and delivery-job creation for a Cancelled project, with a clear message.

### DEC-5: Old manual fabrication jobs that still carry a value
- New manual jobs carry no value (billed through a deal or marked non-billable). Older ones may have `value > 0` and still get a 25% Final invoice at QA pass. **Ask:** leave them, clear the value, or link them to a deal? To count them, query `projects` for `origin != 'manual'` with `value > 0` and no `dealId`.

### DEC-6: Which repository is canonical
- Three places exist: the original personal repository `madhukagamage6/Print-To-Frame-ERP-System` (own history, last commit 2026-09-15, what production deploys from), this repository, and an old local folder. The owner has said this repository is the correct one. **Ask:** approve LIVE-3 (reconnect the live Vercel project here) and archive the others.

### DEC-7: Role breadth and the two new modules
- The live matrix differs from the defaults in 58 cells (see `docs/03_security/RBAC_MODEL.md`): Support has edit on most modules including `agents`; Logistics has full `invoices`; Operations edits `leads`, `pipeline` and `agents`; Manager has `admin`. **Ask:** is any of that more than the business intends? Changing it needs no code: an Admin edits cells in Permissions Manager. Also decide whether Operations and Logistics need `quotations` or `receipts` view (the migration defaults give them none).

### DEC-8: Google Drive and Contacts access
- Drive uses the restricted `drive.readonly` scope; Contacts uses `contacts.readonly`. Staff click through Google's "unverified app" warning. **Options:** use Google Picker with the narrow `drive.file` scope (no verification needed; a code change in `src/services/driveService.js` and `src/shared/components/GoogleDrivePickerModal.jsx`), and/or submit the OAuth app for verification.

### DEC-9: Add a LICENSE
- The repository has none. Decide the licence (or that it is proprietary) and add `LICENSE`.

---

## Money and data integrity

### MON-1: Deal completion must wait for its Final invoice
- **Why:** in `src/features/deals/Deals.jsx`, `handleMoveForwardInner` completes a deal and calls `onSaveInvoice(...)` without waiting for it, inside a `setLeads` updater. `handleSaveInvoice` (`src/App.jsx`) now returns `true` or `false`, and Fabrication's QA pass already aborts on `false`. A failed save still completes the deal and loses the Final invoice.
- **Files:** `src/features/deals/Deals.jsx`, `tests/component/Deals.test.jsx`.
- [ ] **Step 1: Write the failing test** in `tests/component/Deals.test.jsx` (see the existing "creates a 25% Final invoice when a deal in Hand Over is moved to Completed" for the setup): render with `onSaveInvoice = vi.fn(async () => false)`, click Move forward on a Hand Over deal, expect the deal is **not** written as `Completed` (`updateDocument` not called with `stage: 'Completed'`) and `toast.error` mentions the invoice.
- [ ] **Step 2: Run it and see it fail:** `npx vitest run --config vitest.component.config.js tests/component/Deals.test.jsx`.
- [ ] **Step 3: Implement.** Move the invoice save out of the synchronous `setLeads` updater: compute the completion inputs first, `const saved = await onSaveInvoice(...)`, and only if `saved !== false` update the lead and accrue commission. Keep the existing reserved-id and `getExistingFinalInvoice` guards.
- [ ] **Step 4: Run the whole component suite and the gate.** Existing tests that pass `onSaveInvoice = vi.fn()` (returns `undefined`) must still pass, so treat only an explicit `false` as failure, like Fabrication does.
- [ ] **Step 5: Update `docs/02_modules/deals/CLAUDE.md` and `CHANGELOG.md`; commit.**

### MON-2: Stamp `leadId` and `dealId` on every invoice
- **Why:** a Deal is the same lead continuing (`originalLeadId` links back). The Advance invoice is keyed by the lead id (created before conversion) and the Final by the Deal id. Lookups work through `getLineageIds` / `invoicesForLineage` (`src/features/leads/leadLineage.js`), but the stored data is uneven.
- **Files:** `src/features/leads/Leads.jsx` (`handleConvertConfirm`), `src/features/quotations/QuotationBuilder.jsx` (invoice creation), `src/features/deals/Deals.jsx`, `src/features/fabrication/FabricationWorks.jsx` (QA-pass invoice).
- [ ] Test first (unit or component): after converting a lead, its existing invoices gain `dealId`; a new Final invoice carries both `leadId` (original) and `dealId`.
- [ ] Implement: on conversion, `updateDocument` the lead's invoices with `dealId`; new invoices set both fields from the lineage. Keep reads on `invoicesForLineage`.
- [ ] Decide with the owner whether to backfill old invoices (a one-off script or an Admin action); do not write live data without the owner's go.

### MON-3: Two remaining single-id lookups
- `src/features/leads/Leads.jsx` finds a logistics job with `j.leadId === lead.id`; `src/features/invoicing/Invoices.jsx` prints `Lead: <leadId>`. Change both to use `getLineageIds`. Add a unit or component test where the id is the Deal id or the original lead id.

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
- [ ] Tests first in `tests/component/FabricationWorks.test.jsx`: a job with status `Weird` still renders (in "Other"); Hold stores `holdFromStatus`; Resume restores it; Archive is refused for an Ongoing job.

### FEA-4: Fleet and driver directory in Firestore (logistics D-7, employees D2)
- **Why:** `FLEET_VEHICLES` and `DRIVER_DIRECTORY` are hardcoded in `src/features/logistics/logisticsEngine.js` and used by `LogisticsCardDetails.jsx`.
- **Build:** store them in `settings/fleet` (or a collection) editable by Admin in Settings; keep the constants as a fallback when the document is missing. Needs a rules block and tests. **Live:** rules deploy.

### FEA-5: Inspection follow-ups
- **Revision alert (inspection #5):** notify the deal's sales owner when a linked job goes to Revision (defect category and notes). Needs FEA-2's stored notifications.
- **"Email client: QA passed" (inspection #8):** a button that previews and sends the `fabrication_ready_inspection` template (exists in `src/constants/emailTemplates.js`, never used) through `/api/send-email`. **`api/send-email.js` only allows seven templates** (`SENDABLE_TEMPLATES`); add this one there deliberately and add an API test. Staff roles only.

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

### FEA-9: Employees HR model (employees D1)
- **Accepted design:** extend internal staff documents in `users` with an embedded `hrProfile` (official `employeeId`, department, NIC, join date, emergency contact, compensation). Read `docs/02_modules/employees/FINDINGS.md` section 6 first.
- **Care:** compensation data is sensitive; the `users` rules currently let Admin, self, or roles with `agents` or `messages` view read profiles, so a separate document or a stricter rule is needed before storing pay. Own plan, own PR series; not a small change.

### FEA-10: Task-assignment fields (employees D3)
- **Accepted design:** real user references: `assignedSalesId` on leads and deals, `assignedFabricatorId` on projects, `inspectorId` on QA, `assignedDriverId` on logistics, each pointing at an active `users` record.
- **Build order:** shared helper and picker, then one module per pull request (leads, fabrication, inspection, logistics), each with tests. The QA inspector is already the signed-in user (step 6.4c); reconcile. Depends on FEA-9 only if HR data feeds the picker.

---

## Security

Read [AUTHORIZATION_MAP.md](../03_security/AUTHORIZATION_MAP.md) first: no file overrides another; Firestore rules combine with OR, so only a broad `allow` widens access.

### SEC-1: Check the recipient in `api/send-email.js`
- Staff-only and seven-template-only were done on 2026-09-21. **Open:** a staff session can still send those templates to any address. Restrict the recipient to known records (`users`, `pendingUsers`, `customers`, `partners`, `partner_applications`). **Care:** some approval flows email an address before its record exists (`client_approval`, `partner_approval`, `registration_declined`), so test each caller in `Customers.jsx`, `Partners.jsx` and `AgentDatabase.jsx` before enforcing. Tests in `tests/api/sendEmail.test.js`.

### SEC-2: Restrict `api/generate.js`
- Any approved account, including Partner and Customer, can call the AI endpoint and spend the Gemini quota. Apply the same staff-role gate as `send-email` (`SYSTEM_ROLES` minus `ROLE_CATEGORIES.EXTERNAL`) and add API tests for each external role.

### SEC-3: Make the dev proxy safe
- `vite.config.js` re-implements `/api/admin-user` for `npm run dev` **without** token or role checks, and the dev server binds to `0.0.0.0` (`package.json` scripts pass `--host 0.0.0.0`). Bind to localhost by default and make the proxy call the real handler or apply the same checks.

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

---

## Tests

### TST-1: Component tests for the lead card
- `src/features/leads/LeadCardDetails.jsx` (about 1,776 lines) has none. Cover: the Convert button shows only at the `Received` stage; choosing an agent fills `partnerId`, names and the partner's rate and changes the quote's commission (`partnerFieldsFor`, `pricingLeadView`); invoice reprint uses the saved invoice as issued (`resolveInvoiceForPrint`); oversized audio is downsampled, not rejected. The lead card is heavy to render: mock `@/services/firestoreSync`, `@/services/gemini` and `@/shared/utils/toast`, as `tests/component/FabricationCardDetails.test.jsx` does.

### TST-2: End-to-end journeys (B6)
- **Money journey:** quotation to Advance invoice to Final invoice, exactly one `INV-FIN`. **RBAC journey:** Admin, Sales, Partner and Customer each see only their navigation; the seeded deactivated user cannot sign in. Needs `tests/fixtures/seed.mjs` extended with Sales, Customer and Manager users. Specs go in `tests/e2e/`, run with `npm run test:e2e` (Playwright against the emulators; see `tests/e2e/README.md`). Should exist before the restrictive rules are deployed.

### TST-3: More coverage
- No component tests yet for `Leads`, `QuotationBuilder`, `Customers`. Add wiring tests where money moves (quote to invoice). Then run `npm run coverage` and refresh the coverage map and register in `docs/04_workflows/TESTING.md`.

---

## Engineering health

### ENG-1: Split the very large files
- Over 800 lines: `src/features/partners/Partners.jsx` 1,809, `src/features/leads/LeadCardDetails.jsx` 1,776, `src/features/fabrication/FabricationWorks.jsx` 1,657, `src/App.jsx` 1,641 (state, listeners and handlers mixed), `src/features/admin/AgentDatabase.jsx` 1,358, `src/features/customers/Customers.jsx` 1,113, `src/features/logistics/Logistics.jsx` 1,051, and others. **Method:** tests first (TST-1, TST-3), then extract logic and sub-components into the feature's own folder one at a time, no behaviour change, full gate each step. Start with `App.jsx` (extract the Firestore listeners and the invoice and receipt handlers into hooks under `src/`).

### ENG-2: Add Prettier
- Its own pull request, done after ENG-1 so the formatting churn does not bury real changes. Add `prettier` and a `format` script; the repo already has `.editorconfig` (2 spaces, LF).

### ENG-3: Repository hygiene
- `public/portal-login-template.html` and `public/web and erp design theme.md` (unused? verify with a search first); the `@google/genai` dependency (the browser calls the AI through the server proxy, so it may be used only by `vite.config.js`; verify); about 90 stale `claude/*` branches on the remote (list with `git branch -r`, delete only merged ones with the owner's OK); a pull request template under `.github/`; `LICENSE` (DEC-9).

### ENG-4: Remove the two unused Firestore databases from `firebase.json`
- The owner confirmed (2026-09-21) that `ai-studio-printtoframeerp-...` and `ai-studio-printtoframe-...` are unused. Removing their entries makes a rules deploy touch `(default)` only. The databases themselves can be deleted later, separately, with the owner's go. Do this before the rules deploy in LIVE-1.

### ENG-5: Unsafe release scripts
- `package.json` has `push:staging` (`git add .` then commit and push) and `deploy:live` (merge and push `main`). They commit everything blindly and skip review. Replace them with the documented steps in `docs/04_workflows/DEPLOY_PROCESS.md`, or remove them, with the owner's OK.

### ENG-6: Documentation that no longer matches reality
- Root `CLAUDE.md`, "Branching & deployment workflow": it says `main` is production and mentions two skills under `.agents/skills/`. Today production deploys from the original repository, and `.agents/skills/` is not in this repository. Correct it (see LIVE-3). Also re-check `docs/04_workflows/DEPLOY_PROCESS.md` and `GIT_WORKFLOW.md` once the deploy path is settled.

---

## Live rollout and environments

These change the live project. Nothing here has been applied. Each step needs the owner's explicit go.

### LIVE-1: Live rollout (matrix, code, rules)
- Fully written in [LIVE_ROLLOUT.md](LIVE_ROLLOUT.md): pre-flight, verification and rollback for each step. Summary for a non-technical reader:
  1. **Permission matrix.** The table of which role can do what lives in one Firestore document. The live copy has no `quotations` or `receipts` rows, and the new code hides any screen whose row is missing. An Admin fixes this with one button (Permissions Manager, on the staging preview, which uses the live database) and Save. This is invisible to the old code, so it goes first, any time.
  2. **Code.** The live site runs the old code because it deploys from the original repository. Either reconnect the live Vercel project to this repository (LIVE-3, recommended) or copy the code into the original repository.
  3. **Rules.** Firestore security rules are deployed by hand, not by pushing. Deploy the additive set first (branch `claude/rules-3-4d-deploy`, commit `1776444`: the 3.4 rules plus the `L` and `D` counter prefixes; **not** the bare 3.4 commit, which would reject new lead and deal ids), check each role, and only later the stricter set from `staging`.
- **Owner actions:** a backup of the matrix, a smoke test on the preview, the go for each step, and the Vercel reconnect. Until this is done, the live site keeps working as it is, but the security fixes on `staging` (send-email hardening, stricter rules) do not take effect.

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
