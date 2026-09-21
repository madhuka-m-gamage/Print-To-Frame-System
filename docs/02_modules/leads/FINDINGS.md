# Leads Module Review & Correctness Audit Findings

> **Scope**: Correctness review of `docs/02_modules/leads/CLAUDE.md`, `docs/02_modules/leads/README.md`, and all cross-module triggers touching Leads documented in `docs/01_architecture/CROSS_MODULE_TRIGGERS.md`.  
> **Branch / Worktree**: `review-leads` (`.worktrees/review-leads`)  
> **Status**: ✅ Decisions closed — all ambiguities resolved by product owner (A1–A7). Ready for implementation.

---

## 1. Executive Summary

A deep-trace audit was conducted across the Leads module implementation files:
- **Module Docs**: `docs/02_modules/leads/README.md`, `docs/02_modules/leads/CLAUDE.md`
- **UI Components**: `src/features/leads/Leads.jsx`, `src/features/leads/LeadCardDetails.jsx`, `src/features/quotations/QuotationBuilder.jsx`
- **Services & Utilities**: `src/services/gemini.js`, `src/features/quotations/pricingEngine.js`, `src/features/leads/audioProcessing.js`
- **Backend Proxy**: `api/generate.js` (and dev server middleware in `vite.config.js`)
- **System Integration**: `src/App.jsx`, `firestore.rules`, `src/components/crm/Partners.jsx`

While the core architecture described in `CLAUDE.md` (client-side orchestration, Deals stored as `isDeal: true` in `leads`, unpersisted audio analysis) is fundamentally confirmed, **several critical workflow breaks, state desynchronizations, and cross-module bugs** were identified.

---

## 2. Review of Module Documentation

### 2.1 `docs/02_modules/leads/CLAUDE.md`

| Section / Claim | Code Status | Details / Discrepancy |
|---|---|---|
| **What it does** ("convert a 'Received' lead into a Deal...") | **Partially Accurate** | On the Kanban board, only "Received" stage moves trigger conversion. However, inside `LeadCardDetails.jsx:L1727`, the "Convert to Deal" button is accessible and actionable at **any stage** (Intake, Processing, etc.) as long as `!lead.convertedToDeal`. |
| **Firestore Collections Written** (`customers, projects, logistics, quotations, invoices, receipts, auditLog`) | **Incomplete** | Omits the `counters` collection. `QuotationBuilder.jsx:L229` and `L275` execute Firestore transactions on `counters/invoice_advance` and `counters/invoice_final` via `generateInvoiceId`. |
| **Call Analysis Trigger** (`extractCallScope` -> `/api/generate`) | **Accurate** | Confirmed: Verified ID token + approved active user required. Results applied to form state only on user confirmation; persisted only on explicit save. Audio is never stored. |
| **Before you edit** ("A Deal is a leads document...") | **Accurate** | Confirmed: Deals live in `COLLECTIONS.LEADS`. Note: As a consequence, `match /deals/{dealId}` in `firestore.rules` is dead rules; Deals are governed by `match /leads/{leadId}`. |
| **Before you edit** ("Leads with source == 'Referral' can be created anonymously") | **Accurate** | Confirmed in `firestore.rules:L125` and `ReferralForm.jsx:L104`. |

### 2.2 `docs/02_modules/leads/README.md`

| Section / Claim | Code Status | Details / Discrepancy |
|---|---|---|
| **Files and Folders** ("`LeadCardDetails.jsx`... Holds the call-recording UI, pricing calculator, invoice and receipt panels, and the logistics trigger") | **Discrepancy** | The logistics trigger in `LeadCardDetails.jsx:L1666` is guarded by `{(isDeal || lead.isDeal) && ...}` and is **hidden for Leads**. For Leads, logistics creation exists solely on the Kanban card in `Leads.jsx` when in the `"75% Invoice Submitted"` stage. |
| **Collections Written** ("`auditLog (LEAD_DELETED, invoice and receipt events)`") | **Discrepancy** | `Leads.jsx:L666` only logs `LEAD_DELETED`. Neither Lead creation (`handleAddNewLead`), Lead editing (`handleSaveLeadDetails`), nor Deal conversion (`handleConvertConfirm`) writes to `auditLog`. |

---

## 3. Cross-Module Triggers Audit (`CROSS_MODULE_TRIGGERS.md`)

### Trigger 1: Call Recording Finishes & AI Analysis Fills Fields

* **Trigger**: User records live audio (`MediaRecorder`) or uploads audio file in `LeadCardDetails.jsx`.
* **Execution Chain**: `processAudioFile` $\rightarrow$ `analyzeCallRecording` $\rightarrow$ `extractCallScope` (`gemini.js`) $\rightarrow$ `POST /api/generate` (`api/generate.js`) $\rightarrow$ `applyAudioAnalysisToScope`.
* **Findings**:
  1. **Audio Compression & Vercel 413 Payload Error**:
     - `LeadCardDetails.jsx:L1168` claims: *"Supports MP3, WAV, M4A, OGG, AAC up to 25MB • Auto-optimized"*.
     - However, `LeadCardDetails.jsx:L333` checks:
       ```javascript
       if (!isAlreadyCompressed && file.size > MAX_PAYLOAD_RAW_SIZE)
       ```
       Only uncompressed WAV files over 3.2MB are passed to `downsampleAudio`.
     - Compressed formats (MP3, M4A, AAC, OGG, WEBM) between 3.3MB and 25MB are **never downsampled**.
     - Because Base64 inflates files by ~33%, any audio over 3.3MB exceeds Vercel's 4.5MB serverless body limit (`MAX_AUDIO_BASE64_LENGTH = 4_500_000` in `api/generate.js:L16`), triggering HTTP 413 (`FUNCTION_PAYLOAD_TOO_LARGE`).
  2. **Secondary Trigger (Customer Cross-Check)**:
     - When `applyAudioAnalysisToScope` runs, it calls `handlePhoneChange(formattedPhone)`. If the extracted phone matches an existing customer in `customers`, an animated banner appears with an *"Auto-Fill Profile"* button.

---

### Trigger 2: Lead Converts to Deal

* **Trigger**: Kanban forward move from `"Received"`, or clicking `"Convert to Deal"` in `LeadCardDetails.jsx`.
* **Execution Chain**: `Leads.jsx:L476-L608` (`handleConvertConfirm`).
* **Writes Performed**:
  1. Original lead updated: `stage: 'Completed'`, `isDeal: false`, `convertedToDeal: true`, `convertedDealId: dealId`.
  2. Deal created in `leads`: `isDeal: true`, `stage: 'Waiting'`, `jobNo: PTF-xxxx`, `originalLeadId: originalLead.id`.
  3. Customer created or updated (`orders: (orders || 0) + 1`).
  4. Project created in `projects`: `status: 'Pending'`, `jobNo: PTF-xxxx`.
* **Findings**:
  1. **Stage Constraint Ambiguity**: `CROSS_MODULE_TRIGGERS.md` states conversion is for *"Lead in stage 'Received'"*. This is enforced on the Kanban board, but the modal button (`LeadCardDetails.jsx:L1727`) allows converting from **any stage** (e.g. converting directly from Intake or Processing).
  2. **Dead Button in "Completed" Column**: `Leads.jsx:L155-L173` renders a `"Convert"` button in the "Completed" column if `!lead.convertedToDeal`. Clicking it invokes `handleMoveForward`, which contains an explicit guard `else if (targetLead.stage !== "Completed")`, resulting in a non-functional button.
  3. **Customer Order Double-Counting Bug**:
     - Saving a lead profile (`Leads.jsx:L451-L473`) auto-creates a customer with `orders: 1`.
     - Later converting that lead (`Leads.jsx:L541-L547`) matches that customer and increments `orders` to `2`.
     - A single order thus increments the customer's order count twice.
  4. **Exact Phone Match False-Negatives**:
     - `Leads.jsx:L446` and `L538` check `c.phone === convertedLead.phone`.
     - `LeadCardDetails.jsx:L441` formats phone numbers with spaces (`+94 7X XXX XXXX`). If the existing customer record contains an unspaced number (`+947XXXXXXXX`), exact matching fails and creates a duplicate customer.
  5. **Orphaned `invoiceDraft`**: `ConvertDealModal` allows creating an `invoiceDraft` text string that is saved to the lead/deal doc, but is never linked to the real `invoices` collection or `QuotationBuilder.jsx`.
  6. **`jobNo` Collision Risk**: `jobNo` is generated as `PTF-${String(Date.now()).slice(-4)}`, which rolls over every 10,000ms (10 seconds), creating collision risk during concurrent usage.

---

### Trigger 5: 75% Advance / 25% Final Invoice & Receipt Lifecycle

* **Trigger Sequence**:
  - `5a`: Quotation Accepted $\rightarrow$ "75% Advance Invoice" in `QuotationBuilder.jsx` $\rightarrow$ `onSaveInvoice` (`App.jsx:L339`).
  - `5b`: Deal Completion / QA Pass / Manual click $\rightarrow$ "25% Final Settlement" in `QuotationBuilder.jsx`.
  - `5c`: Invoice marked Paid $\rightarrow$ `handleMarkInvoicePaid` (`App.jsx:L470`).
  - `5d`: User clicks "Generate Receipt" on Paid invoice $\rightarrow$ `handleGenerateReceipt` (`App.jsx:L392`).
* **Findings**:
  1. **Stage Advancement Disconnect (Critical Break)**:
     - Generating a 75% Advance invoice in `QuotationBuilder.jsx` **does not update `lead.stage` to `"75% Invoice Submitted"`**.
     - In `App.jsx:L505`, marking an Advance invoice as Paid checks:
       ```javascript
       const newStage = (isAdvance && targetLead.stage === '75% Invoice Submitted') ? 'Received' : targetLead.stage;
       ```
     - If the user did not manually drag the card to `"75% Invoice Submitted"` on the Kanban board prior to marking the invoice paid, `targetLead.stage === '75% Invoice Submitted'` is `false`. The lead **never auto-advances to `"Received"`**, stalling the pipeline.
  2. **Dead Kanban Badges (`invoiceGenerated` & `invoicePaid`)**:
     - `Leads.jsx:L89` & `L226` check `lead.invoiceGenerated` and `lead.invoiceDate` to display an `Inv: <Date>` badge. **`invoiceGenerated` is never written anywhere in the codebase.** The badge never renders.
     - `Leads.jsx:L87` checks `lead.invoicePaid` to display a green "Paid" badge. In `App.jsx:L511`, `invoicePaid: true` is only written when `isFullyPaid` is true (requiring **both** Advance and Final invoices to exist and be Paid). While in the Leads pipeline, no Final invoice exists, so `lead.invoicePaid` is never set, and the Kanban card never shows the "Paid" badge even after the 75% Advance invoice is paid.
  3. **Quotation Status Not Updated**: Converting a quote to an invoice in `QuotationBuilder.jsx` leaves the quotation status as `'Accepted'` instead of advancing to `'Invoiced'`.
  4. **Premature Final Invoice Generation**: `QuotationBuilder.jsx:L626-L639` allows generating the "25% Final Settlement" invoice directly inside an unconverted Lead modal if the quotation is Accepted.
  5. **Single-Doc Update Flaw in `handleMarkInvoicePaid`**: `handleMarkInvoicePaid` updates only the document matching `leadId`. If marked on a converted Deal, the original Lead document is not updated; if marked on the Lead, the Deal is not updated.

---

### Trigger 6: Partner Referral to Commission

* **Trigger**: Public referral submission (`ReferralForm.jsx`) $\rightarrow$ Full invoice payment cleared (`App.jsx`) $\rightarrow$ Partner payout calculation (`Partners.jsx`).
* **Findings**:
  1. **Premature Commission Payout Eligibility in `Partners.jsx` (Critical Break)**:
     - In `Partners.jsx:L278`:
       ```javascript
       } else if (paymentStatus === '100% Fully Settled' || lead.referralStatus === 'Eligible for Payout' || lead.stage === 'Delivered' || lead.stage === 'Completed') {
         commState = 'Eligible for Payout';
       }
       ```
     - When a lead is converted to a deal, `handleConvertConfirm` sets the original lead's `stage: 'Completed'`.
     - `Partners.jsx` queries `leads` without filtering out `convertedToDeal: true`.
     - Because `lead.stage === 'Completed'`, the converted original lead **immediately flips to `'Eligible for Payout'` upon conversion**, before any work has commenced or full payment has cleared.
     - Both the original Lead and the new Deal appear as duplicate referrals for that partner.

---

### Trigger 8: Other Cross-Module Writes & Logistics

* **Findings**:
  1. **Logistics UI Guard Mismatch**:
     - `docs/02_modules/leads/README.md` states `LeadCardDetails.jsx` contains the logistics trigger.
     - In code, `LeadCardDetails.jsx:L1666` guards the logistics card behind `{(isDeal || lead.isDeal) && ...}`.
     - For Leads, the logistics UI inside `LeadCardDetails` is hidden. Logistics pickup jobs for Leads can only be created via the Kanban card button in the `"75% Invoice Submitted"` column (`Leads.jsx:L142-L152`).

---

## 4. Pricing Engine & Quotation Value Synchronization

* **Files**: `pricingEngine.js`, `QuotationBuilder.jsx`, `LeadCardDetails.jsx`.
* **Findings**:
  1. **Quotation Grand Total vs `lead.value` Disconnect**:
     - Saving a quotation in `QuotationBuilder.jsx:L120-L165` writes `grandTotal` and line items to `COLLECTIONS.QUOTATIONS`.
     - It **never updates `lead.value` in `COLLECTIONS.LEADS`**.
     - If line items are added or modified in `QuotationBuilder`, `quotation.grandTotal` diverges from `lead.value`. The Kanban board and pipeline metrics continue to display the stale `lead.value`.
  2. **Hardcoded 15% Agent Discount in `pricingEngine.js`**:
     - In `pricingEngine.js:L59`, a 15% agent discount (`g = h * 0.15`) is hardcoded into `calculateCost` across all tiers.
     - `finalAmount` is always returned net of this discount, even for direct retail clients where no agent commission or discount applies.
  3. **Manual Overrides Diverge from `pricingMetadata`**:
     - If the user modifies `Total Contract Value` or `Gross Volume` in `LeadCardDetails.jsx:L1381-L1404`, `formData.pricingMetadata` is not updated. When AI quotation itemization runs, it relies on the stale `pricingMetadata`.

---

## 5. Backend Proxy & AI Models (`api/generate.js` vs `vite.config.js`)

* **Files**: `api/generate.js`, `vite.config.js`, `src/services/gemini.js`.
* **Findings**:
  1. **Model Identifier Discrepancy**:
     - Production `api/generate.js:L6-L12` lists `CANDIDATE_MODELS = ['gemini-3.6-flash', 'gemini-3-flash-preview', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro']`.
     - `gemini-3.6-flash` is not an official public Gemini API model identifier and always results in a 404 fallback.
     - Dev server proxy (`vite.config.js:L188`) hardcodes `gemini-3.7-flash` and does not enforce ID token verification or active user status.

---

## 6. Firestore Rules & Security

* **Files**: `firestore.rules`, `src/context/PermissionsContext.jsx`.
* **Findings**:
  1. **Unused `/deals` Rules Block**:
     - `firestore.rules:L130-L135` defines `match /deals/{dealId}` with permissions for `pipeline`.
     - Because Deals are stored in `COLLECTIONS.LEADS`, all Firestore operations for Deals evaluate `match /leads/{leadId}` (`checkPermission('leads', ...)`).
     - The `/deals` rule block is dead rules. If an Admin gives a user role access to `pipeline` but sets `leads: none()`, that user will be blocked by Firestore rules from reading Deals.

---

## 7. Resolved Decisions

All ambiguities were presented to the product owner and resolved as follows:

| # | Topic | Decision | Impact |
|---|---|---|---|
| A1 | **Advance Invoice Stage Transition** | **Manual — by design.** Generating an Advance invoice does NOT auto-advance the lead stage. The user must drag the Kanban card to `"75% Invoice Submitted"` manually. Future enhancement: add Firestore triggers / rules to automate stage movement. | No immediate code change. Document in CLAUDE.md as intentional. |
| A2 | **Partner Referral Payout Gating** | **Commission eligibility triggers only upon Deal completion**, not when the original lead is set to `Completed` on conversion. While the converted Deal is in progress, commission state must remain `Pending`. `Partners.jsx` must filter out records where `convertedToDeal: true` and evaluate eligibility from the active Deal's lifecycle only. | **Bug fix required** — see §8, Action B. |
| A3 | **Kanban Invoice & Paid Badges** | **By design — accepted.** The 75% advance is a hard business rule: no lead ever converts to a Deal without the advance being fully paid. `lead.invoicePaid` is only `true` at full settlement (both Advance + Final invoices paid), which is a post-Deal-completion state. The Kanban badge is architecturally correct by this logic. `invoiceGenerated` is dead code; if re-enabled, it should read from the real `invoices` array. | No change to badge logic. Dead `invoiceGenerated` badge can be removed in cleanup. |
| A4 | **Audio Compression / Downsampling Policy** | **Always downsample — never reject.** All compressed formats (MP3, M4A, AAC, OGG, WEBM) over 3.2MB must also be passed through `downsampleAudio` rather than sent raw. Silent discard of a call recording is unacceptable — every call is recorded exclusively through the app's lead-card recorder; there is no other source. The 413 risk is a known limitation until the downsampling path covers compressed formats. | **Bug fix required** — see §8, Action D. |
| A5 | **Customer Order Counting** | **Only upon Deal conversion.** `handleSaveLeadDetails` must NOT create a customer record or increment `orders`. Customer creation and the `orders` increment happen only inside `handleConvertConfirm`. | **Bug fix required** — see §8, Action E. |
| A6 | **Lead Value vs Quotation Sync** | **Fix: sync `lead.value` with `grandTotal`.** When a quotation is saved in `QuotationBuilder.jsx:handleSave`, additionally call `updateDocument(COLLECTIONS.LEADS, leadDocId, { value: grandTotal })` to keep pipeline metrics in sync with the quoted value. | **Bug fix required** — see §8, Action F. |
| A7 | **Stage Requirement for Deal Conversion** | **Restrict to `'Received'` stage.** The "Convert to Deal" button in the `LeadCardDetails.jsx` modal footer must only render / be actionable when `lead.stage === 'Received'`, matching the Kanban board rule. | **Bug fix required** — see §8, Action G. |

---

## 8. Next Implementation Actions

### ✅ By Design — No Code Change

| Item | Notes |
|---|---|
| A1 — Manual stage transitions | Document explicitly in `CLAUDE.md`. Future: Firestore trigger / rules for automation. |
| A3 — Kanban badge logic | Badge correctly reflects full settlement only. Optionally remove dead `invoiceGenerated` field read from `Leads.jsx:L89`. |

### 🐛 Actionable Bug Fixes (priority order)

**Action G — Stage-gate "Convert to Deal" button** *(A7 — High, prevents wrong conversions)*
- File: `src/features/leads/LeadCardDetails.jsx:L1727`
- Change: Wrap the "Convert to Deal" button render condition to include `&& lead.stage === 'Received'`.

**Action F — Sync `lead.value` on quote save** *(A6 — High, pipeline metric accuracy)*
- File: `src/features/quotations/QuotationBuilder.jsx:handleSave (~L120–166)`
- Change: After saving to `COLLECTIONS.QUOTATIONS`, call `updateDocument(COLLECTIONS.LEADS, leadDocId, { value: grandTotal })`.

**Action E — Remove premature customer creation** *(A5 — High, data integrity)*
- File: `src/features/leads/Leads.jsx:handleSaveLeadDetails (~L451–473)`
- Change: Remove the customer auto-create block from `handleSaveLeadDetails`. Customer record must only be created inside `handleConvertConfirm`.

**Action B — Fix partner commission eligibility gating** *(A2 — High, financial correctness)*
- File: `src/components/crm/Partners.jsx:L278`
- Change: Add a filter so that `leads` where `convertedToDeal === true` do not trigger `'Eligible for Payout'` based on their `stage`. Eligibility must be derived from the active Deal document (found by matching `originalLeadId`) reaching `Completed` stage and full payment cleared.

**Action D — Downsample all oversized audio formats** *(A4 — Medium, data loss prevention)*
- File: `src/features/leads/LeadCardDetails.jsx:processAudioFile (~L333)`
- Change: Remove the `!isAlreadyCompressed` guard on the size check so that compressed formats (MP3, M4A, AAC, OGG, WEBM) over `MAX_PAYLOAD_RAW_SIZE` (3.2MB) are also passed through `downsampleAudio` before Base64 encoding.

### 🔧 Additional Findings (non-blocking, address in follow-up)

| Action | File | Change |
|---|---|---|
| Remove dead `/deals` Firestore rules block | `firestore.rules:L130–135` | Delete or comment out the `match /deals/{dealId}` block. |
| Fix dead "Convert" button in Completed column | `src/features/leads/Leads.jsx:L155–173` | Remove or correct the "Convert" button rendered for leads with `stage === 'Completed'` that already have `convertedToDeal: false`. |
| Fix `jobNo` collision risk | `src/features/leads/Leads.jsx:handleConvertConfirm` | Replace `Date.now().slice(-4)` with a Firestore counter transaction or UUID prefix. |
| Add audit logging to Lead create/edit/convert | `Leads.jsx:handleAddNewLead`, `handleSaveLeadDetails`, `handleConvertConfirm` | Call `logActivity(...)` after each state-changing write. |
| Fix model identifier | `api/generate.js:L8` | Remove `'gemini-3.6-flash'` (invalid); replace with a valid current model ID. |
| Document `counters` collection in CLAUDE.md | `docs/02_modules/leads/CLAUDE.md` | Add `counters/invoice_advance`, `counters/invoice_final` to the "Firestore Collections Written" list. |
