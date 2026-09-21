# Operations: Fabrication: module notes for Claude

Full map: [README.md](README.md). Cross-module chains: [CROSS_MODULE_TRIGGERS.md](../../01_architecture/CROSS_MODULE_TRIGGERS.md). Review findings: [FINDINGS.md](FINDINGS.md). There are no Cloud Functions; all automation is client code (`src/App.jsx`, components) or `api/*.js`.

## What it does

Fabrication Kanban over `projects` (Pending, Ongoing, Ready For Inspection, Revision, Completed) with a cut-list calculator and a 4-point QA gate.

## Code

- `src/features/fabrication/FabricationWorks.jsx`, `FabricationCardDetails.jsx`, `src/features/fabrication/cutListEngine.js`, `src/features/fabrication/FrameBlueprintPreview.jsx`

## Firestore collections it owns or writes

- Owns `projects` (id = job number `PTF-xxxx`). Writes `logistics` (dispatch), `counters`, `invoices` / `auditLog` via `onSaveInvoice`.

## Triggers and side effects

- QA pass: reserves a Final invoice id, creates a 25% Final invoice, marks Completed. No deal / lead update.
- Dispatch to Logistics is a manual button.

## Before you edit

- **Duplicate Final invoice** with `Deals.jsx` completion is guarded by `getExistingFinalInvoice` on client state (two simultaneous sessions can still race).
- Projects are created by lead conversion in `Leads.jsx` as well as manually.
- No stock / inventory deduction exists.

- Final invoice guard: deal completion and job QA pass call `getExistingFinalInvoice` (`src/shared/utils/entityUtils.js`) and skip creating a second Final. It runs on client state, so two sessions acting at the same moment can still both create one.

- Completed is terminal: no backward move from it, and bulk change cannot set Completed. Deal completion sets `commissionAccrued: true` and skips commission accrual when it is already set.

- Stock bars: `packStockBars` in `src/features/fabrication/cutListEngine.js` packs pieces first-fit-decreasing, one kerf per cut.

- A job with only `totalSqFt` gets a 3:2 default frame of that full area (`defaultFrameDimensions`). `calculateCutList` returns `vRibCount` / `hRibCount`, which the blueprint draws. New projects carry `customerId` (email, else NIC). Job deletion is Admin only (case-insensitive) and audit logged as `PROJECT_DELETED`.
- Frame width and height come from the lead's measured size (`dimensionsFromLead`) and are read-only here when `dimensionsLocked`. A manual job is linked to a deal (`dealId`, billed through the deal, no value) or non-billable (`billable: false`); never enter a price on a fabrication job. Blueprints upload to Storage (`blueprints/<jobNo>/`), with an inline fallback under 500KB.
