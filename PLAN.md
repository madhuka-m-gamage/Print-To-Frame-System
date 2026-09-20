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
- [ ] B2: supporting-module unit tests (before 6.3 / 6.6)
- [x] B3: API handler cases (before 3.6)
- [x] B4: Firestore rules cases (before 3.4 / 3.5; replaces Phase 7 prompt 3.1)
- [x] B5: component cases (before 4.1)
- [ ] B6: E2E journeys (needs A6)
- [ ] Refresh the `TESTING.md` coverage map and characterisation register (manual, run on request after Part B phases land). Prompt: "Refresh docs/04_workflows/TESTING.md: run npm run coverage and update the coverage map (files, tests, kind, gaps), update the characterisation register from the tests that carry a finding comment, and tick the roadmap. Docs only; state only what you read; commit."

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
- [ ] 3.4 / 3.4d: additive rules, then deploy (needs approval)
- [ ] 3.5 / 3.5d: restrictive rules, RBAC E2E on the emulator, deploy (needs approval), then manual role check on the live site
- [x] 3.6: admin API
- [ ] 4.1-4.3: payouts, referral lineage, claims and notifications
- [ ] 5.1-5.3: Google scopes, registration, user lifecycle
- [ ] 6.1-6.6: leads, atomic ids, customers, deals/fabrication/inspection, logistics, pricing
- [ ] 7: UX and feature backlog
- [ ] 8.1 / 8.2: docs sync, folder move

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
