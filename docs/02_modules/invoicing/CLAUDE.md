# Invoicing: module notes for Claude

Full map: [../invoicing.md](../invoicing.md). Cross-module chains: [CROSS_MODULE_TRIGGERS.md](../../01_architecture/CROSS_MODULE_TRIGGERS.md). There are no Cloud Functions; all automation is client code (`src/App.jsx`, components) or `api/*.js`.

## What it does

Invoices are `invoices` documents numbered `INV-ADV-####` / `INV-FIN-####` from a transactional counter. Advance = 75%, Final = 25% of the value.

## Code

- `src/components/crm/Invoices.jsx`, `src/utils/invoiceTemplate.js`
- `src/services/firestoreSync.js` (`generateInvoiceId`, `generateAtomicId`); `src/App.jsx` handlers
- Test: `tests/integration/invoiceNumbering.test.js`

## Firestore collections it owns or writes

- Owns `invoices`, `counters`. Writes `receipts`, `leads` (`stage`, `invoicePaid`, `referralStatus`), `auditLog`.

## Triggers and side effects

- Marking paid can advance the lead to "Received", set `invoicePaid`, flag partner referrals Eligible for Payout and emit a commission notification.
- No invoice email is sent anywhere.

## Before you edit

- The 75 / 25 percentages are hardcoded in `QuotationBuilder.jsx`, `Deals.jsx` and `FabricationWorks.jsx`; the edit form lets `amount` change freely.
- Always reserve the id with `generateInvoiceId` first; both automatic creators abort the stage change if that fails.
- One Advance and one Final per lead is a UI convention, not enforced in rules or data.
