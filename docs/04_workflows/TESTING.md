# Testing

Five layers, each with one job. Pick the cheapest layer that can prove the behaviour.

| Layer | Directory | Environment | Command | Status |
|---|---|---|---|---|
| Unit | `tests/unit/` | node | `npm test` | live |
| API handlers | `tests/api/` | node, mock req/res | `npm run test:api` | planned (A2) |
| Component | `tests/component/` | jsdom + React Testing Library | `npm run test:component` | planned (A3) |
| Integration / rules | `tests/integration/` | Firebase emulator | `npm run test:rules` | live |
| End to end | `tests/e2e/` | Playwright + emulator | `npm run test:e2e` | planned (A5, A6) |

Coverage: `npm run coverage` (text, html, lcov in `coverage/`). There is no threshold; it is a report, not a gate.

## What belongs where
- **Unit**: pure functions in `src/utils`, `src/services` (pricing, templates, matching, validation). If a decision is buried in a component handler, extract it to a pure helper and test that.
- **API**: `api/*.js` handlers with mocked Firebase Admin, Gemini and SMTP. Never touch real services.
- **Component**: wiring and rendering of a React component with `firestoreSync` mocked.
- **Integration / rules**: `firestore.rules` behaviour against the local emulator (Java required). Proves a rule denies, not that the UI hides a button.
- **E2E**: a few full journeys against the emulator-backed dev server. Most expensive layer; keep it small.

## Adding a test
- Unit: add `tests/unit/<module>.test.js`. Import `describe`, `it`, `expect` from `vitest` explicitly (`globals: false`). Build fixtures with `tests/helpers/factories.js` (`makeLead`, `makeDeal`, `makeInvoice`, `makeReceipt`, `makePartner`, `makeProject`, `makeLogisticsJob`, `makeUser`).
- Other layers: see the phase notes as each harness lands.

## Rules
- Test files run sequentially (`fileParallelism: false`): integration files share one stateful emulator and parallel files clobbered each other's data.
- Modules that import `src/services/firebase.js` call `initializeApp` at load; `vi.mock` it (and `firestoreSync`) in any test that reaches them.
- **Characterisation tests** lock in today's behaviour, including known defects. Each must carry a comment naming the finding (`docs/02_modules/*/FINDINGS.md`) that will change it, so the later flip is a deliberate edit and not a mystery failure.
- Factory lineage: `matchesEntity` (`src/utils/entityUtils.js`) only recognises `id`, `_firestoreId`, `firestoreId`, `leadId`, `dealId`, `originalLeadId`, `convertedDealId`, `rootLeadId`, `businessEntityId`. `jobNo`, `linkedJobNo`, `clientNIC` and `customerId` are not matched by it; the COD engine compares job numbers separately.
