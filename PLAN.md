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
- [ ] Phase 7: Priority bug fixes, idempotency guards, and security rules remediation -> [docs/HANDOFF_REPORT.md](docs/HANDOFF_REPORT.md)

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
