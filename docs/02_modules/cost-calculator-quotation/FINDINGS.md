# Cost Calculator & Quotation Module Review & Correctness Audit Findings

> **Scope**: Correctness review of `docs/02_modules/cost-calculator-quotation/CLAUDE.md`, `docs/02_modules/cost-calculator-quotation/README.md`, `docs/01_architecture/CROSS_MODULE_TRIGGERS.md`, and decision record `docs/05_decisions/0001-why-quotation-engine-is-custom.md`.  
> **Branch / Worktree**: `review-cost-calculator-quotation` (`.worktrees/review-cost-calculator-quotation`)  
> **Status**: Review & Audit findings (no functional code modified).

---

## 1. Executive Summary

A deep-trace correctness audit was performed across the **Cost Calculator & Quotation** module implementation files:
- **Module Documentation**: `docs/02_modules/cost-calculator-quotation/README.md`, `docs/02_modules/cost-calculator-quotation/CLAUDE.md`, `docs/01_architecture/CROSS_MODULE_TRIGGERS.md`, `docs/05_decisions/0001-why-quotation-engine-is-custom.md`.
- **Target UI Components**: `src/components/tools/CostCalculator.jsx` (standalone calculator tool), `src/components/crm/QuotationBuilder.jsx` (embedded structured quote builder), `src/components/crm/LeadCardDetails.jsx` (embedded calculator & quotation wrapper).
- **Services & Pricing Engine**: `src/services/pricingEngine.js` (five-tier pricing model), `src/services/gemini.js` (`generateStructuredQuotation`, `generateQuotation`, `generateAdvanceInvoice`).
- **Integration Surfaces**: `src/App.jsx` (`quotations` subscription, `handleSaveInvoice`), `src/shared/utils/entityUtils.js` (`matchesEntity`), `src/utils/invoiceTemplate.js` (invoice printing), `src/components/crm/Deals.jsx`, `src/components/operations/FabricationWorks.jsx`, `firestore.rules`.

### Key Findings Summary:
1. **Critical Mathematical Bug in Profit Analysis**: `pricingEngine.js` computes `internalCostPerSq` using `q = (b + r + c + f) / sqFt` (adding logistics, QA, and sales commission back into gross profit). In `CostCalculator.jsx:L345`, this is rendered with the label **"Profit / SQ"**, resulting in a calculated profit per sq ft that is **higher than the actual retail selling price per sq ft** (e.g., displaying Rs. 339.82 Profit/SqFt on a Rs. 299.82 Net Rate/SqFt).
2. **Catastrophic Print Template Double-Discounting**: `invoiceTemplate.js:L242` scales line items by `0.25` for Final invoices to compensate for quotes storing 100% item totals. However, when `Deals.jsx:L357` generates a Final invoice without a linked quote, it puts `unitPrice: finalAmount` (already 25%). The template multiplies this by `0.25` again, rendering the line item at **6.25% of the total deal value**.
3. **Quotation Versioning State Desynchronization**: In `QuotationBuilder.jsx:L168-L207`, clicking "Clone to v{N}" creates a new version doc in Firestore, but fails to update the component's `activeQuote` state. Subsequent edits execute an update on the **previous** version doc instead of the new version.
4. **Volatile Google Drive Attachments**: Files selected via `GoogleDrivePickerModal` in `QuotationBuilder.jsx` are stored solely in component `useState` and are omitted from `payload` in `handleSave`. They vanish upon modal close or page refresh.
5. **Cross-Module Pipeline Stalls**: Generating a 75% Advance invoice in `QuotationBuilder.jsx` does not advance `lead.stage` to `'75% Invoice Submitted'`. As a result, subsequent payment clearance in `App.jsx` fails to trigger the automated transition to `'Received'`, stalling the CRM workflow.
6. **Triple Final Invoice Redundancy**: Final settlement invoices can be created independently from `QuotationBuilder.jsx` (manual), `Deals.jsx` (deal completion), and `FabricationWorks.jsx` (QA pass), with no deduplication or check for existing invoices across modules.
7. **Security & RBAC Gap**: `firestore.rules` grants open `read, write: if isAuthenticated()` on `/quotations/{quotationId}`. No RBAC permissions (`checkPermission('quotations', ...)`) exist, and `PermissionsContext` omits quotations entirely.

---

## 2. Review of Module Documentation

### 2.1 `docs/02_modules/cost-calculator-quotation/CLAUDE.md`

| Section / Claim | Code Status | Details / Discrepancy |
|---|---|---|
| **What it does** ("An Accepted quotation produces the 75% Advance invoice.") | **Partially Accurate** | QuotationBuilder also contains a manual handler for generating the **25% Final Settlement invoice** directly from an Accepted quotation (`QuotationBuilder.jsx:L261-L305`), not just the 75% Advance invoice. |
| **Firestore Collections Written** ("Owns `quotations`... Writes `invoices` and `auditLog` through `handleSaveInvoice`.") | **Incomplete** | Omits the `counters` collection. When `handleConvertToAdvanceInvoice` and `handleConvertToFinalInvoice` run, they execute atomic transactions on `counters/invoice_advance` and `counters/invoice_final` via `generateInvoiceId` (`src/services/firestoreSync.js:L312`). |
| **Triggers and side effects** ("AI draft: `generateStructuredQuotation` -> `/api/generate`.") | **Accurate** | Confirmed: Invokes Gemini with pricing metadata and scope, returning a JSON array of line items. |
| **Triggers and side effects** ("Advance invoice needs status `Accepted`; the 75 / 25 split is computed here at `QuotationBuilder.jsx` 89-90.") | **Accurate** | Confirmed: `advanceDue = grandTotal * 0.75; balanceDue = grandTotal * 0.25;`. |
| **Before you edit** ("Pricing constants (118.5 manufacturing per sq ft, tier table, 53.5 commission, 15% discount) live in `pricingEngine.js`.") | **Accurate** | Confirmed in `pricingEngine.js:L1-L47, L59`. |
| **Before you edit** ("`cutListEngine.js` and `FrameBlueprintPreview.jsx` belong to Fabrication; `companyInfo.js` is unused.") | **Accurate** | Confirmed: `companyInfo.js` is never imported in `src/`. `cutListEngine.js` and `FrameBlueprintPreview.jsx` are exclusively imported by `FabricationWorks.jsx`. |
| **Before you edit** ("`quotations` rules allow any authenticated user to read and write; there is no `quotations` permission module.") | **Accurate** | Confirmed in `firestore.rules:L138-L140` and `PermissionsContext.jsx`. |

### 2.2 `docs/02_modules/cost-calculator-quotation/README.md`

| Section / Claim | Code Status | Details / Discrepancy |
|---|---|---|
| **Files and Folders** ("`src/components/tools/CostCalculator.jsx`: standalone page... No Firestore access.") | **Accurate** | Confirmed: It is an isolated calculator tool (`tab === 'calculator'`) with local state only. |
| **Files and Folders** ("`src/services/gemini.js`: `generateStructuredQuotation`, `generateQuotation` (markdown variant)...") | **Partially Accurate** | `generateQuotation` (markdown) and `generateAdvanceInvoice` are defined in `gemini.js` but are **dead code** (never imported or called anywhere in `src/`). Only `generateStructuredQuotation` is used. |
| **Files and Folders** ("`src/constants/emailTemplates.js` (quotation templates)") | **Misleading** | While `EMAIL_TEMPLATES` contains `quote_submission` and `quote_followup`, no email sending functionality is wired into `QuotationBuilder.jsx`, `CostCalculator.jsx`, or `LeadCardDetails.jsx`. |
| **Firestore collections** ("`auditLog (INVOICE_CREATED only; there is no quotation-specific audit entry)`") | **Accurate** | Neither quotation creation, update, version cloning, nor status changes are logged to `auditLog`. |
| **Summary** ("`determineTier` picks one of five bands (<=50, <=70, <=100, <=150, 150+ sq ft)...") | **Accurate** | Confirmed in `pricingEngine.js:L85-L92`. |

### 2.3 `docs/05_decisions/0001-why-quotation-engine-is-custom.md`

- **Status**: Currently a stub document marked *TBD*.
- **Findings**: The rationale for a custom pricing and quotation engine stems from domain-specific requirements:
  1. Box-iron steel framing BOM calculations based on surface area brackets (tiers 0–50, 50–70, 70–100, 100–150, 150+ sq ft).
  2. Fixed workshop overheads (Logistics and QA step costs) blended with variable per-sq-ft manufacturing rates.
  3. Strict milestone billing structure (75% mobilization advance / 25% final settlement upon handover).
  4. Specialized Sinhala/English conversational scope extraction feeding Gemini auto-itemization.

---

## 3. Cross-Module Triggers & Architectural Tracing

### Trigger 1: Audio Scope Analysis Pre-filling Dimensions

* **Documented Behavior (`CROSS_MODULE_TRIGGERS.md`)**:
  - *"Gemini returns JSON... frame height / width. Fields are applied to the form state only when the user clicks apply (`applyAudioAnalysisToScope`)... Downstream: Leads...; Cost calculator (height / width prefill)"*.
* **Code Trace & Findings**:
  1. **Component Target Mismatch**:
     - `CROSS_MODULE_TRIGGERS.md` implies the standalone `CostCalculator.jsx` receives the dimensions.
     - In reality, `CostCalculator.jsx` has zero connection to audio analysis or Firestore; its dimensions are hardcoded (`length = 10, height = 5`).
     - Only the embedded calculator inside `LeadCardDetails.jsx` receives `calcHeight` and `calcLength` (`LeadCardDetails.jsx:L670-L675`).
  2. **Unenforced Apply Step**:
     - Extracting dimensions updates `calcHeight` and `calcLength`, which recomputes `calcSqFt` and `activePricing` in local state.
     - However, unless the user clicks `"Apply Calculator Results to Lead Quotation"` (`applyPricingToLead` at `LeadCardDetails.jsx:L1117`), the calculated value is **not** written to `formData.value` or `formData.pricingMetadata`.
     - Saving the lead without clicking that button leaves `lead.value` stale.
  3. **Input Asymmetry Bug (Lock Bypass)**:
     - In `LeadCardDetails.jsx:L1083`, Length is disabled when locked:
       ```javascript
       disabled={dimensionsLocked && currentUser?.role !== 'Admin'}
       ```
     - In `LeadCardDetails.jsx:L1090-L1097`, the Height input **lacks the `disabled` attribute entirely**.
     - Non-admin users cannot edit Length once locked, but can freely modify Height, altering the area and tier while Length remains frozen.

---

### Trigger 3: Copying Quotation Line Items into 25% Final Invoices via `matchesEntity`

* **Documented Behavior (`CROSS_MODULE_TRIGGERS.md`)**:
  - *"Deal moved from Hand Over to Completed (`Deals.jsx`)... creates a 25% Final invoice (`deal.value * 0.25`...), linked to the quotation via `matchesEntity`, copying its line items."*
* **Code Trace & Findings**:
  1. **Unsorted First-Match Flaw (`Deals.jsx:L334`)**:
     ```javascript
     const linkedQuote = (quotations || []).find(q => matchesEntity(q, deal));
     ```
     - Firestore document arrays are unordered by default.
     - If multiple quotation versions exist (v1 Draft, v2 Rejected, v3 Accepted), `.find()` returns the **first arbitrary document** matching the entity.
     - It does **not** sort by version (`version DESC`) nor does it verify `status === 'Accepted'`. An obsolete draft can be linked to the final invoice instead of the accepted quote.
  2. **Line Item Sum vs Invoice Amount Inflation**:
     - In `QuotationBuilder.jsx`, line items reflect **100% of the contract value**.
     - When `Deals.jsx:L356` copies `linkedQuote.lineItems` into the Final invoice, the invoice header indicates `amount: deal.value * 0.25`, but the copied line items still sum to 100% of the project value.
  3. **Catastrophic Double-Discounting in Print Rendering (`invoiceTemplate.js:L242`)**:
     - To compensate for the line item sum mismatch, `invoiceTemplate.js` silently scales each line item amount during print:
       ```javascript
       (Number(item.qty || 1) * Number(item.unitPrice || 0) * (isFinal ? 0.25 : 0.75))
       ```
     - **The Failure Mode**: If a Deal completes without a linked quotation, `Deals.jsx:L357` provides a fallback item:
       ```javascript
       lineItems: [
         { description: deal.jobScope || "...", qty: 1, unit: "job", unitPrice: finalAmount, taxPct: 0, discountPct: 0 }
       ]
       ```
       Here, `finalAmount` is **already 25% of `deal.value`**.
     - When this invoice is printed, `invoiceTemplate.js` multiplies `unitPrice` by `0.25` **again**:
       $$\text{Printed Line Amount} = \text{deal.value} \times 0.25 \times 0.25 = \text{deal.value} \times 0.0625$$
     - A 25% final settlement invoice for Rs. 100,000 prints with a line item of **Rs. 6,250** (6.25%).
  4. **Ignored Tax and Discount in Print Template**:
     - `invoiceTemplate.js:L242` ignores `item.discountPct` and `item.taxPct`. Any item-level adjustments made in `QuotationBuilder` disappear when printed.

---

### Trigger 5a: Manual "75% Advance Invoice" from Accepted Quotation

* **Documented Behavior (`CROSS_MODULE_TRIGGERS.md`)**:
  - *"User clicks '75% Advance Invoice' (needs quotation status `Accepted`) -> `QuotationBuilder.jsx` -> `onSaveInvoice` -> `INV-ADV-####`, amount = 75% of the grand total, `quotationId`, copied line items"*.
* **Code Trace & Findings**:
  1. **Pipeline Stall / Lead Stage Disconnect**:
     - Generating an Advance invoice in `QuotationBuilder.jsx:L209-L260` saves an invoice to `invoices`, but **does not update `lead.stage` to `'75% Invoice Submitted'`**.
     - In `App.jsx:L505`, marking an invoice paid checks:
       ```javascript
       const newStage = (isAdvance && targetLead.stage === '75% Invoice Submitted') ? 'Received' : targetLead.stage;
       ```
     - If staff generate the invoice but do not manually drag the Kanban card to `'75% Invoice Submitted'`, marking the invoice Paid fails to auto-advance the lead to `'Received'`. The lead stalls in Intake or Processing.
  2. **Quotation Status Never Advances to `'Invoiced'`**:
     - After generating the Advance invoice, the quotation status remains `'Accepted'` (`QuotationBuilder.jsx:L255`).
     - Although `'Invoiced'` is defined in `STATUS_STYLES` (`QuotationBuilder.jsx:L27`), no code path ever sets this status.
  3. **Unawaited Async Save & Premature Success Toast**:
     - In `QuotationBuilder.jsx:L235-L256`:
       ```javascript
       onSaveInvoice({ ... });
       toast.success('75% Advance invoice generated & linked!');
       ```
     - `onSaveInvoice` is an asynchronous function in `App.jsx`, but is called **without `await`**.
     - `toast.success` fires immediately before Firestore confirms document creation. If the Firestore write fails, the user is presented with a false-positive success message.

---

### Trigger 5b: Manual "25% Final Settlement" Invoice

* **Documented Behavior (`CROSS_MODULE_TRIGGERS.md`)**:
  - *"Deal completes or fabrication passes QA or user clicks '25% Final Settlement' -> chains 3 and 4, or `QuotationBuilder.jsx` -> `INV-FIN-####`, amount = 25% of the value"*.
* **Code Trace & Findings**:
  1. **Premature Final Invoice Generation in Leads**:
     - In `QuotationBuilder.jsx:L607-L639`, when a quote is `Accepted`, both buttons are rendered:
       - `"75% Advance Invoice"`
       - `"25% Final Settlement"`
     - A sales rep can click `"25% Final Settlement"` directly from an early-stage Lead modal before work has started and before the Advance invoice has been paid.
  2. **Triple Final Invoice Collision Risk**:
     - A Final invoice can be created from three distinct surfaces:
       1. `QuotationBuilder.jsx:L261` (Manual click)
       2. `Deals.jsx:L333` (Moving deal to Completed)
       3. `FabricationWorks.jsx:L724` (Passing workshop QA)
     - `Deals.jsx` and `FabricationWorks.jsx` do **not** verify whether a Final invoice already exists for that entity before generating a new `INV-FIN-####`.
     - If an operator passes QA in FabricationWorks and an account manager moves the deal to Completed in Deals, **two duplicate 25% Final settlement invoices are created**.

---

## 4. Pricing Calculations & Formula Analysis

### 4.1 Mathematical Breakdown (`pricingEngine.js`)

The pricing engine implements a five-tier pricing model based on square footage:

```javascript
// Pricing tiers in src/services/pricingEngine.js
"0-50":   { manufRate: 118.5, logistics: 2000, qa: 2000, costSalesRate: 53.5, profitMargin: 0.3997, internalManufRate: 40 }
"50-70":  { manufRate: 118.5, logistics: 2000, qa: 2000, costSalesRate: 53.5, profitMargin: 0.4000, internalManufRate: 40 }
"70-100": { manufRate: 118.5, logistics: 3000, qa: 4000, costSalesRate: 53.5, profitMargin: 0.3672, internalManufRate: 40 }
"100-150":{ manufRate: 118.5, logistics: 3000, qa: 4000, costSalesRate: 53.5, profitMargin: 0.3793, internalManufRate: 40 }
"150+":   { manufRate: 118.5, logistics: 3000, qa: 4000, costSalesRate: 53.5, profitMargin: 0.3793, internalManufRate: 40 }
```

The calculation steps in `calculateCost(tier, sqFt)`:
1. Direct Manufacturing Cost: $s = \text{sqFt} \times 118.5$
2. Fixed Overheads: $r = \text{logistics}$ (2000 or 3000), $c = \text{qa}$ (2000 or 4000)
3. Direct Sales Commission: $f = \text{sqFt} \times 53.5$
4. Total Direct Cost Base: $m = s + r + c + f$
5. Profit & Overhead Markup: $x = m \times \text{profitMargin}$
6. Gross Estimate: $h = m + x$
7. Agent Discount (15%): $g = h \times 0.15$
8. Net Final Payable: $w = h - g$
9. Net Rate per SqFt: $N = w / \text{sqFt}$

### 4.2 Formula Inconsistencies & Anomalies

#### 1. Severe Calculation Error: "Profit / SQ" ($q$)
In `pricingEngine.js:L62-L66`:
```javascript
const C = sqFt * o.internalManufRate; // sqFt * 40
const T = sqFt * o.costSalesRate;     // sqFt * 53.5
const _ = C + T;                      // COGS
const b = w - _;                      // Gross Profit = Revenue w - COGS _
const q = (b + r + c + f) / sqFt;     // Internal Cost per Sq ???
```
In `CostCalculator.jsx:L345-L349`, this $q$ value is displayed as:
```jsx
<MetricLabel>Profit / SQ</MetricLabel>
<span className="font-mono font-extrabold text-emerald-400 text-base">
  {ct(pricing.internalCostPerSq)}
</span>
```

**Analysis of the Mathematical Error**:
- $b$ is the true Gross Profit ($w - C - T$).
- By calculating $q = (b + r + c + f) / \text{sqFt}$, the formula adds Fixed Logistics ($r$), Fixed QA ($c$), and Commission ($f$) **back into Gross Profit**, and then divides by square footage.
- **Concrete Example (50 Sq Ft, Tier 0–50)**:
  - Manufacturing ($s$): $50 \times 118.5 = 5,925$
  - Logistics ($r$): $2,000$
  - QA ($c$): $2,000$
  - Commission ($f$): $50 \times 53.5 = 2,675$
  - Direct Base ($m$): $12,600$
  - Markup ($x$ @ 39.97%): $5,036.22$
  - Gross Total ($h$): $17,636.22$
  - Discount ($g$ @ 15%): $2,645.43$
  - **Net Payable ($w$)**: **Rs. 14,990.79**
  - **Net Selling Rate ($N$)**: **Rs. 299.82 / SqFt**
  - COGS: $50 \times 40 + 50 \times 53.5 = 4,675$
  - True Gross Profit ($b$): $14,990.79 - 4,675 = \text{Rs. } 10,315.79$
  - True Profit / SqFt: $10,315.79 / 50 = \text{Rs. } 206.32 \text{ / SqFt}$
  - **Engine's $q$ Calculation**:
    $$q = \frac{10,315.79 + 2,000 + 2,000 + 2,675}{50} = \frac{16,990.79}{50} = \mathbf{Rs.\ 339.82\ / SqFt}$$
- **Result**: The UI tells the user that Profit per SqFt is **Rs. 339.82**, which is **Rs. 40.00 higher than the total selling price of Rs. 299.82 / SqFt**. This is an impossible financial metric.

#### 2. Inflexible 15% Discount Baked into Base Function
- In `pricingEngine.js:L59-L60`, a 15% discount is hardcoded into `calculateCost`.
- All quotations calculated by the engine apply this discount automatically.
- Direct retail customers who are not eligible for discounts receive the discounted price, with no parameter to adjust or disable the discount.

#### 3. Hardcoded 53.5 Commission vs Dynamic Partner Rates
- In `pricingEngine.js`, `costSalesRate` is hardcoded to `53.5`.
- In `Partners.jsx:L254`, partners can have custom commission rates (e.g., Rs. 75/SqFt or Rs. 100/SqFt).
- `pricingEngine.calculateCost(tier, sqFt)` does not accept a custom commission rate parameter. Pricing estimates cannot reflect agreed partner commission rates.
- Conversely, for direct non-referral leads, a 53.5 LKR/sqft commission is still factored into the client quote and internal cost model.

---

## 5. UI Component & Synchronization Deep Dive

### 5.1 `QuotationBuilder.jsx`

#### 1. Version Cloning State Desynchronization Bug (`handleNewVersion`)
- `handleNewVersion` (`L168-L207`) adds a new quotation document to Firestore with `version: newVer`.
- It sets `status: 'Draft'` and `isEditing: true`, but **fails to set `activeQuote`** to the newly created version.
- In `QuotationBuilder.jsx:L77-L85`:
  ```javascript
  React.useEffect(() => {
    if (latestQuote && !activeQuote) {
      setActiveQuote(latestQuote);
      ...
    }
  }, [latestQuote, activeQuote]);
  ```
  Because `activeQuote` is already set (pointing to the prior version), this `useEffect` guard evaluates to `false`.
- When the user finishes editing and clicks `"Update Saved Quotation"`, `handleSave` checks:
  ```javascript
  if (activeQuote?._firestoreId || activeQuote?.id) {
    const docId = activeQuote._firestoreId || activeQuote.id;
    await updateDocument(COLLECTIONS.QUOTATIONS, docId, payload);
  }
  ```
  It executes an update against the **old version doc**, overwriting history rather than updating the cloned version.

#### 2. Volatile Google Drive Attachments
- `QuotationBuilder.jsx:L71` defines `const [attachedFiles, setAttachedFiles] = useState([]);`.
- The `GoogleDrivePickerModal` attaches files into this local state array.
- In `handleSave` (`L128-L143`) and `handleNewVersion` (`L178-L197`), `attachedFiles` is **omitted from the Firestore payload**.
- When the modal is closed or refreshed, all attached Google Drive file references are permanently lost.

#### 3. Quotation Grand Total vs `lead.value` Disconnection
- When staff edit line items in `QuotationBuilder.jsx`, `grandTotal` is computed and saved to `COLLECTIONS.QUOTATIONS`.
- `handleSave` does **not** update `lead.value` in `COLLECTIONS.LEADS`.
- As a consequence:
  - The Leads Kanban board card displays the stale `lead.value`.
  - CRM pipeline conversion metrics reflect the old lead value.
  - When converted to a Deal (`Leads.jsx:L476`), the Deal inherits `deal.value = lead.value`, ignoring the updated quotation total.

#### 4. Weak Collision-Prone Quotation ID Generation
- `QuotationBuilder.jsx:L151, L177` generates IDs using:
  ```javascript
  const newId = `QT-${String(Date.now()).slice(-6)}`;
  ```
- Taking the last 6 digits of a millisecond timestamp rolls over every $1,000,000\text{ ms} \approx 16.6\text{ minutes}$.
- Because `addDocument` uses Firestore `setDoc` under the hood when a custom ID is provided, an ID collision silently overwrites existing quotation records.
- Unlike invoices (`generateInvoiceId` via `counters`), quotations do not use atomic sequential counters.

#### 5. Dead Table Inputs (Tax & Discount)
- `mkItem()` initializes `taxPct: 0` and `discountPct: 0`.
- The line items table (`QuotationBuilder.jsx:L450-L534`) provides inputs only for `description`, `qty`, `unit`, and `unitPrice`.
- Users cannot input or edit tax or discount percentages from the UI.

---

## 6. Services & Integration Deep Dive

### 6.1 `src/services/gemini.js`

1. **Dead Exported Functions**:
   - `generateQuotation` (markdown quote generator, lines 91–149): Never imported or used.
   - `generateAdvanceInvoice` (lines 200–233): Never imported or used.
2. **`generateStructuredQuotation` Disconnects**:
   - Lines 158–167 construct the prompt context using `pricing`.
   - The prompt instructs: *"The sum of (qty*unitPrice) for all items must equal the Final Net Payable"*.
   - However, the prompt does not explain that `Final Net Payable` reflects a 15% discount off the gross estimate. Gemini frequently struggles to balance line items to the discounted net figure while retaining realistic individual item costs.

### 6.2 `firestore.rules` & `PermissionsContext.jsx`

1. **Unrestricted Quotations Collection**:
   - `firestore.rules:L138-L140`:
     ```
     match /quotations/{quotationId} {
       allow read, write: if isAuthenticated();
     }
     ```
   - Any authenticated user (including external customers or unverified accounts) can read, create, update, or delete quotation records directly via the Firestore SDK.
2. **Missing Module Permissions in RBAC**:
   - `PermissionsContext.jsx` defines permissions for `calculator: full()`, but has **no entry for `quotations`**.
   - There is no granular control (view, create, edit, delete) for quotation documents in either the client UI or Firestore security rules.
3. **Dead Rules Block (`match /pricing/{docId}`)**:
   - `firestore.rules:L194-L197` defines rules for `/pricing/{docId}`.
   - No `pricing` collection exists or is accessed anywhere in the codebase. All pricing configuration is hardcoded in `pricingEngine.js`.

---

## 7. Structured Decision Points & Resolutions

> [!IMPORTANT]
> **All 12 open decisions below were accepted by the project owner on 2026-09-20.**
> No further stakeholder input is required before implementation. Each proposed resolution is now the agreed implementation target.

| # | Item / Feature | Current Implementation | Risk / Ambiguity | Accepted Decision | Status |
|---|---|---|---|---|---|
| **1** | **Profit / SQ Calculation** | `q = (b + r + c + f) / sqFt` in `pricingEngine.js:L66`; displayed as "Profit / SQ" | Displays mathematically impossible profit exceeding selling price (e.g. Rs. 339.82 profit on Rs. 299.82 sale). | Change formula to $b / \text{sqFt}$ (true Gross Profit per SqFt), or rename metric to "Revenue Less Direct Mfg / SQ". | ✅ ACCEPTED |
| **2** | **Hardcoded 15% Discount** | Baked directly into `pricingEngine.calculateCost` for all calculations. | Direct retail clients automatically receive a 15% discount with no toggle or override. | Make discount an optional parameter: `calculateCost(tier, sqFt, discountPct = 0)`. | ✅ ACCEPTED |
| **3** | **Commission Rate Inflexibility** | Fixed at 53.5 LKR/sq ft in `pricingEngine.js`. | Ignores custom partner commission rates and penalizes non-partner direct sales. | Allow `calculateCost` to accept an optional `commissionRate` parameter, defaulting to 0 for direct leads and partner rate for referrals. | ✅ ACCEPTED |
| **4** | **Final Invoice Line Item Scaling** | `invoiceTemplate.js:L242` multiplies items by 0.25 on print. | Fallback items in `Deals.jsx` get multiplied twice, resulting in a printed value of 6.25% of deal value. | Remove print-time scaling; ensure invoice creation generates line items whose `unitPrice * qty` strictly matches the invoice milestone amount. | ✅ ACCEPTED |
| **5** | **Lead Stage on Advance Invoice** | Advance invoice generation leaves `lead.stage` unchanged. | Payment clearance in `App.jsx` only advances stage if already `'75% Invoice Submitted'`. Workflow stalls. | Automatically advance `lead.stage` to `'75% Invoice Submitted'` when the 75% Advance invoice is saved. | ✅ ACCEPTED |
| **6** | **Quotation Versioning State Bug** | `handleNewVersion` does not update `activeQuote`. | Subsequent edits overwrite the prior version in Firestore instead of saving to the cloned version. | Update `activeQuote` immediately upon version creation and fix `useEffect` dependency guard. | ✅ ACCEPTED |
| **7** | **Google Drive File Persistence** | Files attached via picker modal remain in component `useState`. | Attached artwork / engineering specs are lost when modal is closed. | Include `attachedFiles` array in the Firestore payload saved to `COLLECTIONS.QUOTATIONS`. | ✅ ACCEPTED |
| **8** | **Quotation Grand Total vs `lead.value`** | Quotation edits update `quotations.grandTotal` but not `lead.value`. | Kanban cards and deal conversions use stale initial lead values rather than quoted amounts. | Automatically sync `lead.value = quotation.grandTotal` upon quotation save. | ✅ ACCEPTED |
| **9** | **Quotation ID Generation** | Uses `QT-${String(Date.now()).slice(-6)}`. | Rolls over every 16.6 minutes; collisions silently overwrite quotation documents. | Migrate quotation IDs to atomic sequential counters via `generateAtomicId('QT', 4)` in `counters/quotations`. | ✅ ACCEPTED |
| **10** | **Quotation Status Lifecycle** | Quotation remains `'Accepted'` after invoicing; `'Invoiced'` is unreachable. | Inability to filter or identify invoiced quotes from active quotes. | Transition quotation status to `'Invoiced'` upon successful generation of the 75% Advance invoice. | ✅ ACCEPTED |
| **11** | **Final Invoice Access in Leads** | `"25% Final Settlement"` button active in Lead modal on `'Accepted'`. | Final invoices can be generated prematurely before advance payment or deal creation. | Restrict `"25% Final Settlement"` generation to Deals or require verified payment of the Advance invoice. | ✅ ACCEPTED |
| **12** | **Quotation Security & RBAC** | Open `read, write` to all authenticated users in Firestore rules. | Non-staff users (e.g. Customers/Partners) can read or modify company quotations. | Add `quotations` to `checkPermission` in `firestore.rules` and configure role access in `PermissionsContext.jsx`. | ✅ ACCEPTED |
