# Deals

> Module map. Source: Phase 3 mapping pass (read-only), key claims spot-checked against the code. Line numbers are approximate.

## Files and folders

- `src/components/crm/Deals.jsx`: Kanban and table UI. `DEALS_STAGES` = Waiting, Fabricating, Ready To Load, Hand Over, Completed.
- `src/components/crm/Leads.jsx`: `handleConvertConfirm` (~476-606) performs Lead-to-Deal conversion; `ConvertDealModal`.
- `src/components/crm/LeadCardDetails.jsx`: shared Lead/Deal detail modal (`isDeal` prop); embeds `QuotationBuilder`, shows advance / final invoice cards, mark-paid and receipt buttons, and a logistics card.
- `src/App.jsx`: mounts Deals under tab `pipeline`; holds `handleSaveInvoice`, `handleGenerateReceipt`, `handleMarkInvoicePaid`.
- `src/utils/entityUtils.js` (`matchesEntity`, lead / deal id lineage), `src/utils/logisticsEngine.js`, `src/services/firestoreSync.js` (`generateInvoiceId`).
- `api/`: no deal references.

## Firestore collections read/written

- **No separate collection.** A deal is a `leads` document with `isDeal: true` and a deal `stage`. Deals.jsx writes stage moves, saves and deletes; Leads.jsx creates the deal document and marks the original lead Completed with `convertedDealId`.
- Writes to other modules' collections: `invoices` (Final invoice on completion), `partners` (`pending`, `totalSqFt` commission accrual), `logistics` (manual delivery job), `customers` and `projects` (on conversion), `receipts` / `invoices` via the `App.jsx` payment handlers.
- Reads (props from `App.jsx`): quotations, invoices, receipts, partners, customers, logistics jobs.

## Cloud Functions / triggers

No Cloud Functions. All client-side:

- **Lead to Deal** (Leads.jsx): new deal `D-xxxxxx` in stage Waiting with a `jobNo` (`PTF-xxxx`), `originalLeadId` and `linkedJobNo`; original lead marked Completed and locked; customer created or incremented; Pending fabrication project created sharing the `jobNo`.
- **Stage moves (not to Completed):** write only `stage` and `stageEnteredAt`. No project status sync was found in Deals.jsx.
- **Hand Over to Completed** ("won", `Deals.jsx`): reserves a Final invoice id (aborts the move if that fails) unless one already exists; creates a **Final invoice for 25%** of the deal value (`advancePaid` recorded as 75%), linked to an Accepted quotation via `matchesEntity`, copying its line items; credits the partner (`sqFt x commissionRate`, default 53.5) to `pending` once, when `deal.agentId` matches a partner. Moving forward also syncs the linked project's status (forward only).
- **Manual "Create delivery job"** on Ready To Load / Hand Over cards writes a `logistics` job `L-DL-...`. Not automatic.
- **Invoice marked paid** (`App.jsx` `handleMarkInvoicePaid`): may set stage to Received, set `invoicePaid`, set `referralStatus: 'Eligible for Payout'` and emit a commission notification.
- Not found: automatic project status sync on stage change, automatic logistics creation, deal-stage trigger into the quotation builder.

## Depends on / called by

Leads, LeadCardDetails, QuotationBuilder, Invoices / Receipts handlers in `App.jsx`, Partners, Customers, Fabrication / Projects, Logistics; shared `entityUtils`, `firestoreSync`, `toast`, `csvExport`, `common/ui`.

## Summary

Deals is the post-sale Kanban view of `leads` documents flagged `isDeal`. Converting a "Received" lead clones it into a Waiting deal, completes the original lead, updates the customer and creates a Pending fabrication project sharing the `jobNo`. Users move deals across five stages. Completing a deal generates the 25% Final invoice and credits the partner's pending commission.

## Open questions

- A second automatic Final-invoice creator exists in `FabricationWorks.jsx` (see [invoicing.md](invoicing.md)); how the two interact is to be resolved in [CROSS_MODULE_TRIGGERS.md](../01_architecture/CROSS_MODULE_TRIGGERS.md).
