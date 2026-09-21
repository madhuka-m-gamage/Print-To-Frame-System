# Receipts: module notes for Claude

Full map: [README.md](README.md). Audit findings & open questions: [FINDINGS.md](FINDINGS.md). Cross-module chains: [CROSS_MODULE_TRIGGERS.md](../../01_architecture/CROSS_MODULE_TRIGGERS.md). There are no Cloud Functions; all automation is client code (`src/App.jsx`, components) or `api/*.js`.

## What it does

Receipts are proof-of-payment records generated from a Paid invoice; the id is derived from the invoice id and duplicates are rejected in a transaction.

## Code

- `src/features/invoicing/Receipts.jsx`, `src/features/invoicing/receiptTemplate.js`
- `deriveReceiptId`, `createDocumentIfAbsent` in `src/services/firestoreSync.js`; `handleGenerateReceipt` in `src/App.jsx`

## Firestore collections it owns or writes

- Owns `receipts`. Writes `auditLog` (`RECEIPT_GENERATED`, `RECEIPT_DELETED`). Does not touch invoices.

## Triggers and side effects

- Only the UI enforces "invoice must be Paid"; `handleGenerateReceipt` does not check.
- Output is a browser print window; no email or docx.

## Before you edit

- `amountReceived` defaults to the invoice amount and can differ; nothing reconciles balances.
- Id mapping: `INV-ADV-0007` -> `REC-ADV-0007`; other ids become `REC-<invoiceId>`.

- A receipt can only be generated for a Paid invoice (`handleGenerateReceipt` in `src/App.jsx`), for the full invoice amount (the field is read-only), with optional notes. Invoices raised from deals, quotations and fabrication carry `partnerId` so receipts inherit it.
