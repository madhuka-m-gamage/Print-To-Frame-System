## Changelog
- **SEC-8 (partners D-9): a Partner reads only its own referred leads and their invoices** (rules not deployed, LIVE-1). `firestore.rules`: `leads` read adds `isReferringPartnerOf(resource.data)`, true when `partnerId` or `agentId` names a `partners` document whose `email` is the login email; `invoices` read adds the same check on the lead its `leadId` names (rules `get()`, since Advance invoices carry no partner field). The `leads` read clause now calls `checkPermission` once per module (`read` already accepts `view`) to stay under Firestore's 1000-expression limit. `src/App.jsx` gives a Partner two leads queries (`partnerId` / `agentId == <its partners doc id>`, merged by document id) and one invoices query per lead (`leadId == id`), the same constraints the rules check. Tests: new `tests/integration/partnerScopedReads.test.js` (11) and `tests/component/App.partnerScope.test.jsx` (2); no `EXPECTED_RULE_CHANGES` cell flips. Unit 322, component 180, rules 98 (+1 skipped, 1 todo), e2e 10.

## Testing map
- Rules row (`firestore.rules`): add `partnerScopedReads.test.js` (SEC-8): a Partner reads its referred leads (by `partnerId` or `agentId`) and those leads' invoices, lists them only with the matching `where`, is denied another partner's lead or invoice, a Direct lead and an unlinked invoice; staff reads unchanged.
- `src/App.jsx` listeners row: add `App.partnerScope.test.jsx` (SEC-8): a Partner gets scoped leads and per-lead invoices queries, never the whole collections; staff get no scoped queries.

## Status
done; tests: unit 322, API not run (unchanged), component 180, rules 98, e2e 10
