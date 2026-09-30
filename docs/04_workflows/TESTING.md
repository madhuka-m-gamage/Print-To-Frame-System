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
- Factory lineage: `matchesEntity` (`src/shared/utils/entityUtils.js`) only recognises `id`, `_firestoreId`, `firestoreId`, `leadId`, `dealId`, `originalLeadId`, `convertedDealId`, `rootLeadId`, `businessEntityId`. `jobNo`, `linkedJobNo`, `clientNIC` and `customerId` are not matched by it; the COD engine compares job numbers separately.

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
vi.mock('@/shared/utils/toast', () => ({
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

`tests/integration/effectiveAccess.test.js` (SEC-9) prints every role's access to each collection under the deployed (`origin/main`) and working-tree rules. A rules change that is meant to alter access must add the changed cells to its `EXPECTED_RULE_CHANGES` list. To check the live matrix, copy `settings/permissions` from the console into a JSON file outside the repository and run `LIVE_PERMISSIONS_JSON=/path/to/file.json npm run test:rules`. Vitest hides console output of passing tests in some environments; add `--reporter=default` to the vitest command to see the table.

## CI
`.github/workflows/test.yml` runs on pull requests to `staging` and `main` (not on pushes to `staging`, which the pull request already covered) and on manual dispatch. A `changes` job skips the three jobs below for a pull request that only touches `docs/` or `*.md` files; skipped jobs still report, so they can be required checks later.
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
- Seeded accounts (password `Passw0rd!test`): `admin@example.com` (Admin), `partner@example.com` (Partner), `deactivated@example.com` (Sales, status Deactivated), `sales@example.com`, `manager@example.com`, `customer@example.com`, `evicted@example.com` (Sales, Active on every seed; `rbac.spec.js` deactivates it mid-session). Also seeded: `settings/permissions`, one partner, one customer, a converted lead `L-100001` with an Accepted quotation `QT-100001`, deal `D-100001` and project `PTF-1001`.
- `seed:emulator` refuses to run unless `FIRESTORE_EMULATOR_HOST` is a local host and `GCLOUD_PROJECT` starts with `demo-`. It is idempotent.
- `firebase emulators:start` does not load `firestore.rules` from `firebase.json` (firestore is declared as an array of databases), so it would run allow-all. The seed script therefore uploads `firestore.rules` to the running emulator.
- The Storage emulator is configured in `firebase.json` (port 9199) and started by `npm run test:rules`; `dev:emulated` and Playwright start Firestore and Auth only, so uploads in the browser journeys still fail instead of reaching production.

## Node version
`.nvmrc` pins Node 22 and CI reads it (`node-version-file`). Some test dependencies need a recent Node: `jsdom` 29 needs 20.19 or later, and crashes on older 20.x. `package.json` deliberately has no `engines` field, because Vercel picks its build runtime from it and this change is about tests only.

## Coverage map
Snapshot from `npm run coverage` (unit and API tests only, so the component and rules layers are not counted; 339 tests, overall 13.41% of `src` and `api` statements, 12.26% of branches, almost all in pure helpers; refreshed at the end of Wave A, TST-3, 2026-10-01). Suite totals then: unit 259, API 80, component 156, rules 62 (+1 skipped, +2 todo), e2e three spec files (`smoke`, `money`, `rbac`; not rerun for TST-3, which touches no browser code or seed). Milestone 1 (2026-09-27) was unit 227, API 52, component 63, rules 60 (+2 todo). "Real" means the tests assert intended behaviour; "characterisation" means they record current behaviour, defects included. Refresh this table when tests land.

The component layer is not in `npm run coverage`. Measured once for TST-3 with `npx vitest run -c vitest.component.config.js --coverage --coverage.include='src/**' --coverage.reportsDirectory=<dir outside the repo>` (156 tests): 41.9% of `src` statements, 42.3% of branches. The money screens, statements: `Invoices.jsx` 63.3%, `QuotationBuilder.jsx` 59.6%, `Customers.jsx` 56.9%, `Leads.jsx` 45.8%, `Deals.jsx` 44.4%, `App.jsx` 42.6%, `FabricationWorks.jsx` 41.8%, `LeadCardDetails.jsx` 36.0%, `Partners.jsx` 35.0%, `Logistics.jsx` 31.0%. Not reached by any component test: `CostCalculator.jsx`, `AdminPanel.jsx`, `ContactSyncModal.jsx`, `ReferralForm.jsx`, `invoiceTemplate.js` (unit-tested instead), `firestoreSync.js` (1.1%, mocked; unit-tested separately). These percentages are a report, not a target.

| Code | Covered by | Kind | Gaps |
|---|---|---|---|
| `src/shared/utils/entityUtils.js` | `tests/unit/entityUtils.test.js`, `factories.test.js` | real, including `getExistingFinalInvoice` | alias cases beyond the nine recognised fields; the guard is client-state based, so two sessions acting at once can still both miss an invoice |
| `src/features/fabrication/cutListEngine.js` | `tests/unit/cutListEngine.test.js` | real, including first-fit-decreasing bar packing | none known |
| `src/shared/utils/dateUtils.js` | `tests/unit/dateUtils.test.js` | real (about 87%) | a few branches |
| `src/features/logistics/logisticsEngine.js` | `tests/unit/logisticsEngine.test.js` | real, including duplicate Finals and advance-only COD | UI labels (Logistics, LogisticsCardDetails, waybill) not covered by a test |
| `src/constants/emailTemplates.js` | `tests/unit/emailTemplates.test.js` | real, including `employee_approved` carrying no password | |
| `src/context/PermissionsContext.jsx` | `tests/unit/permissions.test.js`, `tests/component/StatusBadge.test.jsx` | real | receipts and quotations rows |
| `api/_lib/firebaseAdmin.js` | `tests/unit/firebaseAdmin.test.js` | real | initialisation paths |
| `api/admin-user.js` | `tests/api/adminUser.test.js` (405, missing token, CORS), `adminUserAuth.test.js` (invalid token, pending, deactivated, Manager rules, payload checks), `tests/integration/adminUser.test.js` (Admin SDK calls) | real | create, reset and delete are covered only by the emulator file |
| `vite.config.js` (`apiProxyPlugin`, dev server) | `tests/api/devProxy.test.js` | real | binds to `127.0.0.1` with no `--host` override in `dev`, `dev:emulated`, `preview`; `/api/admin-user`, `/api/generate`, `/api/send-email` reach the real handlers (token, role and staff gates hold), malformed JSON 400, other paths go to Vite. Handler behaviour itself is covered by the rows for `api/` |
| `api/generate.js`, `api/send-email.js` | `tests/api/generate.test.js`, `sendEmail.test.js` | real | generate: auth gate, staff-only callers (Partner, Business Client, Customer, unknown and missing role refused; Admin, Manager, Sales allowed), origin echo, oversize audio, model fallback (400 stops; 404, 503, 429 fall through); send-email: auth gate, staff-only senders (Partner, Business Client, Customer, unknown role and Deactivated refused), the eight allowed templates (FEA-8 added `employee_approved`), free-form and other templates refused, recipient must match a `users`, `pendingUsers`, `customers`, `partners` or `partner_applications` record (one case per template and caller), template render with HTML escaping, missing SMTP env. The hardcoded origin list is asserted only through generate |
| `firestore.rules` | `tests/integration/firestoreRules.test.js` (`users`, catch-all), `invoiceNumbering.test.js` (`counters`), `rulesAccess.test.js` (leads, invoices, partners, users, messages, quotations, counters, payouts and claims, settings, audit log, public forms), `effectiveAccess.test.js` (SEC-9: every role and signed out, read/create/update/delete on leads, deals, quotations, invoices, receipts, customers, partners, projects, logistics, users, pricing, auditLog, under `origin/main` and working-tree rules; helper `tests/helpers/effectiveAccess.js`, unit-tested in `tests/unit/effectiveAccess.test.js`) | real, including the Phase 7 3.4 and 3.5 rules; a few characterisation rows remain (see the register); 2 `it.todo` entries name follow-ups; the live-matrix case runs only with `LIVE_PERMISSIONS_JSON` | effective access probes records the caller does not own, so owner paths (customer, partner, message participant) are covered only by `rulesAccess.test.js`; `typing_indicators`, `counters`, `messages` and the public forms are not in the effective-access table |
| `storage.rules` | `tests/integration/storageRules.test.js` (11 cases: blueprints, partner vault, public registration uploads, default deny) | real, on the Storage emulator with Firestore for the staff check | only the three upload paths; the application-file buttons (FEA-11) are component-tested with `firebase/storage` mocked, so no test opens a real emulator Storage file through the UI |
| `src/features/partners/partnerLink.js` | `tests/unit/partnerLink.test.js`, plus two cases in `tests/component/Deals.test.jsx` | real (partner resolution by `partnerId` or `agentId`, the "Direct" placeholder, the partner rate flowing into quoting) | the lead card's agent dropdown is covered by `tests/component/LeadCardDetails.test.jsx` (TST-1) |
| `src/features/quotations/quotePricing.js`, `leadLineage.js`, `fabricationLink.js`, `dealProjectSync.js`, `invoicePrintData.js`, `qaGate.js`, `logisticsTask.js`, `authFlow.js`, `src/features/auth/superAdmin.js`, `src/services/driveService.js` | `tests/unit/superAdmin.test.js`, `driveService.test.js`, `tests/unit/quotePricing.test.js`, `leadLineage.test.js`, `fabricationLink.test.js`, `dealProjectSync.test.js`, `invoicePrintData.test.js`, `qaGate.test.js`, `logisticsTask.test.js`, `authFlow.test.js` | real (the pure rules extracted in Phase 7 steps 5 and 6: referral pricing terms and the LKR 38.00 default commission, area from a saved quote, lead to deal lineage (invoices, logistics job, invoice reference, invoice `leadId`/`dealId` stamps, the record a payment updates), size and billing link, the Cancelled-project guard and archive guard (`archiveBlock`), forward-only project sync (ignoring Cancelled, On Hold, Archived and unknown statuses), faithful invoice reprint, QA sign-off guard, logistics task shape, registration race, eviction and the sign-in gate (`canSignIn`), the super-admin-only Drive and Contacts gate, Picker attachment shape) | the Picker itself loads Google's script and is not run in tests |
| `src/features/quotations/pricingEngine.js` | `tests/unit/pricingEngine.test.js` | real (tiers, cost stack) plus characterisation (discount, commission, Profit/SQ) | rows above |
| `src/features/invoicing/invoiceTemplate.js`, `receiptTemplate.js`, `dealSettlement.js`, `invoiceSettlement.js` | `tests/unit/invoiceTemplate.test.js`, `receiptTemplate.test.js`, `dealSettlement.test.js`, `invoiceSettlement.test.js` | real (milestone maths incl. discount and tax, words, labels, deal final amounts and commission) | print output only asserted by substring |
| `src/shared/utils/validation.js`, `stringMatch.js`, `csvExport.js` | `tests/unit/validation.test.js`, `stringMatch.test.js`, `csvExport.test.js` | real, plus one characterisation row | `csvExport` is tested with `Blob`, `URL` and `document` stubbed; phone matching is now `phonesMatch` and tested here; the call sites in `Leads.jsx` and `Customers.jsx` are not |
| `src/services/firestoreSync.js` | `tests/unit/firestoreSync.test.js`, `atomicId.test.js` | real | `deriveReceiptId`, `generateSequentialId`, and `generateAtomicId` (padding, continuing a counter, the single `value` field) with firebase mocked; the subscribe and CRUD calls are untested here |
| `src/services/firebase.js` (`getScopedAccessToken`) | `tests/unit/scopedToken.test.js` | real (per-scope cache, expiry, hint, no-token and blocked-popup errors) | `logout` clearing the cached tokens (the sessionStorage stub cannot list keys) |
| `src/features/**`, `src/shared/**`, `App.jsx` | `StatusBadge` smoke test; `Receipts.test.jsx` (CSV export), `Invoices.receipt.test.jsx` (read-only amount, notes), `Invoices.policy.test.jsx` (edit policy, delete guard, cancel), `App.listeners.test.jsx` (listeners follow the role permissions), `PermissionsManager.test.jsx` (missing-modules button); `Deals.test.jsx` (completion waits for the Final invoice, which carries `leadId` and `dealId`), `Leads.lineage.test.jsx` and `Invoices.lineage.test.jsx` (logistics job and invoice reference follow the lead/deal lineage; conversion stamps `dealId` on the lead's invoices), `FabricationWorks.test.jsx` (QA pass, manual job billing link, QA gate, board statuses: Other bucket, read-only Cancelled, Hold and Resume, Archive and Show archived), `Partners.test.jsx` (settlements, referral eligibility), `AgentDatabase.test.jsx` (decline email sent before the pending registration is deleted; member status through `StatusBadge`; the Email button's role default; `employee_approved` after a staff approval, none for Partner, `employee_invite` with the set password for a partner application approved into a staff role; the application review opens the BR and NIC copies through `getDownloadURL` in a new tab, shows only the uploaded one, nothing when empty, toasts on error, and keeps the paths off the approved user record), `App.profileSync.test.jsx` (a Partner's profile save writes `partners` once, through `handleUpdateUser`), `UserProfile.test.jsx` (no Execution Plan link), `App.signOut.test.jsx` (B5 wiring); `Login.test.jsx` (registration role), `App.eviction.test.jsx` (deactivation eviction from the user's own document even when the users list is refused, login gate refuses Deactivated, LOGIN audit), `FabricationCardDetails.test.jsx` (locked milestone, hidden price, locked size), `FrameBlueprintPreview.test.jsx`, `Logistics.test.jsx` (stage sync and rollback), `LogisticsCardDetails.test.jsx` (cash collection), `LeadCardDetails.test.jsx` (Convert only at Received, agent fills partner fields and rate, saved-invoice reprint and draft print, oversized audio downsampled), `QuotationBuilder.test.jsx` (TST-3: line discount then tax, the 75 / 25 split, quote save, update and clone, the Advance and Final invoices passed to `onSaveInvoice` with `generateInvoiceId` ids, both lineage ids and `quotationId`, button guards by status, static confirmation once an invoice exists, number failure saves nothing, double click raises one invoice), `Leads.test.jsx` (TST-3: pipeline value excludes deals, `onSaveInvoice` wired through the lead card, stage advance raises no invoice, conversion modal amounts, deal, lead and project writes with `generateAtomicId` ids, existing job number kept, id failure and double conversion write nothing, customer order count or `AUTO-` customer, `dealId` stamped on invoices), `Customers.test.jsx` (DEC-8 sync button; TST-3: billing panel matches invoices by lineage, NIC or exact name, register and duplicate NIC, delete of a Business Client removes its `users` document and login) | real, plus two characterisations (phantom payout, unrounded 75 / 25 split) | the rest of `LeadCardDetails` (AI call analysis, receipts, logistics dispatch), `Leads` bulk actions, table view and CSV export, `QuotationBuilder` AI itemise, Drive attach and WhatsApp share, `Customers` contact import, AI WhatsApp draft, photo crop and the approval email, and the rest are untested; logic inside the large components is still mostly not extracted |
| `src/features/messaging/**`, `NotificationsView.jsx`, messaging mounts in `App.jsx` | `tests/unit/messageFilters.test.js` (own-message filter, read-by-recipient, reply shape), `tests/component/MessagingContext.test.jsx` (30-day id window and load older, optimistic send, reply shape, alert suppression by focus and audio setting), `Messages.test.jsx` (typing throttle and channel scope, load older, ticks, reply, failed send), `MiniChatDrawer.test.jsx` (ticks, failed send), `FloatingMessageToast.test.jsx` (failed quick reply), `NotificationsView.test.jsx` (own messages hidden), `App.messagingGate.test.jsx` (messenger, toast and mobile button follow the messages permission) | real (FEA-6) | read receipts (`markChatAsRead`, `markAllAsRead`), `recentConversations`, the chime itself (`audioAlert.js` is mocked); whether the live Firestore serves the id-range query without a composite index is not tested (the emulator ignores indexes) |
| `firebase.json` | `tests/unit/firebaseJson.test.js` (Firestore deploy target is `(default)` only; Auth, Firestore and Storage emulator ports kept) | real | that the emulators actually start is proved only by the CI rules job |
| Browser journeys | `tests/e2e/smoke.spec.js` (sign-in), `money.spec.js` (quotation to Advance to one Final), `rbac.spec.js` (navigation per role, deactivated sign-in refused, mid-session deactivation signs out) | real | deal completion journey |

## Characterisation register
Tests that deliberately lock in a known defect, with the finding that will change them. Add a row whenever you write one.

| Test | Records this behaviour | Changes with |
|---|---|---|
| ~~`pricingEngine.test.js` always takes a hidden 15% discount~~ | flipped in Phase 7 6.6: discount is a parameter defaulting to 0 | cost-calculator-quotation finding 2 |
| ~~`pricingEngine.test.js` charges a fixed 53.5 per sq ft sales cost~~ | flipped in Phase 7 6.6: commission is a parameter, 0 for direct leads | cost-calculator-quotation finding 3 |
| ~~`pricingEngine.test.js` computes Profit / SQ as (grossProfit + logistics + qa + salesCost) / sqFt~~ | flipped in Phase 7 6.6: gross profit per sq ft | cost-calculator-quotation finding 1 |
| ~~`invoiceTemplate.test.js` scales each line item and ignores discountPct and taxPct~~ | flipped in Phase 7 2.4: line totals apply discount and tax before the milestone scaling | invoicing Phase 2 item 5 |
| ~~`logisticsEngine.test.js` doubles the COD balance for two unpaid Finals~~ | flipped in Phase 7 2.3: only the latest unpaid Final counts | invoicing D-2, logistics D-4 |
| ~~rulesAccess.test.js lets a Customer read and write quotations~~ | flipped in Phase 7 3.5: quotations follow the quotations permission | rbac finding 5 |
| ~~rulesAccess.test.js lets any signed-in user read a conversation they are not in and forge a sender~~ | flipped in Phase 7 3.5: participants only, and sending as yourself | messaging D-MSG-01, D-MSG-02 |
| ~~rulesAccess.test.js lets a Customer read another user's profile~~ | flipped in Phase 7 3.5: Admin, self, or agents/messages view | rbac finding 12 |
| ~~`rulesAccess.test.js` lets a Customer write any counter to any value~~ | flipped in Phase 7 3.4: known prefixes only and at most one step ahead |
| ~~`rbac.spec.js` "the deactivated user still signs in (known defect)"~~ | flipped in SEC-11: `canSignIn` refuses a Deactivated or Disabled status even with `isApproved: true`; now "the deactivated user cannot sign in" | TST-2 finding (login check to honour `status`) |
| `rulesAccess.test.js` "still lets a signed-in user lower a counter" | the counters rule has no lower bound (it would reject legitimate writes under transaction contention) | numbering moved server-side (not planned yet) |
| ~~`rulesAccess.test.js` denies partner_payouts and referral_claims to everyone~~ | flipped in Phase 7 3.4: new match blocks | partners D-6 |
| ~~rulesAccess.test.js lets a Deactivated user with a permitted role still create a lead~~ | flipped in Phase 7 3.5: Deactivated and Disabled are denied everywhere | rbac finding 1 |
| ~~`rulesAccess.test.js` does not treat the bootstrap email as Admin~~ | flipped in Phase 7 3.4: `isAdmin()` accepts the bootstrap emails | auth DP-06 |
| ~~`rulesAccess.test.js` rejects a pending applicant updating their own pendingUsers document~~ | flipped in Phase 7 3.4: self-update allowed, approval not | auth DP-02 |
| ~~rulesAccess.test.js rejects a Manager changing or deleting another user~~ | flipped in Phase 7 3.5: Managers administer non-Admin users within guards | employees D4 |
| ~~rulesAccess.test.js blocks a Manager with invoices:delete ... from deleting an invoice~~ | flipped in Phase 7 3.5: delete follows the module's delete permission | rbac finding 6 |
| ~~rulesAccess.test.js denies a lead read to a role that has pipeline view but not leads view~~ | flipped in Phase 7 3.5: leads OR pipeline reads; writes follow isDeal | deals D-8 |
| `rulesAccess.test.js` "denies an anonymous read of an Active partner" | partners are never public; D-5 is held because a partner document holds bank details | a decision on a public partner-profile document |
| `rulesAccess.test.js` "lets a Partner read another partner's document ..." | the rule checks the partners permission, not record ownership (the matrix now grants Partner view and edit only) | follow-up: Partners screen queries its own document, then the rule is limited to it |
| ~~`Deals.test.jsx` creates another Final invoice when the deal already has one~~ | flipped in Phase 7 2.1: completion skips the create when `getExistingFinalInvoice` finds one | invoicing D-1, deals D-1 |
| ~~`FabricationWorks.test.jsx` creates a Final invoice when one already exists~~ | flipped in Phase 7 2.1: App passes invoices and QA pass skips the create | invoicing D-1, fabrication F-1 |
| `QuotationBuilder.test.jsx` "stores unrounded amounts when the total does not divide into whole cents" | the 75 / 25 split is `total * 0.75` and `total * 0.25` with no rounding, so LKR 33,333.33 gives an Advance `amount` of 24,999.9975 | BACKLOG TST-3 finding (round to cents, Final as the remainder; an owner call) |
| `Partners.test.jsx` "shows a success toast on Disburse Payout but writes nothing" | Disburse Payout is a toast only | partners D-1 (Phase 7 4.1) |
| ~~`App.signOut.test.jsx` keeps the previous user's unread count~~ | flipped in Phase 7 1: `handleSignOut` now clears notifications, and the test asserts the count is gone | notifications NOTIF-01 |
| ~~`validation.test.js` "formats +94 and 07 spellings the same for display, but the raw stored strings still differ"~~ | ~~stored phones are compared with exact string equality, so different spellings of one number do not match~~ | customers Decision 3 (Phase 7 6.3, `normalizePhone`) (flipped: `normalizePhone` and `phonesMatch`)|
| ~~`adminUserAuth.test.js` lets a Deactivated caller with isApproved true through~~ | flipped in Phase 7 3.6: a Deactivated or Disabled caller gets 403 | user-management-rbac finding 1 |
| ~~`adminUserAuth.test.js` rejects a Manager caller today~~ | flipped in Phase 7 3.6: Managers may call it, but not on Admin accounts or to grant Admin | employees D4 |
| ~~`logisticsEngine.test.js` reports nothing to collect for an advance-only job~~ | flipped in Phase 7 2.3: the 25% balance is reported as pending Final invoice creation | logistics D-4 |
| ~~`dealSettlement.test.js` defaults a partner with no rate to 53.5 per sq ft~~ | flipped at Milestone 1: the default is `DEFAULT_REFERRAL_COMMISSION_RATE`, LKR 38.00 | owner decision DEC-1 |
| ~~`quotePricing.test.js` quotes a referral with no partner rate at LKR 30.00~~ | flipped at Milestone 1: LKR 38.00, the same single default | owner decision DEC-1 |
| ~~`scopedToken.test.js` grants a Drive or Contacts token to any signed-in user~~ | flipped at Milestone 1: the super admin only, refused before any popup; Drive uses `drive.file` | owner decision DEC-8 |

Planned entries (later Part B): open `quotations`, `messages`, `users` and `counters` rules (B4).

## Roadmap
Part A (setup) is done: all five layers and CI exist. Part B status:
- **Done:** B1 money-path unit tests, B2 supporting unit tests, B3 API handler cases, B4 rules cases, B5 component wiring cases.
- **Phase 7 status:** steps 1 to 6 are done and merged (the rules work 3.3 to 3.5 is written and tested but not deployed).
- **Milestone 1 (2026-09-27):** the Storage rules layer was added (`storageRules.test.js`), and the DEC-1 and DEC-8 flips are in the register above.
- **Done:** B6 E2E journeys (TST-2: `money.spec.js`, `rbac.spec.js`). **Done:** TST-1 and TST-3 (component coverage for the lead card, `Leads`, `QuotationBuilder`, `Customers`). Wave A as a whole is covered by the map above.
Progress is tracked in `PLAN.md`.

## Gotchas
- **Node:** `.nvmrc` pins 22. jsdom 29 crashes on Node older than 20.19.
- **`firebase emulators:start` ignores `firestore.rules`:** `firebase.json` declares firestore as an array, so the emulator runs allow-all. `tests/fixtures/seed.mjs` uploads the rules; `firebase emulators:exec` (used by `test:rules`) gets them from `setupRulesEnv`.
- **Orphaned emulator:** if a run is killed, a Java emulator can keep port 8080 and the next run hangs waiting for Auth on 9099. Kill the `cloud-firestore-emulator` process. Playwright's `gracefulShutdown` normally prevents this.
- **`matchesEntity` ignores `jobNo` and `linkedJobNo`:** projects and logistics jobs linked only by job number do not match a deal through it. The COD engine compares job numbers separately.
- **`DEFAULT_PERMISSIONS` is not the live matrix:** rules and the app read the `settings/permissions` document. `PERMISSIONS_FIXTURE` in `tests/helpers/emulator.js` is an independent copy for rules tests; keep it in sync by hand (`tests/unit/effectiveAccess.test.js` fails when it drifts from `DEFAULT_PERMISSIONS`).
- **Seeded logins** (password `Passw0rd!test`): `admin@example.com`, `partner@example.com`, `deactivated@example.com`. Emulator only; never reuse these anywhere real.
- **Parallel files:** integration files share one stateful emulator, so files run sequentially.
- **Intermittent failure:** `tests/integration/adminUser.test.js` "resetPassword ... signs in with only the new one" failed once on 2026-09-27 and passed on an immediate rerun with no code change. Cause not investigated (likely Auth emulator timing); rerun once before debugging, and investigate if it fails twice.
