# Invoicing

> Module map. Source: Phase 3 mapping pass (read-only), invoice-split claims spot-checked against the code. Line numbers are approximate.

## Files and folders

- `src/components/crm/Invoices.jsx`: list, filters, detail, edit, delete, mark paid, CSV export, WhatsApp reminder, receipt form.
- `src/utils/invoiceTemplate.js`: printable invoice HTML (`openInvoicePrintWindow`).
- `src/services/firestoreSync.js`: `generateAtomicId`, `generateInvoiceId`, `INVOICES` and `COUNTERS` constants.
- `src/App.jsx`: `handleSaveInvoice`, `handleGenerateReceipt`, `handleMarkInvoicePaid`; snapshot subscription; `<Invoices>` mount.
- Invoice creators outside the folder: `QuotationBuilder.jsx`, `Deals.jsx`, `FabricationWorks.jsx`.
- `firestore.rules` (`counters`, `invoices`); `tests/integration/invoiceNumbering.test.js` (emulator; mirrors the transaction shape).
- `src/constants/emailTemplates.js` has invoice templates; no invoice flow was found that sends them.

## Firestore collections read/written

- Writes: `invoices` (`App.jsx`, `Invoices.jsx`); `counters/INV-ADV` and `counters/INV-FIN` via a transaction.
- Writes to other modules: `receipts` (`createDocumentIfAbsent`), `leads` (`stage`, `invoicePaid`, `referralStatus`), `auditLog` (`INVOICE_CREATED`, `INVOICE_PAID`, `RECEIPT_GENERATED`), and `projects` / deals via the automatic Final-invoice paths.
- Reads: `invoices`, `receipts`, leads (props), `partners` for commission.

## Cloud Functions / triggers

No Cloud Functions. Everything is client-side.

- **75% / 25% split is hardcoded in each creator**, not a shared constant, and not enforced at the data layer:
  - Advance 75%: `QuotationBuilder.jsx` 89-90 (`grandTotal * 0.75`), button needs quotation status `Accepted`.
  - Final 25%, manual: "25% Final Settlement" button, `QuotationBuilder.jsx`.
  - Final 25%, automatic: `Deals.jsx` 335 (`deal.value * 0.25`) when a deal moves to Completed.
  - Final 25%, automatic: `FabricationWorks.jsx` 741 (`value * 0.25`) when a job passes QA. This Final invoice sets no `quotationId`.
  - Both automatic paths reserve the invoice id first and abort the transition if that fails.
  - `Invoices.jsx` only displays "75% Advance" / "25% Final" from `type`; the edit form lets `amount` be changed freely.
- **Numbering:** `INV-ADV-####` / `INV-FIN-####` from an atomic counter. The UI hides the create button once an invoice exists, but nothing at the data layer enforces one Advance and one Final per lead.
- **Links:** `quotationId`; `leadId`, `dealId`, `originalLeadId`, `convertedDealId`, `jobNo`, `linkedJobNo`; `receipts.invoiceId` (receipt id derived from invoice id, one receipt per invoice).
- **On mark-paid** (`handleMarkInvoicePaid`): invoice set to Paid; if Advance and stage is "75% Invoice Submitted" the stage becomes "Received"; when the latest Advance and Final are both paid the lead gets `invoicePaid`, and partner-referral leads get `referralStatus: 'Eligible for Payout'` plus a commission notification.
- Not found: any invoice email (`api/send-email.js` and `mailer.js` are not called from invoice flows). The reminder opens WhatsApp.

## Depends on / called by

QuotationBuilder (`generateInvoiceId`, `onSaveInvoice`), Deals, LeadCardDetails, FabricationWorks, Receipts, Partners (commission), Customers (timeline) and Dashboard (display), audit log service, `PermissionsContext` (`canAccess(..., 'invoices')`), `toast`, `csvExport`. `logisticsEngine.js` and `Logistics.jsx` reference invoices; details not read.

## Summary

Invoices are documents in `invoices` with atomic sequential numbers. An accepted quotation produces a 75% Advance invoice on a manual click; a 25% Final invoice appears either automatically (deal completes, or fabrication passes QA) or via a manual button. `Invoices.jsx` lists, edits, prints, exports and marks paid; a paid invoice can be turned into a receipt.

## Open questions

- Two automatic Final-invoice creators (deal completion, fabrication QA pass) can both fire for the same job; duplicate guarding between them is not established. Tracked in [CROSS_MODULE_TRIGGERS.md](../../01_architecture/CROSS_MODULE_TRIGGERS.md).
- `Invoices.jsx` allows editing `amount` freely, so the 75/25 ratio is a convention, not an invariant.
