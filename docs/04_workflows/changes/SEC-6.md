## Changelog
- SEC-6: public partner profile (partners D-5). New `partner_public/{partnerId}` mirror (`name`, `status`, `logo`, `updatedAt`) that anyone may `get`; staff with partners create/edit write it, the owning Partner may change only `name` and `logo`, `partners` stays closed to anonymous reads (rules not deployed, LIVE-1). Every partners write path (Register Partner, Edit save, avatar crop, sign-in photo sync, `handleUpdateUser`, Delete Partner) writes the mirror in the same `batchWrite` through `partnerPublicOps`; `ReferralForm.jsx` reads only `partner_public/{ref}` and shows the generic name when it is missing or not Active. No backfill; the seed has `partner_public/P-1001`. Tests: unit +4, component +6, rules +7.

## Testing map
- Characterisation register row `rulesAccess.test.js` "denies an anonymous read of an Active partner": resolved, the deny stays as intended behaviour; the public profile decision is SEC-6 (`partner_public`), remove the "a decision on a public partner-profile document" flip condition.
- Rules coverage row (`rulesAccess.test.js`): add "partner_public (SEC-6): anonymous get allowed, anonymous and other-partner writes denied, owning Partner updates name/logo only, staff create/update, partners delete, Partner cannot create or delete, staff limited to name/status/logo/updatedAt".
- Partners coverage row: add "Register Partner and Edit save batch the `partner_public` mirror (staff set, Partner owner update) (SEC-6)"; new row `ReferralForm.test.jsx`: reads only `partner_public/{ref}`, generic name when missing or non-Active, lead write unchanged with `commissionRate: 0`.
- Unit coverage: add `partnerPublic.test.js` (mirror helper).
- App coverage row (`App.profileSync.test.jsx`): `handleUpdateUser` writes partners and the mirror in one batch.

## Status
done; tests: unit 4, API 0, component 6, rules 7, e2e 0
