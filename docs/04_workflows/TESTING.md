# Testing

Five layers, each with one job. Pick the cheapest layer that can prove the behaviour.

| Layer | Directory | Environment | Command | Status |
|---|---|---|---|---|
| Unit | `tests/unit/` | node | `npm test` | live |
| API handlers | `tests/api/` | node, mock req/res | `npm run test:api` | live |
| Component | `tests/component/` | jsdom + React Testing Library | `npm run test:component` | live |
| Integration / rules | `tests/integration/` | Firebase emulator | `npm run test:rules` | live |
| End to end | `tests/e2e/` | Playwright + emulator | `npm run test:e2e` | live |

Coverage: `npm run coverage` (text, html, lcov in `coverage/`). There is no threshold; it is a report, not a gate.

## Planning a change (read this before writing an implementation plan)
Every plan should answer these, and name the tests it will add or change:
1. **Which layer proves it?** Use the cheapest layer that can (see "What belongs where"). Logic buried in a large component gets extracted to a pure helper and unit-tested; the component test only covers the wiring.
2. **Does it change behaviour a characterisation test locks in?** Check the register below. If so, the plan names that test and the finding, and updates the test in the same change so the flip is deliberate.
3. **Does it touch `firestore.rules` or the permissions matrix?** Then it needs a rules test (`tests/integration/`), and a matrix change also needs the live `settings/permissions` document updated, because editing `DEFAULT_PERMISSIONS` changes nothing live. Rules are deployed by hand with `firebase deploy --only firestore:rules`, never by pushing.
4. **Does it need new seed data?** Extend `tests/fixtures/seed.mjs`; do not create records inline in a test.
5. **Does it touch a money path** (invoices, COD, commission, pricing) **or access control?** Write or update the characterisation test first, then change the code.
6. **Which commands must pass before commit?** `npm run lint`, `npm run test:all` and `npm run build`; plus `npm run test:e2e` when the change is visible in the browser.
7. **Docs:** update the coverage map and register below, the module's `docs/02_modules/<module>/CLAUDE.md`, and `CHANGELOG.md`.

## What belongs where
- **Unit**: pure functions in `src/utils`, `src/services` (pricing, templates, matching, validation). If a decision is buried in a component handler, extract it to a pure helper and test that.
- **API**: `api/*.js` handlers with mocked Firebase Admin, Gemini and SMTP. Never touch real services.
- **Component**: wiring and rendering of a React component with `firestoreSync` mocked.
- **Integration / rules**: `firestore.rules` behaviour against the local emulator (Java required). Proves a rule denies, not that the UI hides a button.
- **E2E**: a few full journeys against the emulator-backed dev server. Most expensive layer; keep it small.

## Adding a test
- Unit: add `tests/unit/<module>.test.js`. Import `describe`, `it`, `expect` from `vitest` explicitly (`globals: false`). Build fixtures with `tests/helpers/factories.js` (`makeLead`, `makeDeal`, `makeInvoice`, `makeReceipt`, `makePartner`, `makeProject`, `makeLogisticsJob`, `makeUser`).
- API: add `tests/api/<handler>.test.js`, build the request with `createMockReqRes` from `tests/helpers/mockHttp.js`, and mock `api/_lib/firebaseAdmin.js` (recipe in `tests/api/README.md`).
- Component: add `tests/component/<Name>.test.jsx` and render with `renderWithProviders(ui, { role, permissions, wrappers })` from `tests/helpers/renderWithProviders.jsx`. Runs under `vitest.component.config.js` (jsdom, separate from `vitest.config.js`).
- E2E: add `tests/e2e/<journey>.spec.js` (Playwright, role/label selectors). Data comes from `tests/fixtures/seed.mjs`; extend the seed rather than creating records inline. See `tests/e2e/README.md`.

## Rules
- Test files run sequentially (`fileParallelism: false`): integration files share one stateful emulator and parallel files clobbered each other's data.
- Modules that import `src/services/firebase.js` call `initializeApp` at load; `vi.mock` it (and `firestoreSync`) in any test that reaches them.
- **Characterisation tests** lock in today's behaviour, including known defects. Each must carry a comment naming the finding (`docs/02_modules/*/FINDINGS.md`) that will change it, so the later flip is a deliberate edit and not a mystery failure.
- Factory lineage: `matchesEntity` (`src/utils/entityUtils.js`) only recognises `id`, `_firestoreId`, `firestoreId`, `leadId`, `dealId`, `originalLeadId`, `convertedDealId`, `rootLeadId`, `businessEntityId`. `jobNo`, `linkedJobNo`, `clientNIC` and `customerId` are not matched by it; the COD engine compares job numbers separately.

## Component test mocks
`src/services/firebase.js` calls `initializeApp` at module load. `tests/helpers/setupComponent.js` already stubs `src/services/firebase` and the `firebase/firestore` calls `PermissionsProvider` makes, for every component test. A test that renders a feature component must also mock the data and side-effect modules it reaches. Copy this block to the top of the test file:

```js
import { vi } from 'vitest';

vi.mock('../../src/services/firestoreSync', () => ({
  COLLECTIONS: { LEADS: 'leads', INVOICES: 'invoices', RECEIPTS: 'receipts', PARTNERS: 'partners', PROJECTS: 'projects', LOGISTICS: 'logistics' },
  addDocument: vi.fn(async () => {}),
  updateDocument: vi.fn(async () => {}),
  setDocument: vi.fn(async () => {}),
  deleteDocument: vi.fn(async () => {}),
  batchWrite: vi.fn(async () => {}),
  subscribeToCollection: vi.fn(() => () => {}),
  generateInvoiceId: vi.fn(async (type) => `INV-${type === 'Final' ? 'FIN' : 'ADV'}-0001`),
  generateAtomicId: vi.fn(async (prefix) => `${prefix}-0001`),
}));
vi.mock('../../src/utils/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
  showToast: vi.fn(),
}));
vi.mock('../../src/services/auditLog', () => ({ logActivity: vi.fn(async () => {}) }));
```

Assert on these mocks (for example `expect(addDocument).toHaveBeenCalledWith(...)`) rather than on Firestore state. Adjust the export list to what the component under test actually imports.

## Adding a rules test
`tests/helpers/emulator.js` holds the shared emulator setup. `checkPermission()` in `firestore.rules` reads `settings/permissions` and the caller's `users/{email}` document with `get()`, so a role-based rule denies everything until both exist. Seed them with `seedPermissions` and `asRole`:

```js
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';
import { setupRulesEnv, clearAll, seedPermissions, asRole } from '../helpers/emulator';

let testEnv;
beforeAll(async () => { testEnv = await setupRulesEnv(); });
afterAll(() => testEnv.cleanup());
beforeEach(() => clearAll(testEnv));

it('lets Sales create an invoice but not delete one', async () => {
  await seedPermissions(testEnv);                       // add overrides: { Sales: { invoices: { delete: true } } }
  const db = (await asRole(testEnv, 'Sales', 'sales@example.com')).firestore();
  await assertSucceeds(setDoc(doc(db, 'invoices', 'INV-ADV-0001'), { id: 'INV-ADV-0001' }));
});
```

`PERMISSIONS_FIXTURE` is an independent copy of the matrix for the modules the rules check; it does not import `DEFAULT_PERMISSIONS` because that module initialises real Firebase. Update it when the matrix changes. Run with `npm run test:rules` (needs Java).

## CI
`.github/workflows/test.yml` runs on pull requests to `staging` and `main`, and on pushes to `staging`.
- `lint-unit`: `npm run lint`, `npm run coverage` (unit and API, coverage uploaded as an artifact), `npm run test:api`, `npm run test:component`, `npm run build`.
- `rules`: Java 21 and `firebase-tools`, then `npm run test:rules` against the emulator with the fake `demo-print2frame-test` project.
- `e2e`: Playwright against the emulators, for pull requests to `main` and manual dispatch only, so a flaky browser run never blocks staging work.

No job uses secrets. Do not add `FIREBASE_SERVICE_ACCOUNT_JSON` or `GEMINI_API_KEY` to the workflow: tests must never reach real Firebase, Gemini or SMTP.

## Running the app against the emulators
`src/services/firebase.js` connects to the local emulators only when `VITE_USE_FIREBASE_EMULATOR=true` **and** (the Vite dev server is running or the project id starts with `demo-`). A missing or false variable leaves the app on real Firebase, unchanged. When active it logs a `[firebase] USING EMULATORS` warning to the console.

```bash
firebase emulators:start --project demo-print2frame-test --only firestore,auth   # terminal 1
npm run seed:emulator                                                            # terminal 2, once the emulators are up
npm run dev:emulated                                                             # terminal 2: vite --mode test, loads .env.test
```

- `.env.test` is committed and holds only the fake `demo-print2frame-test` project id and placeholders. Never put a real key in it.
- Seeded accounts (password `Passw0rd!test`): `admin@example.com` (Admin), `partner@example.com` (Partner), `deactivated@example.com` (Sales, status Deactivated). Also seeded: `settings/permissions`, one partner, one customer, a converted lead `L-100001` with an Accepted quotation `QT-100001`, deal `D-100001` and project `PTF-1001`.
- `seed:emulator` refuses to run unless `FIRESTORE_EMULATOR_HOST` is a local host and `GCLOUD_PROJECT` starts with `demo-`. It is idempotent.
- `firebase emulators:start` does not load `firestore.rules` from `firebase.json` (firestore is declared as an array of databases), so it would run allow-all. The seed script therefore uploads `firestore.rules` to the running emulator.
- The Storage client is pointed at `127.0.0.1:9199` (Firebase's default Storage emulator port; it is not configured in `firebase.json`). No Storage emulator is started, so uploads fail in emulated runs instead of reaching production.

## Node version
`.nvmrc` pins Node 22 and CI reads it (`node-version-file`). Some test dependencies need a recent Node: `jsdom` 29 needs 20.19 or later, and crashes on older 20.x. `package.json` deliberately has no `engines` field, because Vercel picks its build runtime from it and this change is about tests only.

## Coverage map
Snapshot from `npm run coverage` (unit and API tests only; overall about 4% of `src` and `api`, almost all in `utils`). "Real" means the tests assert intended behaviour; "characterisation" means they record current behaviour, defects included. Refresh this table when tests land.

| Code | Covered by | Kind | Gaps |
|---|---|---|---|
| `src/utils/entityUtils.js` | `tests/unit/entityUtils.test.js`, `factories.test.js` | real | alias cases beyond the nine recognised fields |
| `src/utils/cutListEngine.js` | `tests/unit/cutListEngine.test.js` | real (about 97%) | waste estimate is linear, not bin-packed |
| `src/utils/dateUtils.js` | `tests/unit/dateUtils.test.js` | real (about 87%) | a few branches |
| `src/utils/logisticsEngine.js` | `tests/unit/logisticsEngine.test.js` | real | duplicate Final invoices and advance-only COD not characterised |
| `src/constants/emailTemplates.js` | `tests/unit/emailTemplates.test.js` | real | |
| `src/context/PermissionsContext.jsx` | `tests/unit/permissions.test.js`, `tests/component/StatusBadge.test.jsx` | real | receipts and quotations rows |
| `api/_lib/firebaseAdmin.js` | `tests/unit/firebaseAdmin.test.js` | real | initialisation paths |
| `api/admin-user.js` | `tests/api/adminUser.test.js` (405, missing token, CORS), `tests/integration/adminUser.test.js` (Admin SDK calls) | real | invalid token, non-admin, deactivated caller |
| `api/generate.js`, `api/send-email.js` | none | | auth gate, origin check, model fallback (B3) |
| `firestore.rules` | `tests/integration/firestoreRules.test.js` (`users`, catch-all), `invoiceNumbering.test.js` (`counters`) | real | most of the 20 match blocks (B4) |
| `src/services/pricingEngine.js` | none | | tiers, discount, commission (B1) |
| `src/utils/invoiceTemplate.js`, `receiptTemplate.js` | none | | totals, milestone scaling (B1) |
| `src/utils/validation.js`, `stringMatch.js`, `csvExport.js` | none | | (B2) |
| `src/services/firestoreSync.js` | none | | pure exports only, needs `firebase` mocked (B1) |
| `src/components/**`, `App.jsx` | `StatusBadge` smoke test only | | large components; extract logic first (B5) |
| Browser journeys | `tests/e2e/smoke.spec.js` (sign-in) | real | quotation to invoice, deal completion, RBAC (B6) |

## Characterisation register
Tests that deliberately lock in a known defect, with the finding that will change them. **Empty for now**; it fills in as Part B lands. Add a row whenever you write one.

| Test | Records this behaviour | Changes with |
|---|---|---|
| _none yet_ | | |

Planned entries (Part B): hidden 15% discount and fixed commission in `pricingEngine` (cost-calculator-quotation findings 2 and 3); `Profit / SQ` formula (finding 1); duplicate `INV-FIN` invoices (invoicing D-1); COD totals for duplicate Finals and advance-only jobs (invoicing D-2, logistics D-4); "Disburse Payout" writing nothing (partners D-1); deactivated caller passing `api/admin-user.js` (user-management-rbac finding 1).

## Roadmap
Part A (setup) is done: all five layers and CI exist. Part B fills them in; each item is independent. B1 and B4 have deadlines because Phase 7 changes the behaviour they record.
- **B1** money-path unit tests (before Phase 7 items 2.1 to 2.4) and **B4** rules cases (before 3.4 and 3.5)
- **B3** API handler cases (before 3.6), **B5** component cases (before 4.1), **B2** supporting unit tests (before 6.3 and 6.6), **B6** E2E journeys
Progress is tracked in `PLAN.md`.

## Gotchas
- **Node:** `.nvmrc` pins 22. jsdom 29 crashes on Node older than 20.19.
- **`firebase emulators:start` ignores `firestore.rules`:** `firebase.json` declares firestore as an array, so the emulator runs allow-all. `tests/fixtures/seed.mjs` uploads the rules; `firebase emulators:exec` (used by `test:rules`) gets them from `setupRulesEnv`.
- **Orphaned emulator:** if a run is killed, a Java emulator can keep port 8080 and the next run hangs waiting for Auth on 9099. Kill the `cloud-firestore-emulator` process. Playwright's `gracefulShutdown` normally prevents this.
- **`matchesEntity` ignores `jobNo` and `linkedJobNo`:** projects and logistics jobs linked only by job number do not match a deal through it. The COD engine compares job numbers separately.
- **`DEFAULT_PERMISSIONS` is not the live matrix:** rules and the app read the `settings/permissions` document. `PERMISSIONS_FIXTURE` in `tests/helpers/emulator.js` is an independent copy for rules tests; keep it in sync by hand.
- **Seeded logins** (password `Passw0rd!test`): `admin@example.com`, `partner@example.com`, `deactivated@example.com`. Emulator only; never reuse these anywhere real.
- **Parallel files:** integration files share one stateful emulator, so files run sequentially.
