# Deals Module Review & Correctness Audit Findings

> **Scope**: Correctness review of `docs/02_modules/deals/CLAUDE.md`, `docs/02_modules/deals/README.md`, and all cross-module triggers touching Deals documented in `docs/01_architecture/CROSS_MODULE_TRIGGERS.md`.  
> **Branch / Worktree**: `review-deals` (`.worktrees/review-deals`)  
> **Status**: Review & Audit findings (no functional code modified).

---

## 1. Executive Summary

A comprehensive architectural and trigger audit was conducted across the Deals module and its integration boundaries:
- **Module Documentation**: `docs/02_modules/deals/README.md`, `docs/02_modules/deals/CLAUDE.md`, `docs/01_architecture/CROSS_MODULE_TRIGGERS.md`.
- **Target UI Components**: `src/features/deals/Deals.jsx`, `src/features/leads/LeadCardDetails.jsx`, `src/features/leads/Leads.jsx`.
- **Services & Utilities**: `src/shared/utils/entityUtils.js` (`matchesEntity`), `src/utils/logisticsEngine.js`, `src/features/quotations/pricingEngine.js`, `src/features/invoicing/invoiceTemplate.js`, `src/services/firestoreSync.js`.
- **Integration & Consumer Surfaces**: `src/App.jsx` (`handleSaveInvoice`, `handleMarkInvoicePaid`, stage transitions), `src/components/operations/FabricationWorks.jsx`, `src/features/partners/Partners.jsx`, `src/features/dashboard/Dashboard.jsx`, `firestore.rules`.

### Key Discoveries:
1. **Critical Final Invoice Hazards (Trigger 3 vs 4 vs 5b)**:
   - Up to three distinct surfaces independently generate a 25% Final Invoice for the same job (Deal Completion, Fabrication QA Pass, and manual click in QuotationBuilder). None verify if a Final invoice already exists.
   - A critical mathematical compounding bug exists in the fallback line item generation: when no quotation is linked, `Deals.jsx` sets `unitPrice` to the 25% balance amount, which `invoiceTemplate.js` then multiplies by 0.25 again, printing line items at 6.25% (1/16th) of the deal value while the footer displays 25%.
2. **Trigger Timing Discrepancy (Trigger 6b Partner Commission)**:
   - Documentation (`CLAUDE.md` and `CROSS_MODULE_TRIGGERS.md`) states commission accrues when reaching "Hand Over". In reality, the code executes commission accrual only when transitioning *out* of "Hand Over" into "Completed".
3. **Stage Reversal & Commission Duplication Exploit**:
   - Completed deal cards can be moved backward to "Hand Over" via the Kanban UI. Moving backward does not cancel the invoice or reverse the partner commission. Moving forward to Completed again creates duplicate invoices and re-accrues partner commission.
4. **Table View Bulk Action Bypass**:
   - `handleBulkStageChange` allows bulk moving deals to "Completed", completely skipping invoice reservation (`generateInvoiceId`), invoice creation (`onSaveInvoice`), and partner commission accrual.
5. **Security & RBAC Rules Disconnect**:
   - `firestore.rules` declares a `match /deals/{dealId}` block checking the `pipeline` permission, but deals are stored in the `/leads` collection (`isDeal: true`). As a result, deals access is evaluated exclusively against `match /leads/{leadId}` (`leads` permission), rendering the `/deals` security rules dead code and creating permission denial errors for users with `pipeline` but not `leads` permissions.
6. **Pipeline Decoupling**:
   - Deals stages (`Waiting`, `Fabricating`, `Ready To Load`, `Hand Over`, `Completed`) and Fabrication project stages (`Pending`, `Ongoing`, `Ready For Inspection`, `Revision`, `Completed`) operate in complete isolation without state synchronization.

---

## 2. Review of Module Documentation

### 2.1 `docs/02_modules/deals/CLAUDE.md`

| Section / Claim | Code Status | Details / Discrepancy |
|---|---|---|
| **What it does** ("Deals is the post-sale Kanban... over `leads` documents flagged `isDeal`. Completing a deal creates the 25% Final invoice.") | **Accurate** | Confirmed: Deals query `leads.filter(l => l.isDeal && DEALS_STAGES.includes(l.stage))`. Completion triggers 25% Final invoice creation. |
| **Firestore collections it owns or writes** ("No `deals` collection is used. Deals live in `leads`.") | **Accurate** | Confirmed: All deal operations read and write to `COLLECTIONS.LEADS`. |
| **Triggers and side effects** ("Hand Over: accrues partner commission (`sqFt x rate`).") | **Discrepancy** | In `Deals.jsx:L332`, partner commission accrual is gated by `if (liveNextStage === "Completed")`. It does **not** accrue when reaching "Hand Over", but when moving from "Hand Over" to "Completed". |
| **Triggers and side effects** ("Hand Over to Completed: reserves a Final invoice id (aborts if it fails), creates a 25% Final invoice.") | **Accurate** | Confirmed: `generateInvoiceId('Final')` is awaited prior to state update; move aborts if reservation fails. |
| **Before you edit** ("The `deals` block in `firestore.rules` and the `pipeline` permission do not govern real deal data.") | **Accurate** | Confirmed: `firestore.rules:L130-L135` matches `/deals/{dealId}`, which is never written to. |

### 2.2 `docs/02_modules/deals/README.md`

| Section / Claim | Code Status | Details / Discrepancy |
|---|---|---|
| **Files and Folders** ("`App.jsx`: mounts Deals under tab `pipeline`...") | **Incomplete Prop Passing** | `App.jsx:L1269` passes `setProjects={setProjects}` to `<Deals>`, but `Deals.jsx:L175-L191` never declares or accepts `projects` or `setProjects`. |
| **Firestore collections read/written** ("Writes to other modules' collections: `invoices`, `partners`, `logistics`, `customers`, `projects`...") | **Accurate** | Writes invoices on completion, partner pending commissions, manual logistics jobs, and customer/project records upon conversion. |
| **Summary / Stage moves** ("Stage moves (not to Completed): write only `stage` and `stageEnteredAt`. No project status sync...") | **Accurate** | Confirmed: Stage moves between Waiting, Fabricating, Ready To Load, and Hand Over write only `{ stage, stageEnteredAt }` to `leads`. |
| **Open questions** ("A second automatic Final-invoice creator exists in `FabricationWorks.jsx`... how the two interact...") | **Unresolved / Critical** | Confirmed: Both flows exist simultaneously without mutual awareness or deduplication checks. |

---

## 3. Cross-Module Triggers Audit (`CROSS_MODULE_TRIGGERS.md`)

### Trigger 2: Lead Converts to Deal

* **Trigger**: Kanban forward move from `"Received"` in `Leads.jsx`, or clicking `"Convert to Deal"` in `LeadCardDetails.jsx`.
* **Implementation**: `Leads.jsx:L476-L608` (`handleConvertConfirm`).
* **Trace & Analysis**:
  1. **Document Split**: Creates a new document in `COLLECTIONS.LEADS` with `isDeal: true`, `stage: 'Waiting'`, `originalLeadId: originalLead.id`. The original lead document is updated with `stage: 'Completed'`, `isDeal: false`, `convertedToDeal: true`, `convertedDealId: dealId`.
  2. **Non-Atomic Multi-Write Fragility**:
     - The conversion executes 4 to 5 unbundled writes sequentially:
       1. `updateDocument(LEADS, originalLeadId, ...)`
       2. `addDocument(LEADS, newDeal, dealId)`
       3. `updateDocument(CUSTOMERS, ...)` or `addDocument(CUSTOMERS, ...)`
       4. `addDocument(PROJECTS, newJob, jobNo)`
     - A network interruption or tab close mid-execution results in inconsistent state (e.g., original lead locked as converted, but no Deal or Project created).
  3. **ID Generation & Collision Hazard**:
     - `dealId = D-${String(Date.now()).slice(-6)}` (cycles every 16.6 minutes).
     - `jobNo = convertedLead.jobNo || PTF-${String(Date.now()).slice(-4)}` (cycles every 10 seconds).
     - Neither utilizes atomic counter reservation or uniqueness verification.
  4. **Unlinked Invoice Draft**:
     - `ConvertDealModal` allows drafting a text/markdown invoice (`invoiceDraft`), which is attached to both lead and deal documents but is never synced to the `invoices` collection or loaded into `QuotationBuilder`.

---

### Trigger 3: Deal Reaches Completed

* **Trigger**: Deal card moved forward from `"Hand Over"` to `"Completed"` in `Deals.jsx:L281-L410`.
* **Implementation**: `handleMoveForward` $\rightarrow$ `handleMoveForwardInner`.
* **Trace & Analysis**:
  1. **Atomic ID Reservation**: Calls `finalInvId = await generateInvoiceId('Final')`. If counter generation fails, toasts error and aborts stage move.
  2. **Invoice Generation Payload**:
     ```javascript
     onSaveInvoice({
       id: finalInvId,
       leadId: deal.id,
       dealId: deal.id,
       originalLeadId: deal.originalLeadId || '',
       linkedJobNo: deal.jobNo || deal.linkedJobNo || '',
       jobNo: deal.jobNo || deal.linkedJobNo || '',
       quotationId: linkedQuote?._firestoreId || linkedQuote?.id || '',
       customerName: deal.name || 'Direct Customer',
       amount: finalAmount, // deal.value * 0.25
       totalValue: deal.value || 0,
       advancePaid: (deal.value || 0) * 0.75,
       balanceDue: finalAmount,
       type: 'Final',
       status: 'Unpaid',
       lineItems: linkedQuote?.lineItems || [...]
     });
     ```
  3. **Quotation Match Ambiguity**:
     - Quotation is resolved via `const linkedQuote = (quotations || []).find(q => matchesEntity(q, deal));`.
     - `.find()` picks the **first match in array order**. If multiple quotes or draft revisions exist, it does not check for `status === 'Accepted'` and does not sort by `version` or timestamp.
  4. **Fallback Line Item Price Compounding Bug (`invoiceTemplate.js` vs `Deals.jsx`)**:
     - If no `linkedQuote?.lineItems` exist, `Deals.jsx:L357` falls back to:
       ```javascript
       lineItems: [
         { description: deal.jobScope || "...", qty: 1, unit: "job", unitPrice: finalAmount, taxPct: 0, discountPct: 0 }
       ]
       ```
       Here, `unitPrice` is set to `finalAmount` (25% of `deal.value`).
     - In `src/features/invoicing/invoiceTemplate.js:L242`, the print renderer calculates line item price as:
       ```javascript
       ${(Number(item.qty || 1) * Number(item.unitPrice || 0) * (isFinal ? 0.25 : 0.75)).toLocaleString(...)}
       ```
     - For a deal value of LKR 100,000, `finalAmount` is LKR 25,000.
     - `invoiceTemplate.js` multiplies `unitPrice` (25,000) by `0.25` again, rendering the line item table row as **LKR 6,250** (6.25% of contract value), while the totals section below prints `Final Settlement Due: LKR 25,000` (25%).
  5. **Lack of Idempotency**:
     - Does not verify if an invoice with `type === 'Final'` already exists for `deal.id`, `deal.jobNo`, or `deal.originalLeadId`.

---

### Trigger 3 vs 4 vs 5b: Duplicate Final Invoice Hazard

* **Trigger Sources**:
  - **Path A (Trigger 3)**: Move deal to Completed in `Deals.jsx:L333`.
  - **Path B (Trigger 4)**: Pass 4-point QA in `FabricationWorks.jsx:L717` (`handlePassQAInner`).
  - **Path C (Trigger 5b)**: Click "25% Final Settlement" in `QuotationBuilder.jsx:L261` (`handleConvertToFinalInvoice`).
* **Conflict Analysis**:
  1. **Triple Generation Risk**:
     - If a job passes QA on the fabrication shop floor, an `INV-FIN-####` invoice is created.
     - When the deal is subsequently moved to Completed on the Deals Kanban, a second `INV-FIN-####` invoice is created.
     - If a salesperson also clicks "25% Final Settlement" in QuotationBuilder, a third invoice is created.
  2. **Inconsistent Invoice Payloads**:
     - `Deals.jsx` copies line items from `linkedQuote`, records `quotationId`, `advancePaid`, and `balanceDue`.
     - `FabricationWorks.jsx` does not look up quotations, sets `quotationId: ''`, lacks `lineItems` (falls back to generic string in template), and omits `advancePaid` and `balanceDue`.
  3. **Severe Downstream Distortions**:
     - **Accounts Receivable Inflation**: Outstanding receivables in Invoices and Dashboard double or triple.
     - **Logistics COD Collection Overcharge**: In `src/utils/logisticsEngine.js:L196-L200` (`calculateCODFromInvoices`):
       ```javascript
       const totalBalanceDue = unpaidInvoices.reduce((sum, inv) => sum + Number(inv.amount || 0), 0);
       ```
       If two unpaid final invoices exist for the same job, `totalBalanceDue` doubles! The driver's COD screen and customer WhatsApp dispatch alert will demand double the remaining balance upon delivery.
     - **Payment Tracking Drift**: In `LeadCardDetails.jsx:L103-L106`, `finalInvoice` uses `latestByCreatedAt(...)`. If one duplicate invoice is marked Paid and the other remains Unpaid, the card may display "Paid" while the ghost invoice remains Unpaid in Accounts Receivable.

---

### Trigger 5: Quotation Linkage via `matchesEntity` Lineage

* **Implementation**: `src/shared/utils/entityUtils.js` (`matchesEntity`, `getEntityIdSet`).
* **Trace & Analysis**:
  1. **Lineage Traversal**:
     - Quotes store `leadId` referencing the original lead ID (`L-xxxxxx`).
     - Deals store `id` (`D-xxxxxx`) and `originalLeadId` (`L-xxxxxx`).
     - `getEntityIdSet` checks `['id', '_firestoreId', 'leadId', 'dealId', 'originalLeadId', 'convertedDealId', ...]`.
     - Matching succeeds because `deal.originalLeadId === quote.leadId`.
  2. **Value Synchronization Disconnect**:
     - When quotations are revised or approved in `QuotationBuilder`, `quotation.grandTotal` is saved.
     - However, `lead.value` on the deal document is **never updated**.
     - When `Deals.jsx` completes the deal, it calculates `finalAmount = (deal.value || 0) * 0.25`, ignoring any price changes or discounts made in the approved quotation.

---

### Trigger 6b: Partner Referral Commission Accrual

* **Implementation**: `Deals.jsx:L362-L385`.
* **Trace & Analysis**:
  1. **Execution Timing**:
     - Triggered strictly when `liveNextStage === "Completed"` (moving out of Hand Over into Completed).
     - Does not execute when entering "Hand Over", correcting the claim in `CROSS_MODULE_TRIGGERS.md`.
  2. **Calculation**:
     ```javascript
     const sqFt = Number(deal.totalSqFt) || 0;
     const agent = partners.find(p => p.partnerId === deal.agentId);
     const commRate = Number(agent?.commissionRate) > 0 ? Number(agent.commissionRate) : 53.5;
     const commissionAmount = sqFt * commRate;
     ```
  3. **Zero SqFt Fallback Flaw**:
     - If a deal has `deal.value` set (e.g. LKR 500,000) but `deal.totalSqFt` is missing or 0 (e.g. entered manually or converted from a lead without pricing calculator metadata), `commissionAmount` evaluates to **0**.
     - In contrast, `Partners.jsx:L262-L264` contains a fallback: `commAmount = (dealVal / 850) * commRate`. `Deals.jsx` lacks this fallback.
  4. **Stage Reversal Commission Exploitation**:
     - When moving a deal backward from Completed to Hand Over via `handleMoveBackward` (`Deals.jsx:L442-L465`), `stage` is updated to `"Hand Over"`.
     - The accrued commission in `partners.pending` is **not decremented**.
     - When the deal is moved to Completed again, `commissionAmount` is accrued a second time to `partners.pending` and `partners.totalSqFt`.
  5. **Duplicate Referrals in `Partners.jsx`**:
     - In `Partners.jsx:L237`, `leads.filter(...)` matches both the original Lead (`stage: 'Completed'`, `convertedToDeal: true`) and the active Deal.
     - Because `lead.stage === 'Completed'` triggers `commState = 'Eligible for Payout'` in `Partners.jsx:L278`, the converted lead immediately shows as eligible for payout upon conversion, prior to deal completion or full payment settlement.

---

### Trigger 8: Manual Logistics Dispatch Task Creation

* **Implementation**: `Deals.jsx:L412-L440` (`handleCreateDeliveryJob`) and `LeadCardDetails.jsx:L1666-L1718`.
* **Trace & Analysis**:
  1. **Availability**:
     - Available on Kanban cards in `"Ready To Load"` and `"Hand Over"` stages via the "Deliver" button.
     - Available inside `LeadCardDetails.jsx` under the "Delivery Logistics" sidebar card.
  2. **Payload**:
     - Generates ID `L-DL-${String(Date.now()).slice(-6)}`.
     - Types: `type: "Delivery"`, `subType: "Framed Works / Finished Goods"`.
     - Identifiers: `dealId: deal.id`, `leadId: deal.originalLeadId || deal.id`.
  3. **Status Sync Disconnect**:
     - Status badges in `Deals.jsx` render "Dispatched", "In Transit", or "Delivered" based on `matchesEntity(job, deal)`.
     - However, updating or completing the logistics task in `Logistics.jsx` has no effect on deal stage.
     - Moving or completing a deal in `Deals.jsx` has no effect on logistics tasks.
  4. **Optimistic Error Handling**:
     - Updates local state `setLogisticsJobs(prev => [newJob, ...prev])`.
     - If Firestore `addDocument` fails, it logs an error and toasts, but does not revert the local state update.

---

## 4. Architectural & Implementation Disconnects

### 4.1 Table View Bulk Action Bypass

In `Deals.jsx:L198-L212`:
```javascript
const handleBulkStageChange = async (targetStage) => {
  if (!selectedDealIds.length) return;
  const now = new Date().toISOString();
  setLeads(prev => prev.map(d => selectedDealIds.includes(d.id) ? { ...d, stage: targetStage, stageEnteredAt: now } : d));
  try {
    await Promise.all(selectedDealIds.map(id => {
      const deal = leads.find(d => d.id === id);
      return updateDocument(COLLECTIONS.LEADS, deal?._firestoreId || id, { stage: targetStage, stageEnteredAt: now });
    }));
    ...
```
- **Impact**: When users select multiple deals in Table view and choose "Move to Stage... Completed", this method executes a direct Firestore update on `stage`.
- **Bypass**: It completely bypasses `handleMoveForwardInner`:
  - No Final invoice ID is reserved.
  - No 25% Final Invoice is generated.
  - No partner commission is accrued to `partners.pending`.
  - Deals enter Completed in an unbilled, uncommissioned state.

### 4.2 Disconnect Between Deals and Fabrication Projects

- When a lead is converted, a project is created in `projects` with `status: "Pending"`, and a deal is created in `leads` with `stage: "Waiting"`.
- As the deal progresses through `Fabricating` $\rightarrow$ `Ready To Load` $\rightarrow$ `Hand Over` $\rightarrow$ `Completed`, the fabrication project status is **never updated**.
- As the fabrication project progresses through `Pending` $\rightarrow$ `Ongoing` $\rightarrow$ `Ready For Inspection` $\rightarrow$ `Completed`, the deal stage is **never updated**.
- A deal can be marked Completed while fabrication remains Pending, or vice-versa.

### 4.3 Deal Deletion Orphan Hazards

In `Deals.jsx:L467-L483`:
- Admin can click delete on a deal card.
- `handleDeleteConfirm` executes `deleteDocument(COLLECTIONS.LEADS, targetDeal._firestoreId || targetDeal.id)`.
- **Orphaned Entities**:
  1. The linked fabrication project in `COLLECTIONS.PROJECTS` remains active.
  2. The original lead remains locked with `convertedToDeal: true` and `convertedDealId: dealId`, permanently pointing to a deleted record.
  3. Invoices, receipts, and logistics jobs tied to `dealId` remain orphaned.
  4. Partner commissions accrued if the deal was completed are not reversed.
  5. Unlike Lead deletion (`LEAD_DELETED`), Deal deletion creates no entry in `auditLog`.

### 4.4 Firestore Security Rules & RBAC Dead Code

In `firestore.rules:L130-L135`:
```javascript
// ── Deals ────────────────────────────────────────────
match /deals/{dealId} {
  allow read: if checkPermission('pipeline', 'view') || checkPermission('pipeline', 'read');
  allow create, update: if checkPermission('pipeline', 'create') || checkPermission('pipeline', 'edit') || checkPermission('pipeline', 'write');
  allow delete: if isAdmin();
}
```
- Deals are stored exclusively in `/leads/{leadId}`.
- All Firestore operations from `Deals.jsx` evaluate `match /leads/{leadId}`:
  ```javascript
  match /leads/{leadId} {
    allow read: if checkPermission('leads', 'view') || checkPermission('leads', 'read');
    ...
  }
  ```
- **Consequence**: The `/deals` rules block is completely dead code. If an administrator configures a user role with `pipeline: view/edit` but `leads: none`, the user will be blocked by Firestore rules from viewing or moving deals on the Deals board.

### 4.5 Dashboard Action Queue Exclusion

In `src/features/dashboard/Dashboard.jsx:L127-L135`:
```javascript
const dealsActionQueue = useMemo(() => {
  return leads
    .filter(l => l.isDeal && ["Waiting", "Fabricating", "Ready To Load"].includes(l.stage))
    ...
```
- Deals in the `"Hand Over"` stage are omitted from the priority queue filter.
- These deals are in the final delivery and handover phase but disappear from the Dashboard Action Queue until completed.

---

## 5. Resolved Decisions

> **Status**: All 10 decision points below have been **accepted** by the project owner on 2026-09-20. The recommended approach for each item is now the authoritative implementation target. No further approval is required before coding begins.

| # | Topic / Area | Decision Accepted | Resolution | Files to Change |
|---|---|---|---|---|
| **D-1** | **Duplicate Final Invoice Prevention** | ✅ ACCEPTED | Add a shared guard `getExistingFinalInvoice(invoices, entity)` exported from `entityUtils.js` (uses `matchesEntity` to match on `leadId`, `dealId`, `originalLeadId`, `linkedJobNo`). Before calling `generateInvoiceId` in `Deals.jsx` and `FabricationWorks.jsx`, check the invoices array. If a Final invoice already exists, skip creation and toast an info message linking to the existing invoice. `QuotationBuilder.jsx` already guards with `if (finalInvoice || isConvertingFinal) return;` — no change required there. | `src/shared/utils/entityUtils.js` (add helper), `src/features/deals/Deals.jsx` (add pre-check), `src/components/operations/FabricationWorks.jsx` (add pre-check) |
| **D-2** | **Invoice Fallback Line Item Price Compounding** | ✅ ACCEPTED | In the fallback `lineItems` array in `Deals.jsx:L357`, change `unitPrice: finalAmount` to `unitPrice: deal.value \|\| 0`. This ensures `invoiceTemplate.js` correctly multiplies by `0.25` (for Final invoices) to arrive at the right 25% balance amount in both the line table and the totals footer. | `src/features/deals/Deals.jsx` (fallback `lineItems[0].unitPrice`) |
| **D-3** | **Quotation Grand Total vs Deal Value Sync** | ✅ ACCEPTED | In `handleMoveForwardInner` (Deals.jsx), if an `Accepted` quotation is found via `matchesEntity`, derive `finalAmount` from `linkedQuote.grandTotal * 0.25` (or `linkedQuote.balanceDue` if already stored). Also propagate `deal.value = linkedQuote.grandTotal` to the Firestore update payload when completing, keeping the Kanban metric in sync. Quotation lookup must filter to `status === 'Accepted'` and pick the highest `version` if multiple exist. | `src/features/deals/Deals.jsx` (`handleMoveForwardInner`) |
| **D-4** | **Stage Reversal & Commission Rollback** | ✅ ACCEPTED | Disable backward navigation from the `"Completed"` stage. In `DealColumn`, pass `onMoveBack={isLastStage ? null : handleMoveBackward}` so the `KanbanCard` back-arrow never renders for Completed cards. This eliminates the backward-move exploit without requiring commission reversal logic. | `src/features/deals/Deals.jsx` (`DealColumn` — conditional `onMoveBack` prop) |
| **D-5** | **Table View Bulk Stage Move Bypass** | ✅ ACCEPTED | In `handleBulkStageChange`, guard against the `"Completed"` target: `if (targetStage === 'Completed') { toast.error('...use the Kanban board...'); return; }`. This closes the bypass cleanly. The `<select>` option for "Completed" remains visible but is disallowed server-side by the handler, and a toast explains why. | `src/features/deals/Deals.jsx` (`handleBulkStageChange`) |
| **D-6** | **Deals / Fabrication Status Synchronization** | ✅ ACCEPTED | Implement lightweight one-way sync at known milestone crossings only — don't attempt full bidirectional sync, which would introduce circular update risk. **Rules:** (1) Deal moves to `"Fabricating"` → update linked project `status: "Ongoing"`. (2) Deal moves to `"Ready To Load"` → update linked project `status: "Ready For Inspection"`. (3) Deal moves to `"Completed"` → update linked project `status: "Completed"`. Deal stage is always the source of truth. FabricationWorks QA pass does **not** update the deal stage (the deal still requires a salesperson to move it forward). The `linkedJobNo` / `jobNo` field is the join key. | `src/features/deals/Deals.jsx` (`handleMoveForwardInner` — add `updateDocument(COLLECTIONS.PROJECTS, ...)` calls keyed by `deal.jobNo`) |
| **D-7** | **Zero SqFt Commission Fallback** | ✅ ACCEPTED | Mirror the fallback already in `Partners.jsx:L262-L264`. In `Deals.jsx` commission block, after resolving `sqFt`: `const effectiveSqFt = sqFt > 0 ? sqFt : 0; const commissionAmount = effectiveSqFt > 0 ? effectiveSqFt * commRate : (Number(deal.value) / 850) * commRate;`. Apply same fallback when writing `partners.totalSqFt` — only add `sqFt` to `totalSqFt` when `sqFt > 0` (the estimated value shouldn't inflate the area counter). | `src/features/deals/Deals.jsx` (commission block in `handleMoveForwardInner`) |
| **D-8** | **RBAC & Firestore Rules Alignment** | ✅ ACCEPTED | Update `firestore.rules` `/leads/{leadId}` to also accept `pipeline` permissions: `allow read: if checkPermission('leads','view') \|\| checkPermission('leads','read') \|\| checkPermission('pipeline','view') \|\| checkPermission('pipeline','read');` and similarly for create/update/delete. Retain the existing `/deals/{dealId}` block but add a comment that it matches a phantom collection and will be removed in a future cleanup pass. | `firestore.rules` (`match /leads/{leadId}` — widen read/write conditions) |
| **D-9** | **Dashboard Hand Over Visibility** | ✅ ACCEPTED | Add `"Hand Over"` to `dealsActionQueue` filter in `Dashboard.jsx:L128`: `["Waiting", "Fabricating", "Ready To Load", "Hand Over"]`. No other changes needed; the card already renders correctly for this stage. | `src/features/dashboard/Dashboard.jsx` (`dealsActionQueue` filter array) |
| **D-10** | **Deal Deletion Cascade & Audit Logging** | ✅ ACCEPTED | Extend `handleDeleteConfirm` in `Deals.jsx`: (1) Write `DEAL_DELETED` to `auditLog` via `logActivity`. (2) Update the original lead document (`originalLeadId` pointer) to clear the lock: `{ convertedToDeal: false, convertedDealId: null }` so the lead is no longer permanently orphaned. (3) Do **not** cascade-delete invoices, receipts, or logistics — those are financial records; instead update the linked `projects` doc to `status: "Cancelled"` with a note. The Firestore write sequence: auditLog → unlock lead → cancel project → delete deal (in that order; proceed even if non-critical steps fail, log errors). | `src/features/deals/Deals.jsx` (`handleDeleteConfirm` — add audit log, lead unlock, project cancel) |

---

## 6. Implementation Checklist

> All items in §5 are **accepted**. The following checklist tracks execution status. Mark `[x]` when a change is committed to `review-deals` branch.

- [x] **D-1** — Add `getExistingFinalInvoice` helper to `entityUtils.js`; guard Deals.jsx and FabricationWorks.jsx before invoice generation.
- [x] **D-2** — Fix fallback `lineItems[0].unitPrice` in `Deals.jsx:L357` (`finalAmount` → `deal.value`).
- [x] **D-3** — Derive `finalAmount` from `linkedQuote.grandTotal * 0.25` in `handleMoveForwardInner`; filter quotation match to `Accepted` status, highest version; sync `deal.value` on completion.
- [x] **D-4** — Pass `onMoveBack={isLastStage ? null : handleMoveBackward}` in `DealColumn`.
- [x] **D-5** — Guard `handleBulkStageChange` against `targetStage === 'Completed'` with toast error.
- [x] **D-6** — Add project status sync writes in `handleMoveForwardInner` for `Fabricating` → `Ongoing`, `Ready To Load` → `Ready For Inspection`, `Completed` → `Completed`.
- [x] **D-7** — Add `(deal.value / 850) * commRate` fallback when `totalSqFt <= 0` in commission block.
- [x] **D-8** — Widen `match /leads/{leadId}` in `firestore.rules` to accept `pipeline` permissions.
- [x] **D-9** — Add `"Hand Over"` to `dealsActionQueue` filter in `Dashboard.jsx`.
- [x] **D-10** — Extend `handleDeleteConfirm`: audit log, lead lock-clear, project cancel.
