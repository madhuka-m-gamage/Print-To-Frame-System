## Changelog
- MON-14: "Disburse Payout" moves the partner's `pending` and `settled` with `increment()` deltas instead of totals from the screen copy, so two admins paying out different referrals of one partner at once both count. No rule change (the partners rule already accepts the Admin increment and refuses a Partner's); `pending` is no longer floored at 0. Tests: component 1 changed, rules 4 added.

## Testing map
- Partners (Monthly Settlements / payout) row: add `tests/integration/payoutGuard.test.js` MON-14 block (concurrent payouts of different referrals in either order, same referral refused, Partner cannot change balances by increment or value); component test asserts the partner update uses `increment()`.

## Status
done; tests: unit 333, API 0, component 207, rules 190, e2e 0
