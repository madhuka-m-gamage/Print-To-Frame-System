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
- [ ] Phase 6: per-module / per-layer review sessions (worktrees), not started

## Findings to act on (details in the linked docs)

- Two automatic Final-invoice creators (deal Completed, fabrication QA pass) with no duplicate guard: [CROSS_MODULE_TRIGGERS.md](docs/01_architecture/CROSS_MODULE_TRIGGERS.md)
- `firestore.rules` gaps (no rule for `referral_claims` / `partner_payouts`, open `quotations`, open `messages` reads): [FIRESTORE_RULES_NOTES.md](docs/03_security/FIRESTORE_RULES_NOTES.md)
- Partner payout disbursement is a toast only: [partners.md](docs/02_modules/partners.md)
- Google OAuth requests no Drive / Contacts scopes although code uses them: [auth.md](docs/02_modules/auth.md)
- `CLAUDE.md` statements that do not match the code (approval auto-provisioning, OAuth scopes, `.agents/skills/`)
