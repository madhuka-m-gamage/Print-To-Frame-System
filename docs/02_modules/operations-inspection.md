# Operations: Inspection

> Module map. Source: Phase 3 mapping pass (read-only). Line numbers are approximate.

## Files and folders

**Inspection is not a separate module.** It is a QA gate inside Fabrication. Nothing exists in `api/` or `tests/`, and there is no lead-side site-visit or measurement workflow (`LeadCardDetails.jsx` "Inspector" and the Dashboard "Inspect" buttons only open records).

- `src/components/operations/FabricationWorks.jsx`: stages (`STAGES`: Pending, Ongoing, Ready For Inspection, Revision, Completed); trigger in `handleMoveJob` and the card buttons; QA dialog (`inspectingJob` state and modal: four checks, inspector name, remarks); `handlePassQA` / `handlePassQAInner` (pass); "Fail & Send to Revision" and the defect modal (`defectJob`, `handleConfirmRevision`); Revision to Ready For Inspection stamps `reworkCompletedAt`.
- `src/components/operations/FabricationCardDetails.jsx`: `checklist.qaPassed` toggle and a printed QA sign-off line.
- `src/components/dashboard/Dashboard.jsx`: counts Ready For Inspection jobs.
- `src/constants/emailTemplates.js`: a `fabrication_ready_inspection` template exists but nothing sends it automatically.

## Firestore collections read/written

- `projects` via `updateDocument`: `status`, `stageEnteredAt`, `checklist.qaPassed`, `qaCheck { passed, inspector, inspectedAt, notes, checks { squareness, welds, coating, canvasTension } }`, `defectDetails { category, notes, reportedAt, reporter }`, `reworkCompletedAt`.
- Reads `customers` (for the invoice customer name).

## Cloud Functions / triggers

No Cloud Functions.

- **Pass:** all four checks must be ticked. The job becomes Completed; if `value > 0` a Final invoice id is reserved and a **25% Final invoice** is created (Unpaid, due in 7 days). If id generation fails the job is not completed. See [operations-fabrication.md](operations-fabrication.md) and [invoicing.md](invoicing.md).
- **Fail:** the job moves to Revision, `checklist.qaPassed` is set false, a toast is shown and the card shows a defect badge.
- Dispatch to Logistics is a separate manual button, not triggered by a QA pass.
- **Roles:** no per-role gate on the QA action; the dialog only defaults the inspector name from `currentUser`. `firestore.rules` uses generic `checkPermission('projects', ...)`. The role labelled "Fabrication Master" is `Operations`.
- Audit log: not found (results live only on the `projects` document). Notifications: not found.

## Depends on / called by

`firestoreSync` (`updateDocument`, `addDocument`, `generateInvoiceId`, `generateAtomicId`), `onSaveInvoice` (Invoices flow), `customers` prop, `currentUser`, Logistics (dispatch), `projects` rules, `/api/generate` (unrelated WhatsApp status draft).

## Summary

From Ready For Inspection an operator passes a 4-point checklist or fails the job with a defect category. A pass completes the job and auto-creates the 25% Final invoice; a fail sends it to Revision, and finishing rework returns it to inspection. Results are stored on the `projects` document. There is no role restriction beyond generic project permissions, no audit entry and no notification.

## Open questions

- QA results are not audit-logged, so who passed a job is recorded only in `qaCheck.inspector`, a free-text default from the current user.
