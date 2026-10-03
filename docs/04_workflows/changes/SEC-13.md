## Changelog
- **SEC-13: a pending registration is bound to its own login** (rules not deployed, LIVE-1). `firestore.rules` `pendingUsers`: create needs a signed-in caller whose token email is the document id and whose auth uid is the record's `uid` (signed-out creates are refused); an applicant update must keep `uid` or set it to their own. No app change: the auth listener's shell record and `handleRegister`'s overwrite already run signed in with the uid. Tests: new `tests/integration/pendingUsersUid.test.js` (11), `rulesAccess.test.js` anonymous pending sign-up flipped to refused; no `EXPECTED_RULE_CHANGES` cell flips (pendingUsers is not probed). Rules 125 (+1 skipped, 1 todo), e2e 10.

## Testing map
- Rules row for `pendingUsers`: add `pendingUsersUid.test.js` (create bound to token email and uid, uid kept on update, Admin review unchanged).

## Status
done; tests: unit 0, API 0, component 0, rules 11, e2e 0
