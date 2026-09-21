# Leads

> Module map: what it does, what it touches, what it depends on. Source: Phase 3 mapping pass (read-only), key claims spot-checked against the code. Line numbers are approximate and drift as code changes.

## Files and folders

- `src/components/crm/Leads.jsx`: Kanban and table UI, stage moves, add / convert / delete, Deal and Project creation (`handleConvertConfirm` ~476-606).
- `src/components/crm/LeadCardDetails.jsx`: lead detail modal (also used for Deals via an `isDeal` prop). Holds the call-recording UI, pricing calculator, invoice and receipt panels, and the logistics trigger.
- `src/components/crm/QuotationBuilder.jsx`: embedded in the lead modal; see [cost-calculator-quotation.md](../cost-calculator-quotation/README.md).
- `src/services/gemini.js`: `extractCallScope`, `generateStructuredQuotation`, `generateAdvanceInvoice`.
- `src/services/pricingEngine.js`: `calculateCost`, `determineTier`.
- `src/utils/audioProcessing.js`: `downsampleAudio`.
- `api/generate.js`: Vercel proxy for Gemini.
- `src/App.jsx`: lazy-loads Leads, subscribes to `leads`, and defines `handleSaveInvoice`, `handleMarkInvoicePaid`, `handleGenerateReceipt`.
- `ContactSyncModal.jsx` and `src/services/contactsService.js` are **not** part of Leads (only `Customers.jsx` imports them).

## Firestore collections read/written

- `leads` (owned). Written from `Leads.jsx` (create, stage moves, convert, delete) and `App.jsx` (payment updates).
- Writes to other modules' collections: `customers` (auto-create or increment `orders` on conversion), `projects` (fabrication job on conversion), `logistics` (delivery job), `quotations` (via QuotationBuilder), `invoices` and `receipts` (via `App.jsx` handlers), `auditLog` (`LEAD_DELETED`, invoice and receipt events).
- Reads arrive as props from `App.jsx` (customers, partners, invoices, receipts, quotations).
- A **Deal is a `leads` document** with `isDeal: true`; see [deals.md](../deals/README.md).

## Cloud Functions / triggers

No Cloud Functions exist (see [GCP_INVENTORY.md](../../01_architecture/GCP_INVENTORY.md)). Automatic behaviour:

- **Call recording to AI auto-fill (found, client-side):** the user records with `MediaRecorder` or uploads an audio file in `LeadCardDetails.jsx`. Audio is downsampled, base64-encoded and sent through `extractCallScope` (`src/services/gemini.js`) to `/api/generate` (`api/generate.js`), which verifies the Firebase ID token and the approved `users/{email}` doc, then calls Gemini. Gemini returns JSON (scope, client name / contact / email, delivery location, frame height / width). Fields are applied to the form only when the user clicks apply (`applyAudioAnalysisToScope`); nothing is persisted until the user saves the lead. The audio and analysis are not stored in Storage, Drive or Firestore.
- **Conversion** (lead in stage "Received" is moved forward or Convert is clicked): creates a Deal, a customer record and a Pending fabrication project. See [deals.md](../deals/README.md).
- **Payment side effects:** marking an invoice paid can advance the lead stage and flag partner-referral commission (`App.jsx` `handleMarkInvoicePaid`).
- No email is sent from Leads code.

## Depends on / called by

Customers, Deals, Projects/Fabrication, Logistics, Quotations, Invoices, Receipts, Partners (commission), `PermissionsContext` (`canAccess 'leads'`), `shared/ui`, `firestoreSync`, `auditLog`, `GoogleDrivePickerModal`.

## Summary

Leads are `leads` Firestore documents, listened to in real time by `App.jsx` and worked as a Kanban board or table. A user creates a lead (Manual or Referral), edits it in `LeadCardDetails`, optionally records or uploads a call for Gemini to extract scope and contact details, prices it with the pricing engine, drafts a quotation, and generates the 75% Advance invoice. Marking invoices paid moves the lead along. Converting a "Received" lead creates a Deal, a customer profile and a fabrication project.

## Open questions

- The `partner_payouts` write path was not traced in this pass (see [partners.md](../partners/README.md)).
- Whether `emitNotification` (`src/shared/utils/events.js`) persists notifications is covered in [notifications.md](../notifications/README.md).
