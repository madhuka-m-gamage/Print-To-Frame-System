## Changelog
- **FEA-15: customers linked to logins by `userId`** (rules not deployed, LIVE-1). `firestore.rules` `customers`: `ownsCustomer()` adds `userId == request.auth.uid` beside the email / nic clauses for a client's read and profile-field update (`name`, `photoURL`, `phone`, `address`). Registration stores the Auth `uid` on `pendingUsers` (form and Google first sign-in), an application approval takes it from `/api/admin-user`, the Business Client hand-off pre-fills it and `Customers.jsx` saves it as `customers.userId`; `handleUpdateUser` looks the row up by `userId`, then by `email`. Tests: new `tests/integration/customerUserId.test.js` (6), `App.profileSync.test.jsx` (+2), `AgentDatabase.test.jsx` (+2), `Customers.test.jsx` (+2); no `EXPECTED_RULE_CHANGES` cell flips. Unit 322, component 194, rules 114 (+1 skipped, 1 todo).

## Testing map
- Rules row (`firestore.rules`): add `customerUserId.test.js` (FEA-15): a client reads, queries by `userId` and updates the profile fields of the row linked to their uid even when its email differs, cannot change order, financial, `userId` or `email` fields, is denied another uid's row, and the email clause still works.
- `src/App.jsx` profile sync row: `App.profileSync.test.jsx` (FEA-15): the customers lookup goes by `userId` first and falls back to `email`.
- `AgentDatabase.jsx` row: approval passes the applicant's `uid` (self-registered, or the account created for an application) to `onApprove` (FEA-15).
- `Customers.jsx` row: the handed-off Register Client form saves the pre-filled `userId`; a manual registration carries none (FEA-15).

## Status
done; tests: unit 322, API not run (unchanged), component 194, rules 114, e2e not run (no e2e in plan)
