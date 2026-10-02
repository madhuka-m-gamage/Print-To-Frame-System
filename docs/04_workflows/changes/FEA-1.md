## Changelog
- Partners: Disburse Payout now pays out for real (FEA-1, partners D-1). It builds the payout from the referrals marked Eligible for Payout (new pure helper `buildPayout` in `src/features/partners/payout.js`, amounts from each referral's commission, rounded to cents), then commits one batch: a `partner_payouts` record (partner id, email, amount, `TXN-######` reference, settled lead ids, `createdAt`, `createdBy`), `payoutStatus: 'Paid'` on each lead, and the partner's `pending` reduced and `settled` increased. It logs `PAYOUT_DISBURSED`, shows the reference, disables the button while running, says so when nothing is eligible, and on failure toasts and changes nothing locally. Works live only after the `partner_payouts` rules are deployed (LIVE-1). Unit tests: 7 added; component tests: 3 added (the phantom-payout characterisation flipped into 4); rules tests: 12 added (`tests/integration/partnerPayouts.test.js`).

## Testing map
- Strike the characterisation register row `Partners.test.jsx` "shows a success toast on Disburse Payout but writes nothing": flipped in FEA-1 (one batch: payout, lead updates, partner balance).
- Coverage map, `src/features/**` row: `Partners.test.jsx` (settlements: payout batch, nothing eligible, failure, button disabled while running; referral eligibility); remove "plus one characterisation (phantom payout)"; add `payout.test.js` (unit, FEA-1).
- Coverage map, `firestore.rules` row: add `partnerPayouts.test.js` (FEA-1: Admin commits the payout batch, every other role and signed out rejected with nothing written, a partner reads only its own payouts).

## Status
done; tests: unit +7, API 0, component +3, rules +12, e2e 0
