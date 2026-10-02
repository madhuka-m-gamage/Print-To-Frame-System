## Changelog
- **SEC-7:** a Partner is limited to its own `partners` record. `firestore.rules` adds `ownsPartner(partnerId)` (doc id or `email` equals the login email); other partners are readable and writable only by non-Partner roles with the partners permission, and a Partner may update only its profile fields (`name, contactPerson, phone, address, company, bankName, accountNumber, accountName, branchName, photoURL, documents, updatedAt`), never `commissionRate`, `status`, `email` or balances. `App.jsx` subscribes a Partner with `where('email', '==', identifier)`; `Partners.jsx` reads a Partner's referral claims with `where('partnerEmail', '==', identifier)`, saves only the editable fields for a Partner and hides the commission rate input; Register Partner saves the email lowercased so it matches the login email. Rules not deployed. Tests: rules +8 and one characterisation test removed (`rulesAccess.test.js`, effective-access expected changes), component +3 (`App.listeners.test.jsx`, `Partners.test.jsx`).

## Testing map
- Partners, rules row: add `rulesAccess.test.js` "a Partner is limited to its own partners record (SEC-7)" (staff read all, Partner reads own by id or email query only, mixed-case email does not match, profile-field-only update, commissionRate/status/balances/email refused, no create, non-staff non-Partner denied, claims by own `partnerEmail` only).
- Partners, component row: `Partners.test.jsx` asserts a Partner's claims query on `partnerEmail` and that a Partner's save sends only editable fields; `App.listeners.test.jsx` asserts a Partner's `partners` subscription is the `where('email', '==', identifier)` query.
- Characterisation register: remove the `rulesAccess.test.js` "lets a Partner read another partner's document ..." row (flipped by SEC-7).
- Effective access row: `effectiveAccess.test.js` `EXPECTED_RULE_CHANGES` lists Partner partners read, create, update (true to false); `partners` has its own probe in `tests/helpers/effectiveAccess.js`.

## Status
done (rules not deployed: owner step); tests: unit 312, API not run (unaffected), component 175 (+3), rules 75 (+7 net), e2e 10
