## Changelog
- MON-16: re-applying a defaulted partner rate no longer notifies Admins and Managers again; `LeadCardDetails` fans out the `commission` notification only when the previous `pricingMetadata.commissionRateDefaulted` was not true (the warning toast is unchanged). Tests: component +2 (`Leads.defaultedCommission.test.jsx`).

## Testing map
- Coverage map, leads row: note the MON-16 cases (re-apply and already-flagged lead do not re-notify) in `tests/component/Leads.defaultedCommission.test.jsx`.

## Status
done; tests: unit 0, API 0, component 2, rules 0, e2e 0
