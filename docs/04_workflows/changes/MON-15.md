## Changelog
- MON-15: partner `pending` can no longer be driven below 0 by a payout. The `partners` staff update rule refuses a write that changes `pending` and leaves it below 0 (rules not deployed, LIVE-1); Disburse Payout refuses a payout larger than the partner's current `pending` with a toast and writes nothing, and explains a refused batch; deal completion accrues a cent-rounded `pending: increment()` instead of an absolute value from the screen copy (`roundCents` now exported from `payout.js`). New backlog item MON-17 (Edit modal writes stale balances). Tests: unit +1, component +3, rules +4.

## Testing map
- Partners coverage row: add "payout larger than `pending` refused before any write; `permission-denied` batch failure gets its own message (MON-15)".
- Deals coverage row: commission accrual on completion is now asserted as `pending: increment(<cents>)` (flipped from the absolute `pending: 535` / `5350` assertions, MON-15), plus a cent-rounding case.
- Rules coverage row (`payoutGuard.test.js`): add the MON-15 block (overdraw refused, exact-to-0 allowed, unrelated edit on a negative doc allowed).

## Status
done; tests: unit 1, API 0, component 3, rules 4, e2e 0
