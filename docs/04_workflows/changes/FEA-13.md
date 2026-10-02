## Changelog
- Profile sync: a Customer's or Business Client's `customers` record is now updated through `handleUpdateUser` (looked up by email, which the rules allow; the old NIC lookup was denied and broke the whole sync), and an emptied phone, address or company now clears the stored value in `partners` and `customers`. No rules change. Tests: rules 1 added, component 2 added.

## Testing map
- none

## Status
done; tests: unit 287, API 0, component 158, rules 64, e2e 0
