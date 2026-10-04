## Changelog
- SEC-16: the owning Partner may now create its own `partner_public/{partnerId}` mirror (keys `name`, `status`, `logo`, `updatedAt`; `status` must equal its `partners` record), and `partnerPublicOps` always writes a `set` carrying status, so a Partner whose mirror was never written can save its profile, avatar and account details. Rules not deployed (LIVE-1). Tests: rules +2, unit and component cases updated (unit 347, component 252, rules 222).

## Testing map
- Partners row (rules, `tests/integration/rulesAccess.test.js` SEC-6 block): add owner create of a missing mirror and owner set carrying the partners status.

## Status
done; tests: unit 347, API 0, component 252, rules 222, e2e 0
