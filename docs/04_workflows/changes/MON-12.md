## Changelog
- MON-12: an Advance or Final invoice guard (`invoice_guards/<rootLeadId>_<type>`) is handed to the next invoice for that lead once the invoice it names is Cancelled or deleted, in the same transaction (`createDocumentIfAbsent`, `firestore.rules` `invoice_guards` update rule); a live invoice keeps blocking and guards still cannot be deleted. Rules not deployed (LIVE-1). Tests: unit +3, component +2, rules +7.

## Testing map
- Invoicing row: add `App.invoiceGuard.test.jsx` replacement-after-cancel cases (MON-12) and `invoiceGuards.test.js` guard hand-over rules (MON-12).

## Status
done; tests: unit 3, API 0, component 2, rules 7, e2e 0
