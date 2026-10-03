## Changelog
- MON-13: the quotation screen waits for the invoice save and stops when it is refused (MON-4 guard, or a save error): no "invoice generated" message and the quotation is not marked Invoiced, for both the 75% Advance and the 25% Final button. Tests: component 6 added.

## Testing map
- Cost calculator / quotation row: add the MON-13 block in `tests/component/QuotationBuilder.test.jsx` (false and rejected save for Advance and Final, true path unchanged).

## Status
done; tests: unit 336, API 0, component 216, rules 0, e2e 0
