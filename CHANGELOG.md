# Changelog

## Unreleased

- E2E runner (A6): `@playwright/test`, `playwright.config.js` (starts the emulators and `dev:emulated`), `tests/e2e/global-setup.js` (fails the run unless emulators are local and the project id starts with `demo-`, then seeds), `npm run test:e2e`, and a sign-in smoke journey.
- Emulator wiring (A5): guarded `connectFirestoreEmulator`/`connectAuthEmulator`/`connectStorageEmulator` block in `src/services/firebase.js` (flag plus dev server or `demo-` project), committed `.env.test`, `npm run dev:emulated`, idempotent `tests/fixtures/seed.mjs` with `npm run seed:emulator`.
- CI (A7): `.github/workflows/test.yml` with `lint-unit` and `rules` jobs for pull requests to `staging`/`main`; README "Running the tests" section.
- Rules test harness (A4): `tests/helpers/emulator.js` (`setupRulesEnv`, `seedPermissions`, `asRole`, `clearAll`); `firestoreRules` and `invoiceNumbering` integration tests now use it with unchanged assertions.
- Component test layer (A3): `vitest.component.config.js` (jsdom), `tests/helpers/setupComponent.js`, `renderWithProviders`, `npm run test:component`, RTL devDependencies, and a StatusBadge smoke test. Pinned `jsdom` to `^26`: v29 needs Node >= 20.19 and crashed under the local Node 20.18.
- API test layer (A2): `tests/helpers/mockHttp.js`, `npm run test:api`, `tests/api/README.md`, and a gate smoke test for `api/admin-user.js`; `test:all` and `coverage` now include the API tests.
- Testing foundations (A1): `docs/04_workflows/TESTING.md`, ESLint now lints `tests/`, `coverage` script with v8 reporters (no thresholds), `tests/helpers/factories.js` and a factories smoke test, removed the dead `src/utils/e2eTestSuite.js`, added the testing/remediation tracks to `PLAN.md`.
- Adopted the erp-system folder structure: `docs/` (architecture, modules, security, workflows, decisions), `functions/`, `.claude/`, `PROJECT_INDEX.md`.
- Added `.gitignore`.
- Recovered files missing from the org repo (`src/App.jsx`, `src/index.css`, `src/services/`, `src/utils/`, `crm/{Invoices,Partners,Receipts}.jsx`, `README.md`) from the original project folder.
- Investigation Phases 1-5: filled `GCP_INVENTORY`, `SYSTEM_OVERVIEW`, 16 module maps, `CROSS_MODULE_TRIGGERS`, `RBAC_MODEL`, `FIRESTORE_RULES_NOTES`, `GIT_WORKFLOW`, `DEPLOY_PROCESS`, and per-module `CLAUDE.md` files. Root `CLAUDE.md` gained a layout / module-index section.
