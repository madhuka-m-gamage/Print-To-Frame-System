## Changelog
- MON-4: one Advance and one Final invoice per root lead is now enforced server-side. `handleSaveInvoice` writes the invoice together with `invoice_guards/<rootLeadId>_<Advance|Final>` in one `createDocumentIfAbsent` transaction (extended with an optional guard document), so a second save, including two sessions racing, is refused with an error toast. New `invoice_guards` rules block: read with `invoices` view, create with `invoices` create / edit, never updated or deleted. Rules not deployed (LIVE-1). Tests: unit 3, component 4, rules 16 (new `invoiceGuards.test.js`).

## Testing map
- Coverage map, invoicing row: add `tests/integration/invoiceGuards.test.js` (rules: create-only `invoice_guards`, racing Final) and `tests/component/App.invoiceGuard.test.jsx` (`handleSaveInvoice` guard).
- Coverage map, services row (`firestoreSync.js`): `createDocumentIfAbsent` with a guard document covered in `tests/unit/firestoreSync.test.js`.

## Status
done; tests: unit 3, API 0, component 4, rules 16, e2e 0
