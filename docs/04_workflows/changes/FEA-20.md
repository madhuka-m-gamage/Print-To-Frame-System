## Changelog
- FEA-20: the QA-passed email resolves the job's customer record (`resolveQaRecipient` in `src/features/fabrication/qaRecipient.js`: NIC, then `customerId` case-insensitively, then `leadId`, then phone) and sends to its stored email; it no longer falls back to the deal email, and a job with no customer record shows "register the customer first" and opens no preview. Fixes converted jobs whose `AUTO-` NIC differs from the customer's. Tests: unit +5 (`qaRecipient.test.js`), component +3 and one flipped (`FabricationWorks.test.jsx`).

## Testing map
- Coverage map, operations-fabrication / inspection row: add `tests/unit/qaRecipient.test.js` (QA-passed email recipient resolution) and note the FEA-20 cases in `tests/component/FabricationWorks.test.jsx`.

## Status
done; tests: unit 5, API 0, component 3, rules 0, e2e 0
