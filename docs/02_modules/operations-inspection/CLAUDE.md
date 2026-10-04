# Operations: Inspection: module notes for Claude

Full map: [README.md](README.md). Cross-module chains: [CROSS_MODULE_TRIGGERS.md](../../01_architecture/CROSS_MODULE_TRIGGERS.md). Review findings: [FINDINGS.md](FINDINGS.md). There are no Cloud Functions; all automation is client code (`src/App.jsx`, components) or `api/*.js`.

## What it does

Inspection is the QA gate of Fabrication, not a separate module: four checks (squareness, welds, coating, canvasTension) or fail with a defect category.

## Code

- Inside `src/features/fabrication/FabricationWorks.jsx` (QA dialog, `handlePassQA`, `handleConfirmRevision`) and `FabricationCardDetails.jsx`.

## Firestore collections it owns or writes

- Writes `projects` fields `qaCheck`, `defectDetails`, `checklist.qaPassed`, `reworkCompletedAt`.

## Triggers and side effects

- Pass creates the 25% Final invoice; fail sets Revision. No audit log, no notification, no role gate beyond `projects` permissions.

## Before you edit

- See [operations-fabrication.md](../operations-fabrication/README.md); change both docs together.
- There is no lead-side site-inspection workflow.

- `checklist.qaPassed` is set only by the QA Inspection Gate; every other save goes through `checklistWithGuardedQa`. The inspector is always the signed-in user. Defects are appended to `defectHistory`; `defectDetails` is the active one. QA pass, defect flag and rework completion are audit logged. A failed Final invoice save aborts Completed.
- QA pass is refused for a `Cancelled` project (`cancelledProjectBlock`, DEC-4), so it never creates a Final invoice.
- Sending a job to Revision writes a `revision` notification to the linked deal's `salesOwnerEmail` (stamped at lead conversion; none means a warning toast and no alert). Completed cards have "Email client: QA passed", which sends `fabrication_ready_inspection` through `/api/send-email` to the email stored on the job's customer record (FEA-5). `resolveQaRecipient` (`src/features/fabrication/qaRecipient.js`) finds that record by NIC, then `customerId` (email case-insensitively, or NIC), then `leadId`, then phone; no record means a "register the customer first" toast and no preview, and the deal email is never used (FEA-20).
