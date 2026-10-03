## Changelog
- MON-7: the Leads FilterBar has a "Defaulted commission" toggle listing leads with `pricingMetadata.commissionRateDefaulted == true`, and applying a defaulted partner rate in the lead card stores a `commission` notification for each active Admin and Manager. Tests: component +3.

## Testing map
- Leads row: add `Leads.defaultedCommission.test.jsx` (defaulted filter, Admin and Manager notification fan-out) (MON-7).

## Status
done; tests: unit 0, API 0, component 3, rules 0, e2e 0
