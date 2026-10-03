## Changelog
- MON-11: a partner payout now also creates a create-only `payout_guards/<lead doc id>` document per paid lead in the same batch, and a new `payout_guards` rules block (Admin create only, with the named `partner_payouts` record in the same write; no update or delete) makes a second payout of an already-paid referral fail as a whole, so the partner's balance drops only once. Rules not deployed (LIVE-1). Tests: rules +10 (`payoutGuard.test.js`), component 1 updated (`Partners.test.jsx`).

## Testing map
- Partners / Disburse Payout row: add `tests/integration/payoutGuard.test.js` (MON-11: double payout refused, guard immutable, non-Admin refused) and note the component test now asserts the `payout_guards` op.

## Status
done; tests: unit 327, API 0 run, component 194, rules 124 (+1 skipped, 1 todo), e2e 0 run
