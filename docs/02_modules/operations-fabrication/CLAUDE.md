# Operations: Fabrication: module notes for Claude

Full map: [../operations-fabrication.md](../operations-fabrication.md). Cross-module chains: [CROSS_MODULE_TRIGGERS.md](../../01_architecture/CROSS_MODULE_TRIGGERS.md). Review findings: [FINDINGS.md](FINDINGS.md). There are no Cloud Functions; all automation is client code (`src/App.jsx`, components) or `api/*.js`.

## What it does

Fabrication Kanban over `projects` (Pending, Ongoing, Ready For Inspection, Revision, Completed) with a cut-list calculator and a 4-point QA gate.

## Code

- `src/components/operations/FabricationWorks.jsx`, `FabricationCardDetails.jsx`, `src/utils/cutListEngine.js`, `src/components/common/FrameBlueprintPreview.jsx`

## Firestore collections it owns or writes

- Owns `projects` (id = job number `PTF-xxxx`). Writes `logistics` (dispatch), `counters`, `invoices` / `auditLog` via `onSaveInvoice`.

## Triggers and side effects

- QA pass: reserves a Final invoice id, creates a 25% Final invoice, marks Completed. No deal / lead update.
- Dispatch to Logistics is a manual button.

## Before you edit

- **Possible duplicate Final invoice** with `Deals.jsx` completion; no guard between them.
- Projects are created by lead conversion in `Leads.jsx` as well as manually.
- No stock / inventory deduction exists.
