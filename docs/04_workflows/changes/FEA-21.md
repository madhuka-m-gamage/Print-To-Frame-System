## Changelog
- Fabrication: the dispatch customer name, the QA-pass Final invoice customer fields and the card client details now find the customer of a converted job through `resolveQaRecipient` instead of NIC alone (F-12); the Final invoice lookup skips the phone fallback. Tests: component 5 new.

## Testing map
- Fabrication F-12 (characterisation register): fixed by FEA-21; component coverage in `FabricationWorks.test.jsx` and `FabricationCardDetails.test.jsx`.

## Status
done; tests: unit 347, API 0, component 5 new, rules 0, e2e 0
