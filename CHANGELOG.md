# Changelog

## Unreleased

- Testing foundations (A1): `docs/04_workflows/TESTING.md`, ESLint now lints `tests/`, `coverage` script with v8 reporters (no thresholds), `tests/helpers/factories.js` and a factories smoke test, removed the dead `src/utils/e2eTestSuite.js`, added the testing/remediation tracks to `PLAN.md`.
- Adopted the erp-system folder structure: `docs/` (architecture, modules, security, workflows, decisions), `functions/`, `.claude/`, `PROJECT_INDEX.md`.
- Added `.gitignore`.
- Recovered files missing from the org repo (`src/App.jsx`, `src/index.css`, `src/services/`, `src/utils/`, `crm/{Invoices,Partners,Receipts}.jsx`, `README.md`) from the original project folder.
- Investigation Phases 1-5: filled `GCP_INVENTORY`, `SYSTEM_OVERVIEW`, 16 module maps, `CROSS_MODULE_TRIGGERS`, `RBAC_MODEL`, `FIRESTORE_RULES_NOTES`, `GIT_WORKFLOW`, `DEPLOY_PROCESS`, and per-module `CLAUDE.md` files. Root `CLAUDE.md` gained a layout / module-index section.
