# Leads: module notes for Claude

Full map: [../leads.md](../leads.md). Cross-module chains: [CROSS_MODULE_TRIGGERS.md](../../01_architecture/CROSS_MODULE_TRIGGERS.md). Review findings: [FINDINGS.md](FINDINGS.md). There are no Cloud Functions; all automation is client code (`src/App.jsx`, components) or `api/*.js`.

## What it does

Leads are `leads` documents worked as a Kanban / table. Users record or upload a call for Gemini to extract scope and contact details, price the job, draft a quotation, and convert a "Received" lead into a Deal, customer and fabrication project.

## Code

- `src/components/crm/Leads.jsx`, `LeadCardDetails.jsx` (shared with Deals), `QuotationBuilder.jsx`
- `src/services/gemini.js`, `pricingEngine.js`; `src/utils/audioProcessing.js`; `api/generate.js`

## Firestore collections it owns or writes

- Owns `leads`. Writes `customers`, `projects`, `logistics`, `quotations`, `invoices`, `receipts`, `auditLog` via handlers.

## Triggers and side effects

- Call analysis: `extractCallScope` -> `/api/generate` (token + approved-user checked). Fills form state only after the user clicks apply; nothing persisted until save.
- Conversion (`handleConvertConfirm`): several separate writes, not one transaction; see [deals.md](../deals.md).

## Before you edit

- A Deal is a `leads` document (`isDeal: true`); `LeadCardDetails` serves both.
- Leads with `source == 'Referral'` can be created anonymously by rules (public referral form).
- Keep client `canAccess('leads')` and the `leads` rules block in sync.
