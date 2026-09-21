# Plan: ERP investigation

Progress tracker, overwritten in place. Outputs go into the structure listed in [PROJECT_INDEX.md](PROJECT_INDEX.md).

- [x] Scaffold folder structure, `.gitignore`
- [x] Recover files missing from the org repo (from the original project folder)
- [x] Phase 1: automation inventory (repo + console) -> `docs/01_architecture/GCP_INVENTORY.md`
- [x] Phase 2: repo structure -> `docs/01_architecture/SYSTEM_OVERVIEW.md`
- [x] Phase 3: per-module mapping (16 modules) -> `docs/02_modules/`
- [x] Phase 4: cross-module triggers -> `docs/01_architecture/CROSS_MODULE_TRIGGERS.md`
- [x] Phase 5: per-module `CLAUDE.md` -> `docs/02_modules/<module>/CLAUDE.md`, module index in root `CLAUDE.md`
- [x] Security and workflow docs -> `docs/03_security/`, `docs/04_workflows/`
- [x] Phase 6: per-module / per-layer review sessions (16 modules reviewed via parallel worktrees, merged, and verified) -> `docs/02_modules/*/FINDINGS.md`, [docs/POST_MERGE_VERIFICATION_REPORT.md](docs/POST_MERGE_VERIFICATION_REPORT.md)
- [ ] Phase 7: Priority bug fixes, idempotency guards, and security rules remediation -> [docs/HANDOFF_REPORT.md](docs/HANDOFF_REPORT.md) (tracked below; testing suite is built first, see Part A/B)

## Progress snapshot (rough, for orientation only)

Updated 2026-09-21. These are honest estimates, not measurements: they show where the work stands at a glance. Update the bars and the date whenever a task finishes.

| Track | Progress | Notes |
|---|---|---|
| Test suite (Part A setup, Part B authoring) | `[##########]` ~95% | Five layers built and in CI; B6 browser journeys parked |
| Phase 7 fixes that do not touch the live site (steps 1 to 6, 8.1) | `[#########-]` ~90% | Done and merged into `staging`; step 7 (UX backlog) not started |
| 8.2 Standard project structure | `[##########]` ~100% | 12 of 12 tasks built (the last PR is open): README and env example, unused files removed, one docs folder per module, `@/` import alias, shared code, feature folders for auth, profile, dashboard, messaging, leads, customers, quotations, deals, invoicing, partners, fabrication, logistics and admin (all of `src/components` is gone). Clean-up, ADR `0003-source-layout.md` and removal of the temporary codemod are in the last PR |
| Live rollout chain (matrix 3.3, rules 3.4d and 3.5d, payouts 4.x, promote to `main`) | `[##--------]` ~20% | Preparation done 2026-09-21: read-only live check, deployable rules branch, and the runbook `docs/04_workflows/LIVE_ROLLOUT.md`. Nothing applied to the live project; every step needs the owner's go |
| Follow-up backlog | ~20 items listed | Tackled one by one after this workflow |

Merged into `staging` so far: PRs #6 to #51. Open: the final 8.2 PR (clean-up, ADR, removal of the codemod).

## Testing and remediation tracks

The suite is built first (Part A), then characterisation tests are written (Part B, deadlines noted), then Phase 7 fixes land against that safety net. Guide: [docs/04_workflows/TESTING.md](docs/04_workflows/TESTING.md). One branch per item from `claude/dev`, one PR each into `staging`; never push to `main`, never deploy rules without approval.

Workflow per item: build on its branch, test locally (`npm run lint`, `npm run test:all`, `npm run build`, `npm run test:e2e` when visible), merge to `staging` and verify there, then promote to `main`. Decisions: keep the x0.25 invoice print scaling; lead stage advance stays manual; Managers may administer users (not Admins, not their own role); `users` readable by Admin, self, or roles with `agents:view` / `messages:view`; final-invoice guard is client-side `getExistingFinalInvoice`. Separate staging/production environments (Firebase, Vercel, domain) are a later, independent track, so until then rules deploys and matrix writes hit the live project and are checked by hand.

### Part A: testing suite setup
Order: A1, then A2/A3/A4 (any order), then A7 (CI), then A5 -> A6 whenever browser tests are wanted.
- [x] A1: foundations (TESTING.md, lint covers `tests/`, coverage script, factories, dead `e2eTestSuite.js` removed)
- [x] A2: API test layer (`tests/helpers/mockHttp.js`, `test:api`)
- [x] A3: component test layer (`vitest.component.config.js`, RTL, `test:component`)
- [x] A4: rules test harness (`tests/helpers/emulator.js`, refactor the 3 integration files)
- [x] A7: GitHub Actions CI (`lint-unit`, `rules`, optional `e2e`)
- [x] A5: emulator wiring in `src/services/firebase.js` + seed data (only `src` change in Part A)
- [x] A6: Playwright runner and sign-in smoke journey (needs A5)

- [x] T0: suite on `main` (PRs #4, #5); verified on Node 22: lint clean, unit 57, api 3, component 3, rules 20, build OK

### Part B: test authoring
- [x] B1: money-path unit tests (before Phase 7 phases 2.1-2.4; characterisation first)
- [x] B2: supporting-module unit tests (before 6.3 / 6.6)
- [x] B3: API handler cases (before 3.6)
- [x] B4: Firestore rules cases (before 3.4 / 3.5; replaces Phase 7 prompt 3.1)
- [x] B5: component cases (before 4.1)
- [ ] B6: E2E journeys (needs A6)
- [x] Refresh the `TESTING.md` coverage map (done 2026-09-21, after Phase 7 step 5; refresh again after the next batch) and characterisation register (manual, run on request after Part B phases land). Prompt: "Refresh docs/04_workflows/TESTING.md: run npm run coverage and update the coverage map (files, tests, kind, gaps), update the characterisation register from the tests that carry a finding comment, and tick the roadmap. Docs only; state only what you read; commit."

### Phase 7: audit remediation
Sequencing: rules and the live `settings/permissions` matrix are coupled (3.3 before 3.5); listeners must be gated (3.2) before restrictive rules; new collections need rules deployed first (3.4d before 4.x).
- [x] 1: quick security and session wins (client only)
- [x] 2.1: duplicate Final-invoice guard
- [x] 2.2: Completed-stage reversal locks and commission idempotency
- [x] 2.3: COD engine
- [x] 2.4: Deals pricing and commission
- [x] 2.5: receipts
- [x] 2.6: invoice edit policy
- [x] 3.1: superseded by B4
- Dependencies: B1 before 2.1-2.4; B3 before 3.6; B4 before 3.4/3.5; B5 before 4.1; B2 before 6.3/6.6; 3.2 and 3.3 before 3.5; 3.4d before 4.x, 5.2, 6.2; 3.5d and 3.6 before 5.3
- [x] 3.2: client RBAC prerequisites and matrix defaults
- [ ] 3.3: live permissions migration (prepared: Permissions Manager has an "Add missing modules with defaults" button; the live write needs your approval and an Admin to click Save)
- [ ] 3.4 / 3.4d: additive rules written and tested (D-5 public partner read held, see notes); deploy needs approval. Deploy the version on branch `claude/rules-3-4d-deploy` (3.4 plus the `L` and `D` counter prefixes), not the bare 3.4 commit; steps in `docs/04_workflows/LIVE_ROLLOUT.md`
- [ ] 3.5 / 3.5d: restrictive rules written and tested (not deployed); needs 3.3 and 3.4d first, then the RBAC E2E, your approval to deploy, and a manual role check on the live site
- [x] 3.6: admin API
- [ ] 4.1-4.3: payouts, referral lineage, claims and notifications
- [x] 5.1-5.3: Google scopes, registration, user lifecycle
- [ ] 6.1-6.6: leads, atomic ids, customers, deals/fabrication/inspection, logistics (6.1, 6.2, 6.3, 6.4, 6.6 done in PRs; 6.5 logistics not started)
- [ ] 7: UX and feature backlog
- [x] 8.1: docs sync (TESTING.md coverage map and roadmap, root CLAUDE.md test layers and approval hand-off, stale module maps and instructions for pricing, duplicate Final guard, commission accrual)
- [x] 8.2: standard project structure, in 12 small tasks (done 2026-09-21; decision recorded in `docs/05_decisions/0003-source-layout.md`)
  - [x] 1: README, `.env.example`, `.editorconfig`, `CONTRIBUTING.md`, package metadata
  - [x] 2: remove confirmed-unused files and dependencies
  - [x] 3: one docs folder per module (`docs/02_modules/<m>/README.md`)
  - Progress: 10 of 12 tasks built (about 83%); tasks 1 to 5 are merged (#42 to #46), tasks 6 to 10 are open PRs
  - [x] 4: `@/` import alias, codemod, and normalise imports (no moves)
  - [x] 5: shared code into `src/shared` (ui, components, utils)
  - [x] 6: `src/features` auth, profile, dashboard, messaging
  - [x] 7: `src/features` leads, customers, quotations
  - [x] 8: `src/features` deals, invoicing, partners
  - [x] 9: `src/features` fabrication, logistics
  - [x] 10: `src/features/admin` (all feature moves done)
  - [ ] 11-12: clean-up, ADR `0003-source-layout.md`, remove the codemod

## Deferred until the live site is ready to change

Owner decision 2026-09-20 ([docs/05_decisions/0002-deferred-until-live-rollout.md](docs/05_decisions/0002-deferred-until-live-rollout.md)): only repo work that cannot affect the live site proceeds. Parked, with details in that note:
- [ ] Promote `staging` to `main` (PR #25)
- [ ] 3.3 live matrix migration (add `receipts` and `quotations`), 3.4d additive rules deploy, 3.5d restrictive rules deploy
- [ ] Partner limited to its own `partners` record
- [ ] B6 E2E journeys (money and RBAC)
- [ ] Partners D-5 public profile document, server-side counters
- [ ] Part 1 separate environments

## Follow-up backlog (tackle one by one after the Phase 7 workflow)

Owner decision 2026-09-21: side findings are parked here, not folded into the step in progress, and handed back as one list when the workflow finishes. Add a line for anything worth fixing that is outside the current step.

- [ ] Invoice model: stamp both `leadId` and `dealId` on every invoice (today the Advance is keyed by the lead id and the Final by the Deal id; lookups work through `invoicesForLineage`, but the data is uneven).
- [ ] Single-id lookups still left: `Leads.jsx` finds a logistics job with `j.leadId === lead.id`; `Invoices.jsx` prints `Lead: <leadId>`. Move both to `getLineageIds`.
- [ ] Duplicate-invoice guards (Advance, Final) run on client state, so two people acting at once can still create two. Needs a server-side or rules-level guard.
- [ ] Counters can still be lowered by any signed-in user (needs numbering moved server-side).
- [ ] Public forms still use clock ids: referral `LD-` (`ReferralForm.jsx`) and partner registration `APP-` (`PartnerRegistration.jsx`). Signed-out users cannot write counters, so this needs server-side numbering. `Customers.jsx` NIC ids for imported contacts are also clock-based.
- [ ] Partners commission fallback: `Partners.jsx` still falls back to LKR 53.50 per sq ft (default new-partner rate and the payout calculation), while the owner's rule for a referral lead with no rate is LKR 30.00. Decide one default and align both.
- [ ] Defaulted-commission edge-case list or automatic ticket (key: `pricingMetadata.commissionRateDefaulted`), and stored notifications so an Admin or Manager is told even when they are not the one applying the pricing.
- [ ] Google Drive uses the restricted `drive.readonly` scope. Consider Google Picker with `drive.file` (no verification needed) and decide on OAuth app verification for `contacts.readonly`; staff currently click through the "unverified app" warning.
- [ ] Component tests for `LeadCardDetails` (Convert button stage gate, invoice reprint, audio downsampling); none exist yet.
- [ ] Partners D-5 public profile document (bank details exposure), Partner own-record restriction, B6 E2E journeys: see the deferred list above.
- [ ] Fabrication board statuses: only Pending, Ongoing, Ready For Inspection, Revision and Completed have columns (`STAGES` in `FabricationWorks.jsx`), so a project with any other status vanishes from the board. Deleting a deal already sets `Cancelled` (6.4a). Build: a muted read-only Cancelled column showing `cancelledReason`; an On Hold status with a Hold button (asks for a reason, stores `holdFromStatus`) and a Resume button that returns the job to its previous stage; Archived as a "Show archived" filter, allowed only for Completed and Cancelled jobs; and an "Other" bucket so an unrecognised status never hides a job. Decision still open: block a Final invoice and a delivery job for a Cancelled project (recommended yes). The deal-to-project sync already ignores these statuses.
- [ ] **Storage is not set up in the live project** (read-only check 2026-09-21: no active Storage rules). Three upload paths exist and are expected to fail there: the public Partner registration documents (`PartnerRegistration.jsx`, which falls back to a local placeholder name), the Partners screen document upload (`Partners.jsx`), and fabrication blueprints (`FabricationCardDetails.jsx`, which keeps files under 500KB inline and rejects larger ones). Decide: enable Storage with narrow rules (signed-in write to `blueprints/` and `partners/`; the public registration form needs a separate design), or drop the upload features. Old jobs keep inline Base64 blueprints.
- [ ] Legacy manual fabrication jobs that already carry a `value` still get a 25% Final invoice at QA pass; new manual jobs carry no value and are billed through their deal (or are non-billable). Decide whether to clear or migrate the old ones.
- [ ] Frame size is set once on the lead (Length and Height in feet, locked after pricing is applied, Admin can still change it there) and read-only downstream. Leads created before this have no saved size, so their jobs stay editable in Fabrication until someone applies pricing on the lead.
- [ ] Inspection #5: tell the deal's sales owner when a linked job goes to Revision (defect category and notes). The app has only local toasts, no stored per-user notifications, so this needs that first (same gap as the defaulted-commission alert).
- [ ] Inspection #8: an explicit "Email client: QA passed" button that previews and sends the `fabrication_ready_inspection` template through `/api/send-email` (the template exists and is never used).
- [ ] `Deals.jsx` completion calls `onSaveInvoice` without waiting for it, unlike the Fabrication QA pass, so a failed Final invoice save still completes the deal. Make it await and abort like Fabrication.
- [ ] Logistics D-7: the fleet vehicles and driver directory are hardcoded in `logisticsEngine.js`. Move them to Firestore (`settings/fleet` or a collection) editable by Admins, keeping the constants as a fallback. Needs a rules change, so it is live-affecting and belongs with the parked rules deploys.
- [ ] Cash on delivery for drivers: the Logistics role has read-only invoices and no receipts in `DEFAULT_PERMISSIONS`, so a driver cannot record cash collection; only Admin and Manager can. Decide whether drivers may (widening the matrix and the live rules) or a dispatcher records it for them.
- [ ] Split the very large files (over 800 lines): `Partners.jsx` 1,800, `LeadCardDetails.jsx` 1,770, `FabricationWorks.jsx` 1,650, `App.jsx` 1,640 (state, listeners and handlers mixed), `AgentDatabase.jsx` 1,360, `Customers.jsx` 1,110, `Logistics.jsx` 1,050, and others. Extract logic into the feature's own files with tests first; the layout work (ADR 0003) deliberately left this alone.
- [ ] Add a code formatter (Prettier) as its own change, since it rewrites most files.
- [ ] Repository hygiene left over from the layout work: `public/portal-login-template.html` and `public/web and erp design theme.md` (not on the approved removal list), the `@google/genai` dependency (the browser calls the AI through the server proxy, so it may be unused apart from `vite.config.js`), about 90 stale `claude/*` branches on the remote, a PR template under `.github/`, and a decision on a `LICENSE`.
- [ ] `firebase.json` still lists two AI Studio Firestore databases besides `(default)`; every rules deploy targets all three. The owner confirmed on 2026-09-21 that they are unused, so removing those two entries would make a rules deploy touch `(default)` only (the databases themselves can be deleted later, separately). Do it before the rules deploy or with the environments plan (Part 1).
- [ ] Vercel `print-to-frame-system` (checked read-only 2026-09-21): `FIREBASE_SERVICE_ACCOUNT_JSON` is stored as a normal encrypted variable and is targeted at development, preview and production; Vercel flags it `readable-secret`. Recreate it as a **Sensitive** variable (owner action; Sensitive values cannot be read back). `GEMINI_API_KEY` is already Sensitive. Once Part 1 exists, give preview its own key.
- [ ] The tooling here sees only the `print-to-frame1` Vercel team, whose one ERP project has just a `vercel.app` address. The live project (`portal.print2frame.xyz`) is elsewhere, so its environment variables and deployments cannot be checked from here. Connect that account, or check by hand (first item: `VITE_FIREBASE_DATABASE_ID`, see `docs/04_workflows/LIVE_ROLLOUT.md`).
- [ ] After the matrix migration, review with the business whether any live role holds more than it needs (Support has edit on most modules including `agents`; Logistics has full `invoices`; Operations edits `leads`, `pipeline` and `agents`; Manager has `admin`). Not a rules change: Admin edits cells in Permissions Manager.
- [ ] Decide whether Operations and Logistics need `quotations` or `receipts` view (step 1 defaults give them none); adjust in Permissions Manager after the migration.
- [ ] Three GitHub locations exist for this project: the original personal repository `madhukagamage6/Print-To-Frame-ERP-System` (own history, last commit 2026-09-15), the former organisation repository that redirects to `madhuka-m-gamage/Print-To-Frame-System` (this one), and the local folder `Print-To-Frame-ERP-System` that mirrors the first. Decide which is canonical, point the live Vercel project at it, and archive the others. The live deployment source is now confirmed: Vercel project `print-to-frame-erp` deploys `main` of `madhukagamage6/Print-To-Frame-ERP-System` (see the runbook, step 2); the paths to move it here are in the runbook.
- [ ] Environment variables on the Vercel preview: it needs its own `FIREBASE_SERVICE_ACCOUNT_JSON` and `GEMINI_API_KEY` in Preview scope; replace live keys with a staging project's keys once Part 1 exists.

## Antigravity Work Summary & Handoff

The 16-module architectural, security, and correctness review phase was conducted in Google Antigravity and is complete.

- **Parallel Worktree Reviews:** All 16 ERP modules were analyzed in dedicated git worktrees (`review-*`) against architecture specs, trigger maps, and security rules.
- **Audit Deliverables:** 16 comprehensive findings documents were produced at `docs/02_modules/<module>/FINDINGS.md` (5,849 lines total), with code-level line references and accepted decisions.
- **Safe Integration:** All 16 review branches were merged into `antigravity/dev`.
- **Complete Verification:** 5-point verification check passed with zero conflict markers, zero broken links, zero changes/regressions to application source code (`src/` and `api/`), and complete cleanup of temporary worktrees.
- **Detailed Handoff Report:** For full findings breakdown, priority remediation tasks, and instructions for Claude Code, see **[docs/HANDOFF_REPORT.md](docs/HANDOFF_REPORT.md)** and **[docs/POST_MERGE_VERIFICATION_REPORT.md](docs/POST_MERGE_VERIFICATION_REPORT.md)**.

## Findings to act on (details in the linked docs)

- **Duplicate Final-invoice hazard:** `Deals.jsx` (completion), `FabricationWorks.jsx` (QA pass), and `QuotationBuilder.jsx` ("25% Final Settlement") can all create duplicate `INV-FIN` invoices with no guard, doubling COD balances: [docs/02_modules/invoicing/FINDINGS.md](docs/02_modules/invoicing/FINDINGS.md) & [CROSS_MODULE_TRIGGERS.md](docs/01_architecture/CROSS_MODULE_TRIGGERS.md)
- **Phantom Partner Payout Disbursement:** `Partners.jsx` triggers a success toast notification but performs no Firestore write to deduct balances or store payout records: [docs/02_modules/partners/FINDINGS.md](docs/02_modules/partners/FINDINGS.md)
- **`firestore.rules` gaps:** Missing rules for `referral_claims` and `partner_payouts`; unconstrained client writes on `quotations`; overly broad reads on `messages`: [FIRESTORE_RULES_NOTES.md](docs/03_security/FIRESTORE_RULES_NOTES.md) & [docs/02_modules/user-management-rbac/FINDINGS.md](docs/02_modules/user-management-rbac/FINDINGS.md)
- **Google OAuth scope mismatch:** Identity scopes only requested during login, but code calls Google Drive and Contacts APIs: [docs/02_modules/auth/FINDINGS.md](docs/02_modules/auth/FINDINGS.md)
- **Notification session leakage:** Sign-out does not reset in-memory notification state, exposing client/commission data across users: [docs/02_modules/notifications/FINDINGS.md](docs/02_modules/notifications/FINDINGS.md)
- **`CLAUDE.md` documentation drifts:** Synchronize statements regarding approval auto-provisioning, OAuth scopes, and active skill configurations: [docs/POST_MERGE_VERIFICATION_REPORT.md](docs/POST_MERGE_VERIFICATION_REPORT.md)
