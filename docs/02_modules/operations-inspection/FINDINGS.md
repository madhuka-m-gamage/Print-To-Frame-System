# Operations: Inspection Module Review & Correctness Audit Findings

> **Scope**: Comprehensive correctness audit of `docs/02_modules/operations-inspection/CLAUDE.md`, `docs/02_modules/operations-inspection.md`, and all cross-module triggers touching Inspection documented in `docs/01_architecture/CROSS_MODULE_TRIGGERS.md`.  
> **Branch / Worktree**: `review-operations-inspection` (`.worktrees/review-operations-inspection`)  
> **Status**: Review & Audit Completed — All Decision Points Accepted (Ready for Implementation).

---

## 1. Executive Summary

A deep-trace audit was conducted across the Operations: Inspection module implementation and its integration surfaces:
- **Module Docs**: `docs/02_modules/operations-inspection.md`, `docs/02_modules/operations-inspection/CLAUDE.md`, `docs/01_architecture/CROSS_MODULE_TRIGGERS.md`
- **UI Components**: `src/components/operations/FabricationWorks.jsx` (QA Inspection dialog, Defect modal, Kanban board), `src/components/operations/FabricationCardDetails.jsx` (Milestone checklist, A4 ticket printout)
- **CRM Integration**: `src/components/crm/Deals.jsx` (Deal completion invoice trigger), `src/components/crm/Leads.jsx` (Project creation on deal conversion)
- **Handlers & Services**: `src/App.jsx` (`handleSaveInvoice`, `auditLog`), `src/services/firestoreSync.js` (`generateInvoiceId`, `generateAtomicId`)
- **System Integration & Security**: `firestore.rules`, `src/context/PermissionsContext.jsx`, `src/constants/roles.js`, `api/generate.js`

While the core concept documented in `operations-inspection.md` (that Inspection is not an independent module, but rather a QA gate inside Fabrication) is validated, **several critical workflow breaks, severe RBAC permission blocks, duplicate invoice generation risks, and data integrity gaps** were discovered.

### Key Critical Findings:
1. **Default RBAC Permission Block**: The `Operations` role ("Fabrication Master") has `invoices: none()` in default permissions (`PermissionsContext.jsx`). When an Operations user passes QA, `handleSaveInvoice` fails with Firestore **Permission Denied** (`firestore.rules`). However, because `onSaveInvoice` is fire-and-forget, the project is still marked "Completed" in Firestore without its Final invoice ever being created.
2. **Double Final Invoice Conflict (Trigger 3 vs 4)**: Neither `Deals.jsx` (Trigger 3) nor `FabricationWorks.jsx` (Trigger 4) checks whether a Final invoice already exists before generating a new `INV-FIN-####` invoice. If a job passes QA and the linked Deal is later marked Completed (or vice-versa), two separate 25% Final invoices are generated for the same contract.
3. **Re-Inspection Duplicate Invoice Generation**: Stepping a "Completed" job back to "Ready For Inspection" and passing QA again generates a duplicate `INV-FIN-####` invoice.
4. **Micro-Milestone QA Bypass**: In `FabricationCardDetails.jsx`, the "5. Quality Control Sign-Off" toggle directly sets `checklist.qaPassed = true` upon save, completely bypassing the 4-point QA gate, diagonal calculation, inspector validation, and invoice generation.
5. **Customer Phone/Company Data Dropped on Invoices**: `FabricationWorks.jsx` attempts to read `targetJob.phone` and `cust?.businessName`, but jobs created from Lead conversion store `customerPhone` and `company`. If NIC lookup fails, phone and company on the generated invoice default to empty strings.
6. **Missing Bearer Token on WhatsApp Generator**: `handleGenerateUpdate` calls `/api/generate` without an `Authorization: Bearer <token>` header, causing production requests to fail with HTTP 401.
7. **Complete Absence of Audit Logs & Notifications**: Passing QA, defect tagging, and rework completion produce zero entries in `COLLECTIONS.AUDIT_LOG`. The template `fabrication_ready_inspection` in `emailTemplates.js` is never called.

---

## 2. Review of Module Documentation

### 2.1 `docs/02_modules/operations-inspection/CLAUDE.md`

| Section / Claim | Code Status | Details / Discrepancy |
|---|---|---|
| **What it does** ("four checks (squareness, welds, coating, canvasTension) or fail with a defect category") | **Accurate** | Confirmed: `qaForm` enforces all 4 booleans (`handlePassQA:L664`), and defect modal provides 6 defect categories. |
| **Code** ("Inside `FabricationWorks.jsx`... and `FabricationCardDetails.jsx`") | **Accurate** | Confirmed. |
| **Firestore collections it owns or writes** (`projects` fields `qaCheck`, `defectDetails`, `checklist.qaPassed`, `reworkCompletedAt`) | **Incomplete** | Omits writes to `counters` (`counters/INV-FIN` via `generateInvoiceId`) and indirect writes to `invoices` and `auditLog` (via `onSaveInvoice` -> `handleSaveInvoice`). |
| **Triggers and side effects** ("Pass creates the 25% Final invoice; fail sets Revision. No audit log, no notification, no role gate...") | **Partially Accurate** | While there is no UI role restriction on the dialog, Firestore rules block `Operations` users from writing invoices under default RBAC (`invoices: none()`). |
| **Before you edit** ("There is no lead-side site-inspection workflow") | **Accurate** | Confirmed: `LeadCardDetails` and `Dashboard` "Inspect" buttons only open detail records. |

### 2.2 `docs/02_modules/operations-inspection.md`

| Section / Claim | Code Status | Details / Discrepancy |
|---|---|---|
| **Files and folders** ("`Dashboard.jsx`: counts Ready For Inspection jobs.") | **Discrepancy** | `Dashboard.jsx:L139` does **not** have a dedicated counter for Ready For Inspection jobs. It merely includes them in `opsActionQueue` alongside `Pending` and `Ongoing`, sliced to the top 5. Furthermore, `Revision` jobs are completely omitted from `opsActionQueue`. |
| **Files and folders** ("`emailTemplates.js`: a `fabrication_ready_inspection` template exists but nothing sends it automatically.") | **Accurate** | Confirmed: Template exists at `emailTemplates.js:L182`, but is dead code (no call sites exist). |
| **Pass trigger** ("If id generation fails the job is not completed.") | **Accurate** | Confirmed: `handlePassQAInner` wraps `generateInvoiceId('Final')` in a try/catch and aborts before state update. |
| **Fail trigger** ("the job moves to Revision, `checklist.qaPassed` is set false, a toast is shown and the card shows a defect badge.") | **Accurate** | Confirmed in `handleConfirmRevision:L768-L799` and `FabricationWorks.jsx:L194-L201`. |
| **Dispatch to Logistics** ("Dispatch to Logistics is a separate manual button, not triggered by a QA pass.") | **Accurate** | Confirmed: Rendered conditionally on `stage === "Completed" && !job.dispatchedToLogistics` (`FabricationWorks.jsx:L251`). |
| **Open questions** ("QA results are not audit-logged, so who passed a job is recorded only in `qaCheck.inspector`...") | **Accurate** | Confirmed: Free-text input field defaults to `currentUser?.name || "Lead Inspector"`. |

---

## 3. Cross-Module Triggers Audit (`CROSS_MODULE_TRIGGERS.md`)

### Trigger 4: Fabrication Passes QA

* **Trigger**: Operator checks all 4 points in QA dialog and clicks "Approve & Complete" (`FabricationWorks.jsx:L657-L765`).
* **Execution Chain**: `handlePassQA` $\rightarrow$ `handlePassQAInner` $\rightarrow$ `generateInvoiceId('Final')` $\rightarrow$ `onSaveInvoice` (`App.jsx:L339`) $\rightarrow$ `updateDocument(COLLECTIONS.PROJECTS)`.
* **Writes Performed**:
  1. Atomic counter increment: `counters/INV-FIN` (via Firestore transaction in `generateAtomicId`).
  2. Invoice creation: `invoices/{INV-FIN-####}` (via `handleSaveInvoice`).
  3. Audit log creation: `auditLog/{logId}` (`INVOICE_CREATED` via `handleSaveInvoice`).
  4. Project update: `projects/{jobNo}` with `status: "Completed"`, `qaCheck: { ... }`, `checklist.qaPassed: true`.

#### Critical Findings in Trigger 4:

1. **Default Permissions Failure for `Operations` Role (Silent Drop of Final Invoice)**:
   - In `PermissionsContext.jsx:L40-L45`, the default permissions for `Operations` (the Fabrication Master) are:
     ```javascript
     Operations: {
       ...
       invoices: none(),
       projects: ops(),
       ...
     }
     ```
   - In `firestore.rules:L150-L152`:
     ```firestore
     match /invoices/{invoiceId} {
       allow create, update: if checkPermission('invoices', 'create') || checkPermission('invoices', 'edit') || checkPermission('invoices', 'write');
     }
     ```
   - When a user with the `Operations` role passes QA on a billable job:
     1. `generateInvoiceId('Final')` succeeds (because `match /counters/{counterId}` allows `isAuthenticated()`).
     2. `onSaveInvoice` invokes `handleSaveInvoice` in `App.jsx`.
     3. `handleSaveInvoice` attempts `addDocument(COLLECTIONS.INVOICES, cleanInvoice, docId)`.
     4. Firestore rejects the write with **Permission Denied** (`checkPermission('invoices', 'create')` returns `false`).
     5. `handleSaveInvoice` catches the error and toasts: `"Failed to save invoice to database: Missing or insufficient permissions."`.
     6. However, `onSaveInvoice` in `FabricationWorks.jsx:L721` is **not awaited**, and `FabricationWorks.jsx` has no error boundary on invoice creation.
     7. `FabricationWorks.jsx` proceeds to run `updateDocument(COLLECTIONS.PROJECTS, ...)`, which **succeeds** because `Operations` has `projects: ops()`.
   - **Consequence**: The job is permanently marked "Completed" in Firestore, but the 25% Final invoice was never created. Because the job is now in "Completed", the inspection modal cannot be reopened, permanently stranding the remaining 25% receivable.

2. **Trigger 3 vs Trigger 4 Conflict (Double Final Invoice Generation)**:
   - `CROSS_MODULE_TRIGGERS.md:L74` previously identified this theoretical risk; codebase audit confirms it is an **active bug in production code**.
   - `Deals.jsx:L285-L360` (Trigger 3) listens for Deal transitions to `"Completed"`. When triggered:
     - It calls `generateInvoiceId('Final')`.
     - It calls `onSaveInvoice({ ... type: 'Final', amount: deal.value * 0.25 })`.
     - It **never queries or checks `invoices`** to verify if an invoice for this deal/job already exists.
   - `FabricationWorks.jsx:L676-L748` (Trigger 4) listens for QA pass in Fabrication:
     - It calls `generateInvoiceId('Final')`.
     - It calls `onSaveInvoice({ ... type: 'Final', amount: targetJob.value * 0.25 })`.
     - `FabricationWorks.jsx` **does not even receive `invoices` as a prop** (`App.jsx:L1353-L1361`).
   - If a deal is moved to "Completed" after fabrication QA has passed, **two distinct Final invoices (`INV-FIN-0001` and `INV-FIN-0002`) are created in Firestore** for the same contract. Both appear on the client's statement and aging reports.

3. **Re-Inspection Duplicate Invoice Vulnerability**:
   - In `FabricationWorks.jsx:L641`, `handleMoveJobBack` allows moving a job from `"Completed"` back to `"Ready For Inspection"`.
   - If QA is approved again, `handlePassQAInner` blindly generates another sequential `INV-FIN-####` invoice.
   - There is no check on `targetJob.finalInvoiceGenerated` or verification that an invoice was already issued.

4. **Missing Quotation Link and Line Items**:
   - When `Deals.jsx` generates a Final invoice, it links `quotationId` via `matchesEntity(q, deal)` and copies `lineItems` from the accepted quotation.
   - `FabricationWorks.jsx` does not receive `quotations` as a prop.
   - The invoice it generates has `quotationId: undefined` and `lineItems: undefined`.
   - While `buildInvoiceHtml` (`invoiceTemplate.js:L244`) contains a fallback that renders a generic single line item from `aiDraft`, the printed invoice lacks genuine line items, tax breakdowns, or itemized engineering specs.

5. **Customer Phone and Company Metadata Desync**:
   - In `Leads.jsx:L574-L592`, when a deal converts, the job is initialized with:
     ```javascript
     customerName: convertedLead.name || "",
     customerPhone: convertedLead.phone || "",
     company: convertedLead.company || "",
     clientNIC: convertedLead.nic || `AUTO-${Math.floor(100000 + Math.random() * 900000)}`,
     ```
   - In `FabricationWorks.jsx:L718-L739`, `handlePassQAInner` attempts to populate invoice details:
     ```javascript
     const cust = customers?.find(c => c.nic === (targetJob.clientNIC || targetJob.customerNic));
     const custName = cust?.name || cust?.businessName || targetJob.customerName || "Direct Customer";
     ...
     company: cust?.businessName || "",
     phone: targetJob.phone || cust?.phone || "",
     ```
   - **Flaw**: If `targetJob.clientNIC` was randomly generated (`AUTO-######`) during lead conversion without matching a saved customer record, `cust` is `undefined`.
   - `FabricationWorks.jsx` checks `targetJob.phone` (which is `undefined`, because `Leads.jsx` stamped `customerPhone`) and checks `cust?.businessName` (ignoring `targetJob.company`).
   - Consequently, the created invoice receives `phone: ""` and `company: ""`, losing valuable client contact info on the official billing record.

---

## 4. Defect Tagging & Revision Workflow Verification

### 4.1 Flow Tracing
1. **Initiation**:
   - From QA modal: Clicking "Fail & Send to Revision" (`FabricationWorks.jsx:L1160`) switches the active modal from `inspectingJob` to `defectJob`, pre-populating category as `"Warped / Out of Square"`.
   - From Kanban card: Clicking `AlertTriangle` button on cards in `"Ongoing"` or `"Ready For Inspection"` (`L279`).
2. **Defect Form**:
   - Category selection from 6 predefined options (`Warped / Out of Square`, `Dimensional Mismatch`, `Weld Defect / Porosity`, `Primer / Paint Flaw`, `Canvas Sag / Creasing`, `Material Damage`).
   - Free-text rework instructions (`notes`).
   - Free-text reporter field defaulting to `currentUser?.name || "Workshop QA"`.
3. **Execution (`handleConfirmRevision`)**:
   - Optimistically updates `projects` state:
     - `status: "Revision"`
     - `stageEnteredAt: now`
     - `checklist.qaPassed: false`
     - `defectDetails: { category, notes, reportedAt: now, reporter }`
   - Persists to Firestore via `updateDocument(COLLECTIONS.PROJECTS)`.
4. **Rework Progression**:
   - Card in "Revision" displays a rose badge with defect category.
   - Clicking forward on a "Revision" card (`handleMoveJob:L590-L607`) sets:
     - `status: "Ready For Inspection"`
     - `stageEnteredAt: now`
     - `reworkCompletedAt: now`
   - Shows toast: `"Job {jobNo} rework completed, ready for QA re-inspection."`.

### 4.2 Defect Flow Disconnects & Architectural Flaws

1. **Defect History Overwrite (Destructive State)**:
   - `defectDetails` is an object, not an array.
   - If a job fails inspection more than once (e.g. initial weld defect reworked, but failed second inspection for canvas tension), the second defect **completely overwrites the first defect's details and timestamps**.
   - No historical record or audit log of defect frequency or shop floor rework counts is maintained.
2. **Defect Details Not Cleared on QA Pass**:
   - When a reworked job subsequently passes QA in `handlePassQAInner`, the project's `status` changes to `"Completed"` and `qaCheck` is populated, but `defectDetails` is **never cleared or archived**.
   - The completed project document in Firestore permanently retains `defectDetails`, skewing data analytics and leaving active defect instructions on a closed work order.
3. **No CRM / Deals Stage Synchronization**:
   - When a job is sent to Revision, the linked Deal in CRM (`leads` collection) remains in `"Fabricating"` stage.
   - Sales reps and project managers have zero visibility in the CRM that the job failed inspection, is undergoing rework, or may miss client delivery deadlines.
4. **Direct Revision from "Ongoing" Bypasses Workflow**:
   - Allowing a job to be sent to "Revision" directly from "Ongoing" (`FabricationWorks.jsx:L279`) allows operators to skip "Ready For Inspection".
   - However, when rework is completed, `handleMoveJob` always advances the job to `"Ready For Inspection"`, even if the job had not completed earlier milestones (such as primer application or canvas stretching).

---

## 5. Micro-Milestone Bypass in `FabricationCardDetails.jsx`

* **Location**: `src/components/operations/FabricationCardDetails.jsx:L747-L791`
* **Vulnerability Analysis**:
  - The drawer component displays "Shop-Floor Fabrication Milestones" (5 steps):
    1. `materialsCut`
    2. `frameWelded`
    3. `primerApplied`
    4. `canvasWrapped`
    5. `qaPassed` ("5. Quality Control Sign-Off - Ready for client pickup / logistics")
  - `handleToggleMilestone('qaPassed')` allows any user opening this card to toggle `checklist.qaPassed` to `true`.
  - When the operator clicks "Save" (`handleSave:L174`):
    - The updated `checklist` containing `qaPassed: true` is sent to `onSave(updatedJob)` and persisted directly to Firestore (`COLLECTIONS.PROJECTS`).
  - **Impact**:
    - Bypasses the 4-point QA inspection modal completely.
    - Zero validation of corner squareness, diagonal tolerance ($\pm2\text{mm}$), weld penetration, primer coating, or canvas tension.
    - No `qaCheck` object is stamped (no inspector name, no inspection timestamp, no notes).
    - No 25% Final Settlement invoice is generated.
    - The job remains in its current stage (`Ongoing` or `Ready For Inspection`), but possesses a corrupt internal state: `checklist.qaPassed === true`, while uninspected and uninvoiced.

---

## 6. Target Diagonal Calculation & A4 Printout Verification

### 6.1 Interactive Diagonal Target Calculation
- In `FabricationWorks.jsx:L1046-L1061`:
  ```javascript
  D = Math.round(Math.sqrt(Math.pow(Number(inspectingJob.frameWidth), 2) + Math.pow(Number(inspectingJob.frameHeight), 2))) mm
  ```
- Evaluated against standard formula $D = \sqrt{W^2 + H^2}$. The calculation is mathematically exact and correctly renders the corner-to-corner diagonal target with the $\pm2\text{mm}$ tolerance note.

### 6.2 Workshop Work Order Printout (`printWorkOrder`)
- In `FabricationCardDetails.jsx:L194-L361`:
  - Renders a standalone A4 printable HTML document with automated steel cut-list (`calculateCutList`), corner squareness target diagonal ($D_1 = D_2$), QR code linking to the job portal, and a 3-part physical signature block:
    1. Fabricator / Welder Sign-Off
    2. Anti-Rust & Canvas Sign-Off
    3. Final QA Inspector Sign-Off
  - **Discrepancy**: The print ticket is strictly a physical shop-floor paper document. There is no corresponding digital mechanism to upload, scan, or attach physical sign-off signatures back to the digital `qaCheck` record.

---

## 7. Additional System Integration Deficiencies

### 7.1 Broken WhatsApp AI Update Generator (`api/generate.js`)
- In `FabricationWorks.jsx:L813-L817`:
  ```javascript
  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  ```
- In `api/generate.js:L51-L55`:
  ```javascript
  const authHeader = req.headers.authorization || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) {
    return res.status(401).json({ error: 'Missing Authorization bearer token' });
  }
  ```
- **Finding**: Unlike `src/services/gemini.js` which retrieves `auth.currentUser.getIdToken()` before calling `/api/generate`, `FabricationWorks.jsx` makes an unauthenticated request. In production, this request **always fails with HTTP 401**, causing the WhatsApp update generator to consistently display: `"Failed to generate update. Check API connection."`.

### 7.2 Lack of Audit Logging on Inspection Actions
- Neither `FabricationWorks.jsx` nor `FabricationCardDetails.jsx` imports `logActivity` from `src/services/auditLog.js`.
- Significant operational milestones:
  - QA Pass / Job Completion
  - QA Rejection / Revision Tagging
  - Rework Completion
  are never written to `COLLECTIONS.AUDIT_LOG`.
- The only audit entry occurs inside `App.jsx` (`INVOICE_CREATED`), which logs financial invoice creation, not the technical inspection sign-off.

### 7.3 Dead Email Template (`fabrication_ready_inspection`)
- `src/constants/emailTemplates.js:L182` defines a comprehensive email template notifying clients and partners that framing has passed workshop QA and is staged in the loading bay.
- There are zero call sites for this template across the entire repository. No email is sent upon QA completion.

---

## 8. Summary Comparison: Documentation vs Code Reality

| Feature / Behavior | Documented Claim | Codebase Implementation Truth | Severity |
|---|---|---|---|
| **Operations Role Invoice Creation** | QA Pass creates 25% Final invoice | `Operations` role lacks `invoices: create` permission; invoice write fails with Permission Denied; job marked Completed anyway | **Critical** |
| **Final Invoice Deduplication** | Guard against duplicate invoice | Zero deduplication in `FabricationWorks.jsx` or `Deals.jsx`; both Trigger 3 and 4 can create duplicate Final invoices | **Critical** |
| **Milestone QA Integrity** | 4-point QA inspection gates completion | `FabricationCardDetails.jsx` allows manual toggle of `checklist.qaPassed`, bypassing all checks & invoicing | **High** |
| **Re-Inspection Duplicate Billing** | Not addressed | Moving a completed job back to inspection and re-passing creates another 25% invoice | **High** |
| **Defect History Tracking** | Sets Revision & defect category | `defectDetails` is a flat object; successive revisions overwrite previous defect history; defects never cleared on pass | **Medium** |
| **Invoice Client Details** | Invoices customer | Uses `targetJob.phone` instead of `customerPhone`, and ignores `targetJob.company` if customer NIC lookup fails | **Medium** |
| **WhatsApp AI Generator** | Drafts status update | Omits `Authorization: Bearer <token>`, permanently failing with 401 in production | **Medium** |
| **Audit Log Entries** | Not found in docs | Confirmed: Zero audit entries for inspection, defect tagging, or rework completion | **Low** |
| **Dashboard Metrics** | Counts Ready For Inspection jobs | Only filters them into top-5 action queue; ignores Revision jobs completely | **Low** |

---

## 9. Decision Log & Accepted Resolutions

> **Stakeholder Sign-Off**: All architectural dilemmas and recommended options have been formally reviewed and **accepted**. The open decision points are closed with the agreed implementation resolutions below.

| # | Topic | Status | Accepted Resolution & Technical Specification | Implementation Target |
|---|---|---|---|---|
| **1** | **Operations Role Invoice Creation** | **Accepted** (Option A) | **Grant `Operations` role `invoices: create` capability in default RBAC**: Update `DEFAULT_PERMISSIONS` in `src/context/PermissionsContext.jsx` for the `Operations` role to allow invoice creation. In `FabricationWorks.jsx` (`handlePassQAInner`), properly await `onSaveInvoice` and wrap it in an error-handling boundary so that if invoice creation encounters an error, the project status is not prematurely or erroneously marked as "Completed". | `src/context/PermissionsContext.jsx`, `src/components/operations/FabricationWorks.jsx` |
| **2** | **Duplicate Final Invoice Guard (Trigger 3 vs 4 Conflict)** | **Accepted** (Option A) | **Implement symmetric deduplication guards in both Triggers**: Pass `invoices` prop into `FabricationWorks.jsx` via `App.jsx`. Before calling `generateInvoiceId('Final')` and `onSaveInvoice`, verify whether an existing invoice with `type === 'Final'` exists for the target `jobNo`, `dealId`, or `leadId` in `invoices`. In `Deals.jsx` (`handleMoveStage`), add the matching guard checking if an invoice of `type === 'Final'` already exists for `deal.jobNo` or `deal.id` before reserving a new invoice ID. | `src/App.jsx`, `src/components/operations/FabricationWorks.jsx`, `src/components/crm/Deals.jsx` |
| **3** | **Card Details `qaPassed` Milestone Bypass** | **Accepted** (Option A) | **Lock Milestone 5 and require formal QA inspection**: In `FabricationCardDetails.jsx`, remove direct toggle interaction from step 5 (`qaPassed`). Display step 5 as a read-only checkpoint with a clear badge indicating QA status and a button linking directly to "Open QA Inspection Gate". In `handleSave`, ignore or prevent setting `checklist.qaPassed = true` unless a valid `qaCheck` object with verified checklist criteria exists on the job record. | `src/components/operations/FabricationCardDetails.jsx` |
| **4** | **Defect & Revision History Preservation** | **Accepted** (Option B) | **Active Defect state + `defectHistory` archive array**: Enhance `projects` document schema to support `defectHistory: []` alongside `defectDetails: null`. When `handleConfirmRevision` executes, append the defect payload `{ category, notes, reportedAt, reporter, id }` into `defectHistory` while updating `defectDetails`. When rework is completed and QA passes, clear active `defectDetails: null` while preserving the full historical `defectHistory` on the completed project. | `src/components/operations/FabricationWorks.jsx` |
| **5** | **CRM Deal Stage Synchronization on Defect** | **Accepted** (Option B) | **Targeted Internal Notification to Deal Owner**: Retain decoupled Kanban stages between CRM and Operations to prevent invalid workflow constraints, but emit an in-app notification (`emitNotification`) and system alert to the Deal assignee/sales representative whenever a linked fabrication job is sent to "Revision", detailing the defect category and notes. | `src/components/operations/FabricationWorks.jsx`, `src/utils/toast.js` |
| **6** | **Re-Inspection Duplicate Billing Prevention** | **Accepted** (Option A) | **Idempotent Invoice Verification on QA Approval**: When a job in "Ready For Inspection" is passed in `handlePassQAInner`, check if `targetJob.finalInvoiceGenerated` is `true` or if a matching `type === 'Final'` invoice already exists in `invoices`. If found, reuse the existing invoice reference and bypass `generateInvoiceId('Final')` and `onSaveInvoice`, preventing duplicate billing when completed jobs are re-inspected. | `src/components/operations/FabricationWorks.jsx` |
| **7** | **Inspection Audit Logging & Provenance** | **Accepted** (Option A + B) | **Enforce authenticated inspector identity and audit logging**: Lock the Inspector field in `qaForm` to `currentUser?.name || currentUser?.displayName` (read-only) to eliminate unverified text entries. Call `logActivity` from `src/services/auditLog.js` on: 1) `QA_PASSED` (stamping inspector, job number, and timestamp), 2) `QA_DEFECT_FLAGGED` (stamping defect category, reporter, and notes), and 3) `QA_REWORK_COMPLETED` (stamping completion of rework). | `src/components/operations/FabricationWorks.jsx` |
| **8** | **Client & Dispatch Notification Integration** | **Accepted** (Option B) | **Interactive "Email Client: QA Passed" action**: Instead of silent unsolicited automated emails, present an explicit confirmation button in the QA completion toast / card actions allowing operators/managers to preview and dispatch the `fabrication_ready_inspection` email template via `/api/send-email.js`. | `src/components/operations/FabricationWorks.jsx`, `src/constants/emailTemplates.js` |
| **9** | **Customer Phone & Company Desync on Invoices** | **Accepted** | **Comprehensive fallback resolution across customer aliases**: In `handlePassQAInner`, update the phone and company resolution logic to inspect all possible job and customer fields: `phone: targetJob.customerPhone || targetJob.phone || cust?.phone || ""`, `company: targetJob.company || cust?.businessName || cust?.company || ""`. | `src/components/operations/FabricationWorks.jsx` |
| **10** | **WhatsApp AI Generator Bearer Token Missing** | **Accepted** | **Add Firebase ID Token to `/api/generate` request**: In `handleGenerateUpdate`, call `await auth.currentUser?.getIdToken()` and pass `headers: { 'Authorization': `Bearer ${idToken}`, 'Content-Type': 'application/json' }` to resolve the HTTP 401 Unauthorized failures in production. | `src/components/operations/FabricationWorks.jsx` |

