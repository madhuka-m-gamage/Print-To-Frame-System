## Changelog
- Invoice split rounded to cents (MON-8): new `splitInvoiceAmounts` helper makes the Advance 75% rounded half up to cents and the Final the remainder, used by the quotation builder, deal completion and the Fabrication QA pass, so the two always add up to the total (LKR 33,333.33 gives 25,000.00 and 8,333.33). Existing invoices are not rewritten. Unit 7 new (6 helper, 1 settlement), component 2 new and 1 flipped.

## Testing map
- Characterisation register: remove the row for `QuotationBuilder.test.jsx` "stores unrounded amounts when the total does not divide into whole cents" (flipped to "rounds the Advance to cents and bills the remainder as the Final (MON-8)").
- Coverage map, `src/features/**` row: change "real, plus two characterisations (phantom payout, unrounded 75 / 25 split)" to one characterisation (phantom payout); add `splitInvoiceAmounts.test.js` to the unit row; `Deals.test.jsx` and `FabricationWorks.test.jsx` gain a cent-rounding check.

## Status
done; tests: unit 7, API 0, component 2, rules 0, e2e 0
