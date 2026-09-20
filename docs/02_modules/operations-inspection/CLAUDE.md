# Operations: Inspection: module notes for Claude

Full map: [../operations-inspection.md](../operations-inspection.md). Cross-module chains: [CROSS_MODULE_TRIGGERS.md](../../01_architecture/CROSS_MODULE_TRIGGERS.md). Review findings: [FINDINGS.md](FINDINGS.md). There are no Cloud Functions; all automation is client code (`src/App.jsx`, components) or `api/*.js`.

## What it does

Inspection is the QA gate of Fabrication, not a separate module: four checks (squareness, welds, coating, canvasTension) or fail with a defect category.

## Code

- Inside `src/components/operations/FabricationWorks.jsx` (QA dialog, `handlePassQA`, `handleConfirmRevision`) and `FabricationCardDetails.jsx`.

## Firestore collections it owns or writes

- Writes `projects` fields `qaCheck`, `defectDetails`, `checklist.qaPassed`, `reworkCompletedAt`.

## Triggers and side effects

- Pass creates the 25% Final invoice; fail sets Revision. No audit log, no notification, no role gate beyond `projects` permissions.

## Before you edit

- See [operations-fabrication.md](../operations-fabrication.md); change both docs together.
- There is no lead-side site-inspection workflow.

- `checklist.qaPassed` is set only by the QA Inspection Gate; every other save goes through `checklistWithGuardedQa`. The inspector is always the signed-in user. Defects are appended to `defectHistory`; `defectDetails` is the active one. QA pass, defect flag and rework completion are audit logged. A failed Final invoice save aborts Completed.
