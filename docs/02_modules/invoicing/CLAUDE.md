# Invoicing: module notes for Claude

Full map: [README.md](README.md). Cross-module chains: [CROSS_MODULE_TRIGGERS.md](../../01_architecture/CROSS_MODULE_TRIGGERS.md). Review findings: [FINDINGS.md](FINDINGS.md). There are no Cloud Functions; all automation is client code (`src/App.jsx`, components) or `api/*.js`.

## What it does

Invoices are `invoices` documents numbered `INV-ADV-####` / `INV-FIN-####` from a transactional counter. Advance = 75%, Final = 25% of the value.

## Code

- `src/features/invoicing/Invoices.jsx`, `src/features/invoicing/invoiceTemplate.js`
- `src/services/firestoreSync.js` (`generateInvoiceId`, `generateAtomicId`); `src/App.jsx` handlers
- Test: `tests/integration/invoiceNumbering.test.js`

## Firestore collections it owns or writes

- Owns `invoices`, `counters`. Writes `receipts`, `leads` (`stage`, `invoicePaid`, `referralStatus`), `auditLog`.

## Triggers and side effects

- Marking paid can advance the lead to "Received", set `invoicePaid`, flag partner referrals Eligible for Payout and emit a commission notification.
- No invoice email is sent anywhere.

## Before you edit

- **Duplicate Final invoice hazard:** `Deals.jsx` (completion), `FabricationWorks.jsx` (QA pass), and `QuotationBuilder.jsx` ("25% Final Settlement") can all create duplicate `INV-FIN` invoices for the same job, which doubles the driver's COD collection balance in `logisticsEngine.js` ([FINDINGS.md](FINDINGS.md)).
- The 75 / 25 percentages are hardcoded in `QuotationBuilder.jsx`, `Deals.jsx` and `FabricationWorks.jsx`; the edit form lets `amount` change freely.
- Always reserve the id with `generateInvoiceId` first; both automatic creators abort the stage change if that fails.
- One Advance and one Final per root lead (`originalLeadId || leadId`) is enforced by `invoice_guards/<rootLeadId>_<Advance|Final>` (MON-4): `handleSaveInvoice` writes the invoice and its guard in one `createDocumentIfAbsent` transaction, and a second save for the same lead and type is refused (`ALREADY_EXISTS`, error toast, returns `false`). Guards are create-only in rules, so a cancelled or deleted Advance or Final still blocks a new one for that lead. Other invoice types, and invoices with no lead, are not guarded. Rules not deployed (LIVE-1).
- New invoices carry `leadId` (the original lead) and `dealId` (blank until conversion, which fills it in); older ones may carry the Deal id in `leadId` and no `dealId`. `handleMarkInvoicePaid` updates the record `leadForInvoice` returns (the Deal when `dealId` is set). The detail view's reference prints the whole lineage via `lineageIdsForLeadId` (`src/features/leads/leadLineage.js`), so `Invoices` takes the `leads` prop from `App.jsx`.

- Final invoice guard: deal completion and job QA pass call `getExistingFinalInvoice` (`src/shared/utils/entityUtils.js`) and skip creating a second Final. It runs on client state; the MON-4 guard document refuses the second one when two sessions race.

- COD: `calculateCODFromInvoices` counts only the latest unpaid Final invoice. A paid Advance with no Final returns `finalInvoicePending: true` and the shortfall against the Advance's `totalValue` (or amount / 0.75), and the UI shows it as pending Final invoice creation instead of settled.

- `invoiceTemplate` line totals = qty x unitPrice x (1 - discountPct) x (1 + taxPct) x 0.75 (Advance) or 0.25 (Final). Deal completion passes full-value line items so the scaling lands on 25%.

- Edit policy: `id` and `type` never change; only Admin/Manager may change `amount`. An invoice with a receipt cannot be deleted; use Cancel. Full settlement (`isFullyPaid` in `src/features/invoicing/invoiceSettlement.js`) is Advance and Final both paid, or one paid invoice that bills the whole total, and `invoicePaid` is written to the lead and the deal it converted into.

- Reprints show the invoice as issued. `resolveInvoiceForPrint` (`src/features/invoicing/invoicePrintData.js`) uses the saved invoice's own line items, customer name, company and phone; only a `DRAFT-` preview (no saved invoice yet) reads the live lead and newest quotation. No PDF is stored: every print rebuilds the HTML from the saved document.
- SEC-8 (rules not deployed): an invoice is readable by the referring partner of the lead its `leadId` names (rules `get()` of the lead). Keep `leadId` set on every invoice (`invoiceLineageFields`); a Partner's `App.jsx` invoices listener is one `where('leadId', '==', id)` query per lead it can read.
