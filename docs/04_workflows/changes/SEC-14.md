## Changelog
- **SEC-14: dead `partnerId == token email` read clause removed; a Partner reads its referred leads' receipts** (rules not deployed, LIVE-1). `firestore.rules`: the clause is gone from `invoices` and `receipts` (`partnerId` holds a partner code, never an email); `receipts` read now also allows the referring partner of the lead its `leadId` names, the SEC-8 lead check shared as `isReferringPartnerOfLeadId`. Receipts copy `leadId` from their invoice. No app change (a Partner is not yet subscribed to receipts). Also unbreaks staging's `App.invoiceGuard.test.jsx` (MON-4 x FEA-2): adds the `subscribeToQuery`, `query` and `where` mocks. Tests: new `tests/integration/partnerReceipts.test.js` (8); no `EXPECTED_RULE_CHANGES` cell flips. Rules 186 after catch-up (+1 skipped, 1 todo).

## Testing map
- Rules row for `receipts` (and `invoices`): add `partnerReceipts.test.js` (Partner reads its referred leads' receipts by `leadId`, other partner's denied, `partnerId` equal to the login email grants nothing, staff reads unchanged).

## Status
done; tests: unit 0, API 0, component 0, rules 8, e2e 0
