# Operations: Fabrication

> Module map. Source: Phase 3 mapping pass (read-only), Final-invoice claim spot-checked against the code. Line numbers are approximate.

## Files and folders

- `src/components/operations/FabricationWorks.jsx`: Kanban board and all job handlers (`STAGES` at ~44).
- `src/components/operations/FabricationCardDetails.jsx`: job detail modal with the cut-list editor.
- `src/utils/cutListEngine.js`: pure functions `calculateCutList`, `mmToFtIn`, `ftToMm`, `STEEL_PROFILES` (no Firestore).
- `src/components/common/FrameBlueprintPreview.jsx`: SVG preview only.
- `src/App.jsx`: lazy import, `projects` state, subscription, render (tab id `projects`, nav label "Fabrication Works"), `handleSaveInvoice`.

## Firestore collections read/written

- `projects` (doc id = job number `PTF-xxxx`): created manually or by lead conversion (`Leads.jsx`); written by `FabricationWorks.jsx` on create, stage moves, rework, QA pass, revision, edit, delete and dispatch flags.
- Other modules: `logistics` (dispatch task), `counters` (`L-DL` via `generateAtomicId`, Final invoice id via `generateInvoiceId`), `invoices` and `auditLog` (via the `onSaveInvoice` prop, `INVOICE_CREATED`).
- Reads: `customers` and `partners` props. Does not read `leads` or deals directly.

## Cloud Functions / triggers

No Cloud Functions. Client-side:

- **Stages:** Pending, Ongoing, Ready For Inspection, Revision, Completed. Forward moves in `handleMoveJob`, back moves in `handleMoveJobBack`; each move stamps `stageEnteredAt`; Revision forward goes to Ready For Inspection and sets `reworkCompletedAt`.
- **Inspection / QA:** moving forward from Ready For Inspection opens a 4-check dialog (squareness, welds, coating, canvasTension). `handlePassQA` needs all four; `handlePassQAInner` sets Completed, `checklist.qaPassed = true` and a `qaCheck` object. Failure goes to `handleConfirmRevision` (Revision, `qaPassed = false`, `defectDetails`). See [operations-inspection.md](operations-inspection.md).
- **At QA pass:** if `value > 0` and `onSaveInvoice` exists, a Final invoice id is reserved first (if that fails the job is not completed), then a **25% Final invoice** is saved (status Unpaid, due in 7 days) carrying leadId / dealId / originalLeadId / convertedDealId. `FabricationWorks.jsx` ~741 (`Number(targetJob.value) * 0.25`). No `quotationId` is set.
- **Deal / lead stage change: not found.** Nothing in this module updates a lead or deal.
- **Dispatch to Logistics:** manual button; creates a Pending Delivery task with `linkedJobNo` and sets `dispatchedToLogistics` / `logisticsTaskId` on the project. Not automatic at Completed.
- **Cut list:** `calculateCutList` runs at job creation and in the details modal (constants: 6096 mm stock length, 3 mm saw kerf, 600 mm max span before a stiffener). Checklist: materialsCut, frameWelded, primerApplied, canvasWrapped, qaPassed. Stock / inventory deduction: not found.
- **Notifications:** toasts only. `handleGenerateUpdate` POSTs to `/api/generate` for an AI WhatsApp draft the user copies manually. No automatic email / SMS / WhatsApp.

## Depends on / called by

`firestoreSync` (`addDocument`, `updateDocument`, `deleteDocument`, `generateInvoiceId`, `generateAtomicId`), `App.jsx` (`handleSaveInvoice`), `utils/validation`, `toast`, `common/ui`, `DeleteModal`. Consumed by Logistics (matches `linkedJobNo` to `jobNo`) and created by `Leads.jsx` conversion. `Deals.jsx` writes logistics jobs directly.

## Summary

The `projects` collection holds fabrication jobs, created manually or by lead conversion and moved through a five-stage Kanban. Ready For Inspection is gated by a 4-point QA dialog. A QA pass completes the job and, for jobs with a value, creates the 25% Final invoice. Logistics dispatch is manual. The cut-list engine is a pure calculator with no stock updates.

## Open questions

- **Duplicate Final invoices (guarded since Phase 7 2.1):** both this module (QA pass) and `Deals.jsx` (deal reaches Completed) create a Final invoice for 25% of the value; each now checks `getExistingFinalInvoice` first. The check runs on client state, so two sessions acting at the same moment could still both create one. See [CROSS_MODULE_TRIGGERS.md](../01_architecture/CROSS_MODULE_TRIGGERS.md).
- Deal stage is not updated when fabrication completes, so deal and project stages advance independently.
