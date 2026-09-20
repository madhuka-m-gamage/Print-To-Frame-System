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
Snapshot from `npm run coverage` (unit and API tests only, so the component and rules layers are not counted; overall about 9% of `src` and `api` statements, almost all in `utils`; refreshed after Phase 7 step 2). "Real" means the tests assert intended behaviour; "characterisation" means they record current behaviour, defects included. Refresh this table when tests land.

| Code | Covered by | Kind | Gaps |
|---|---|---|---|
| `src/utils/entityUtils.js` | `tests/unit/entityUtils.test.js`, `factories.test.js` | real, including `getExistingFinalInvoice` | alias cases beyond the nine recognised fields; the guard is client-state based, so two sessions acting at once can still both miss an invoice |
| `src/utils/cutListEngine.js` | `tests/unit/cutListEngine.test.js` | real (about 97%) | waste estimate is linear, not bin-packed |
| `src/utils/dateUtils.js` | `tests/unit/dateUtils.test.js` | real (about 87%) | a few branches |
| `src/utils/logisticsEngine.js` | `tests/unit/logisticsEngine.test.js` | real, including duplicate Finals and advance-only COD | UI labels (Logistics, LogisticsCardDetails, waybill) not covered by a test |
| `src/constants/emailTemplates.js` | `tests/unit/emailTemplates.test.js` | real | |
| `src/context/PermissionsContext.jsx` | `tests/unit/permissions.test.js`, `tests/component/StatusBadge.test.jsx` | real | receipts and quotations rows |
| `api/_lib/firebaseAdmin.js` | `tests/unit/firebaseAdmin.test.js` | real | initialisation paths |
| `api/admin-user.js` | `tests/api/adminUser.test.js` (405, missing token, CORS), `adminUserAuth.test.js` (invalid token, pending, non-Admin, payload checks), `tests/integration/adminUser.test.js` (Admin SDK calls) | real, plus characterisation of the deactivated caller and Manager rejection | flips with Phase 7 3.6; create, reset and delete are covered only by the emulator file |
| `api/generate.js`, `api/send-email.js` | `tests/api/generate.test.js`, `sendEmail.test.js` | real | generate: auth gate, origin echo, oversize audio, model fallback (400 stops; 404, 503, 429 fall through); send-email: auth gate, payload checks, template render, missing SMTP env. The hardcoded origin list is asserted only through generate |
| `firestore.rules` | `tests/integration/firestoreRules.test.js` (`users`, catch-all), `invoiceNumbering.test.js` (`counters`), `rulesAccess.test.js` (leads, invoices, partners, settings, audit log, public forms) | real, plus characterisation of 13 known gaps; 12 `it.todo` entries name the Phase 7 target | `deals`, `customers`, `receipts`, `projects`, `logistics`, `pricing`, `typing_indicators` blocks not exercised directly |
| `src/services/pricingEngine.js` | `tests/unit/pricingEngine.test.js` | real (tiers, cost stack) plus characterisation (discount, commission, Profit/SQ) | rows above |
| `src/utils/invoiceTemplate.js`, `receiptTemplate.js`, `dealSettlement.js`, `invoiceSettlement.js` | `tests/unit/invoiceTemplate.test.js`, `receiptTemplate.test.js`, `dealSettlement.test.js`, `invoiceSettlement.test.js` | real (milestone maths incl. discount and tax, words, labels, deal final amounts and commission) | print output only asserted by substring |
| `src/utils/validation.js`, `stringMatch.js`, `csvExport.js` | none | | (B2) |
| `src/services/firestoreSync.js` | `tests/unit/firestoreSync.test.js` | real | pure exports only (`deriveReceiptId`, `generateSequentialId`); firebase mocked; the Firestore calls and `generateAtomicId` are untested here |
| `src/components/**`, `App.jsx` | `StatusBadge` smoke test; `Receipts.test.jsx` (CSV export), `Invoices.receipt.test.jsx` (read-only amount, notes), `Invoices.policy.test.jsx` (edit policy, delete guard, cancel); `Deals.test.jsx`, `FabricationWorks.test.jsx`, `Partners.test.jsx`, `App.signOut.test.jsx` (B5 wiring) | real (Final invoice creation on completion and QA pass) plus characterisation (duplicate Final, phantom payout, sign-out leak) | wiring of four flows only; the large components are otherwise untested and logic inside them is not extracted |
| Browser journeys | `tests/e2e/smoke.spec.js` (sign-in) | real | quotation to invoice, deal completion, RBAC (B6) |

## Characterisation register
Tests that deliberately lock in a known defect, with the finding that will change them. Add a row whenever you write one.

| Test | Records this behaviour | Changes with |
|---|---|---|
| `pricingEngine.test.js` "always takes a hidden 15% discount" | `calculateCost` deducts 15% of total cost with no way to turn it off | cost-calculator-quotation finding 2 (Phase 7 6.6) |
| `pricingEngine.test.js` "charges a fixed 53.5 per sq ft sales cost" | every tier charges 53.5 per sq ft whatever the partner rate | cost-calculator-quotation finding 3 (Phase 7 6.6) |
| `pricingEngine.test.js` "computes Profit / SQ as (grossProfit + logistics + qa + salesCost) / sqFt" | `internalCostPerSq` includes costs the audit says it should not | cost-calculator-quotation finding 1 (Phase 7 6.6) |
| ~~`invoiceTemplate.test.js` scales each line item and ignores discountPct and taxPct~~ | flipped in Phase 7 2.4: line totals apply discount and tax before the milestone scaling | invoicing Phase 2 item 5 |
| ~~`logisticsEngine.test.js` doubles the COD balance for two unpaid Finals~~ | flipped in Phase 7 2.3: only the latest unpaid Final counts | invoicing D-2, logistics D-4 |
| `rulesAccess.test.js` "lets a Customer read and write quotations" | `/quotations` open to any signed-in user | rbac finding 5 (Phase 7 3.5) |
| `rulesAccess.test.js` "lets any signed-in user read a conversation they are not in and forge a sender" | `/messages` read and create open | messaging D-MSG-01, D-MSG-02 (3.5) |
| `rulesAccess.test.js` "lets a Customer read another user's profile" | `/users` read open | rbac finding 12 (3.5) |
| `rulesAccess.test.js` "lets a Customer write any counter to any value" | `/counters` open | rules audit (3.4) |
| `rulesAccess.test.js` "denies partner_payouts and referral_claims to everyone, Admin included" | no rules, catch-all denies | partners D-6 (3.4) |
| `rulesAccess.test.js` "lets a Deactivated user with a permitted role still create a lead" | rules ignore `status` | rbac finding 1 (3.5) |
| `rulesAccess.test.js` "does not treat the bootstrap email as Admin when it has no users document" | `isAdmin()` ignores the bootstrap email | auth DP-06 (3.4) |
| `rulesAccess.test.js` "rejects a pending applicant updating their own pendingUsers document" | only an Admin may update it | auth DP-02 (3.4) |
| `rulesAccess.test.js` "rejects a Manager changing or deleting another user" | user administration is Admin-only | employees D4 (3.5) |
| `rulesAccess.test.js` "blocks a Manager with invoices:delete ... from deleting an invoice" | delete is Admin-only on invoices | rbac finding 6 (3.5) |
| `rulesAccess.test.js` "denies a lead read to a role that has pipeline view but not leads view" | leads read needs the leads permission | deals D-8 (3.5) |
| `rulesAccess.test.js` "denies an anonymous read of an Active partner" | partners are never public | partners D-5 (3.4) |
| `rulesAccess.test.js` "lets a Partner read another partner's document ..." | the rule checks the partners permission, not record ownership (the matrix now grants Partner view and edit only) | Phase 7 3.5 |
| ~~`Deals.test.jsx` creates another Final invoice when the deal already has one~~ | flipped in Phase 7 2.1: completion skips the create when `getExistingFinalInvoice` finds one | invoicing D-1, deals D-1 |
| ~~`FabricationWorks.test.jsx` creates a Final invoice when one already exists~~ | flipped in Phase 7 2.1: App passes invoices and QA pass skips the create | invoicing D-1, fabrication F-1 |
| `Partners.test.jsx` "shows a success toast on Disburse Payout but writes nothing" | Disburse Payout is a toast only | partners D-1 (Phase 7 4.1) |
| ~~`App.signOut.test.jsx` keeps the previous user's unread count~~ | flipped in Phase 7 1: `handleSignOut` now clears notifications, and the test asserts the count is gone | notifications NOTIF-01 |
| `adminUserAuth.test.js` "lets a Deactivated caller with isApproved true through the approval gate" | `admin-user.js` trusts `isApproved` and ignores `status: 'Deactivated'` | user-management-rbac finding 1 (Phase 7 3.6) |
| `adminUserAuth.test.js` "rejects a Manager caller today because only Admin is allowed" | only Admin may call the endpoint | employees D4 (Phase 7 3.6) |
| ~~`logisticsEngine.test.js` reports nothing to collect for an advance-only job~~ | flipped in Phase 7 2.3: the 25% balance is reported as pending Final invoice creation | logistics D-4 |

Planned entries (later Part B): open `quotations`, `messages`, `users` and `counters` rules (B4).

## Roadmap
Part A (setup) is done: all five layers and CI exist. Part B status:
- **Done:** B1 money-path unit tests, B3 API handler cases, B4 rules cases, B5 component wiring cases.
- **Open:** B2 supporting unit tests (before Phase 7 6.3 and 6.6) and B6 E2E journeys (money journey after Phase 7 step 2, RBAC journey after 3.5d).
Progress is tracked in `PLAN.md`.

## Gotchas
- **Node:** `.nvmrc` pins 22. jsdom 29 crashes on Node older than 20.19.
- **`firebase emulators:start` ignores `firestore.rules`:** `firebase.json` declares firestore as an array, so the emulator runs allow-all. `tests/fixtures/seed.mjs` uploads the rules; `firebase emulators:exec` (used by `test:rules`) gets them from `setupRulesEnv`.
- **Orphaned emulator:** if a run is killed, a Java emulator can keep port 8080 and the next run hangs waiting for Auth on 9099. Kill the `cloud-firestore-emulator` process. Playwright's `gracefulShutdown` normally prevents this.
- **`matchesEntity` ignores `jobNo` and `linkedJobNo`:** projects and logistics jobs linked only by job number do not match a deal through it. The COD engine compares job numbers separately.
- **`DEFAULT_PERMISSIONS` is not the live matrix:** rules and the app read the `settings/permissions` document. `PERMISSIONS_FIXTURE` in `tests/helpers/emulator.js` is an independent copy for rules tests; keep it in sync by hand.
- **Seeded logins** (password `Passw0rd!test`): `admin@example.com`, `partner@example.com`, `deactivated@example.com`. Emulator only; never reuse these anywhere real.
- **Parallel files:** integration files share one stateful emulator, so files run sequentially.
