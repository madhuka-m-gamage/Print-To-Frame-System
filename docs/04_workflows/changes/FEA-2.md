## Changelog
- FEA-2: the commission-cleared notification is now a persisted `notifications` document addressed to the referring partner (new rules block, not deployed until LIVE-1), read by the partner and marked read on opening Notifications; "Verify & Credit Commission" opens a modal that links a claim to an existing lead (`partnerFieldsFor`) or converts it into a new `Referral` lead (`generateAtomicId('L')`). Tests: new notifications rules suite, component +7.

## Testing map
- Rules: add a `notifications` row (read by recipient or Admin, create needs invoices edit, recipient updates only `read`), file `tests/integration/notifications.test.js`.
- Component: `App.commissionNotification.test.jsx` (notification written, no local duplicate), `NotificationsView.test.jsx` (own notifications only), `Partners.claims.test.jsx` (link and convert claim).

## Status
done; tests: unit 327, API 80, component 201, rules 141, e2e 10
