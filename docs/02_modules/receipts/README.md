# Receipts

> Module map. Source: Phase 3 mapping pass (read-only). Line numbers are approximate.

## Files and folders

- `src/features/invoicing/Receipts.jsx`: list, detail, archive; search and filter, CSV export, print, delete.
- `src/features/invoicing/receiptTemplate.js`: `buildReceiptHtml()`, `amountToWords()`; print window opened via `openInvoicePrintWindow` in `invoiceTemplate.js`.
- `src/App.jsx`: `receipts` state and subscription, `handleGenerateReceipt`, lazy import and tab render.
- `src/services/firestoreSync.js`: `COLLECTIONS.RECEIPTS`, `createDocumentIfAbsent`, `deriveReceiptId`.
- Generation UI elsewhere: `Invoices.jsx` (receipt form), `LeadCardDetails.jsx` (per-lead advance and final receipts, reached from `Leads.jsx` and `Deals.jsx`).
- Access control: `firestore.rules` (receipts block), `PermissionsContext.jsx` (`receipts` permission), `PermissionsManager.jsx`.

## Firestore collections read/written

- `receipts`: create via `createDocumentIfAbsent`, delete via `deleteDocument`, real-time read in `App.jsx`.
- `auditLog`: `RECEIPT_GENERATED` (`App.jsx`), `RECEIPT_DELETED` (`Receipts.jsx`).
- Receipt creation writes to **no** other collection; invoice status is changed only by `handleMarkInvoicePaid`.

## Cloud Functions / triggers

No Cloud Functions. Client-side only:

- **Invoice link:** stores `invoiceId`, `type` (copied from the invoice: Advance or Final), `leadId`, `dealId`, `originalLeadId`, `convertedDealId`, `partnerId`, customer and company.
- **Precondition:** the Generate Receipt button shows only when the invoice status is `Paid` (`Invoices.jsx`). `handleGenerateReceipt` itself does not check the status.
- **Numbering:** `deriveReceiptId` maps `INV-ADV-0007` to `REC-ADV-0007` (same for `INV-FIN-*`); any other invoice id gets `REC-<invoiceId>`. No counter.
- **Duplicate guard:** in-memory check of `receipts`, then a Firestore transaction that throws `ALREADY_EXISTS`.
- `amountReceived` defaults to the invoice amount.
- Output is a browser print window (`window.print()`).
- Not found: invoice paid / balance update when a receipt is created, receipt email, docx.

## Depends on / called by

Invoices (source and UI host; imports `buildReceiptHtml`), Leads and Deals (`LeadCardDetails`), `auditLog`, `toast`, `shared/ui`, `DeleteModal`, `csvExport`, `PermissionsContext`. `LogisticsCardDetails.jsx` imports only the `Receipt` icon; no data link.

## Summary

Receipts are proof-of-payment records created from a paid invoice through a form (amount, method, date). `App.jsx` builds the receipt with an id derived from the invoice id and writes it in a transaction that refuses duplicates, then logs the action. The Receipts tab lists them live with search, filter, CSV export, print (with amount in words) and delete. Invoice payment status, lead progression and partner commission are handled by marking the invoice paid, not by creating a receipt.

## Open questions

- No balance or partial-payment tracking was found: the receipt amount can differ from the invoice amount, but nothing reconciles it.
