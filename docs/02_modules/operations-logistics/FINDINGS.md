# Operations: Logistics Module Review & Correctness Audit Findings

> **Scope**: Comprehensive correctness audit of `docs/02_modules/operations-logistics/CLAUDE.md`, `docs/02_modules/operations-logistics/README.md`, and all cross-module triggers touching Logistics in `docs/01_architecture/CROSS_MODULE_TRIGGERS.md`.  
> **Branch / Worktree**: `review-operations-logistics` (`.worktrees/review-operations-logistics`)  
> **Status**: Review & Audit findings (no functional code modified).

---

## 1. Executive Summary

A systematic deep-trace audit was conducted across the Operations: Logistics module and its cross-module integration surfaces:
- **Module Documentation**: `docs/02_modules/operations-logistics/CLAUDE.md`, `docs/02_modules/operations-logistics/README.md`, `docs/01_architecture/CROSS_MODULE_TRIGGERS.md`.
- **Target UI Components**: `src/components/operations/Logistics.jsx`, `src/components/operations/LogisticsCardDetails.jsx`.
- **Engines & Utilities**: `src/utils/logisticsEngine.js` (`FLEET_VEHICLES`, `DRIVER_DIRECTORY`, `calculateCODFromInvoices`, `formatDispatchMessage`, `getGoogleMapsUrl`, `getWhatsAppUrl`).
- **Integration & Dispatch Surfaces**: `src/App.jsx` (`logisticsJobs` subscription & state handlers, RBAC routing), `src/components/operations/FabricationWorks.jsx` (`handleDispatchToLogistics`), `src/components/crm/Deals.jsx` (`handleCreateDeliveryJob`), `src/features/leads/Leads.jsx` (`handleCreateLogisticsJob`), `src/features/leads/LeadCardDetails.jsx`, `src/features/dashboard/Dashboard.jsx`, and `firestore.rules`.
- **Backend Services**: `api/generate.js` (AI proxy endpoint).

### Key Audit Discoveries:
1. **AI Route Optimization Fails 100% with HTTP 401 Unauthorized**:
   `Logistics.jsx` (`callAIInsights`, L400-416) issues a raw `fetch('/api/generate')` without an `Authorization: Bearer <idToken>` header. Because `api/generate.js` strictly requires an authenticated and approved session, the endpoint rejects every request with HTTP 401. As a result, the feature catches the failure and silently falls back to a static hardcoded text string on every invocation. The user never receives dynamic route optimization.
2. **Critical RBAC / Security Rules Disconnect: Logistics Role Cannot Read Invoices**:
   In `PermissionsContext.jsx`, the `Logistics` role is configured with `invoices: none()`. In `firestore.rules`, the `/invoices/{invoiceId}` read rule requires `checkPermission('invoices', 'view')` or `read`. When a user with the `Logistics` role logs in, `subscribeToCollection(COLLECTIONS.INVOICES)` in `App.jsx` is rejected by Firestore rules with permission-denied. Consequently, `invoices` is empty (`[]`), causing `calculateCODFromInvoices` to report zero balance and no invoices. The UI displays "Settled" or "NO INVOICE ALLOCATED IN DATABASE", leaving delivery drivers completely blind to outstanding Cash on Delivery balances.
3. **Inconsistent ID Generation & Collision Hazards Across Dispatch Entrypoints**:
   While `Logistics.jsx` and `FabricationWorks.jsx` use transactional sequential counter reservation via `generateAtomicId('L-DL')` / `generateAtomicId('L-PK')`, `Deals.jsx` and `Leads.jsx` generate IDs using non-atomic timestamp slicing (`L-DL-${String(Date.now()).slice(-6)}`), bypassing counter safety and risking document overwrite collisions.
4. **Severe Cross-Module Schema Mismatches**:
   - **Phone Field**: `Logistics.jsx` and `LogisticsCardDetails.jsx` look for `customerPhone`. `Deals.jsx` stores `phone`, while `FabricationWorks.jsx` and `Leads.jsx` omit the phone field entirely. Consequently, 1-Tap calling is hidden on Kanban cards and 1-Tap WhatsApp messages open without a recipient phone number.
   - **Job Lineage**: `Deals.jsx` omits `linkedJobNo` (failing to pass `deal.jobNo`), breaking direct job number linking for COD invoice calculations and card display badges.
   - **Fleet Assignment**: All three external dispatchers (`Deals.jsx`, `Leads.jsx`, `FabricationWorks.jsx`) set driver and vehicle to empty/undefined strings without prompting the dispatcher.
5. **False "All Invoices Settled" COD Risk on Incomplete Billing**:
   `calculateCODFromInvoices` calculates balance due strictly as the sum of existing unpaid invoices. If an order was dispatched to logistics after the 75% Advance was paid but *before* the 25% Final Settlement invoice was generated, `hasUnpaid` evaluates to `false` and balance evaluates to `0`. The modal and printable Gate Pass Waybill announce "ALL INVOICES SETTLED — NO CASH TO COLLECT" / "PAID / NO COLLECTION", risking accidental release of goods without collecting the final 25% balance.
6. **Isolated Module Lifecycle & Absence of Completion Handlers**:
   Completing a delivery in Logistics updates only `endTime` and `duration` on the `logistics` document. It does not update linked Fabrication projects (`dispatchedToLogistics` remains a static boolean, and the project never reflects delivery completion), does not update Deals stages, and provides no interface to record COD payment or mark invoices as Paid.

---

## 2. Review of Module Documentation

### 2.1 `docs/02_modules/operations-logistics/CLAUDE.md`

| Section / Claim | Code Status | Verification Details & Discrepancies |
|---|---|---|
| **What it does** ("Kanban of pickup and delivery jobs (Pending, In Transit, Completed) with COD from invoices, Maps links and manual WhatsApp notify.") | **Accurate** | Confirmed: Three-column Kanban board (`Pending`, `In Transit`, `Completed`) with Pickup (`L-PK`) and Delivery (`L-DL`) sub-tabs. COD is computed from `invoices`, Maps opens Google Maps search, and WhatsApp alert opens `wa.me`. |
| **Firestore collections it owns or writes** ("Owns `logistics` (ids `L-DL-…` / `L-PK-…`). Created also by Deals, Leads and Fabrication buttons.") | **Partially Accurate** | `logistics` is the owned collection. However, ID formats differ: `Logistics.jsx` and `FabricationWorks.jsx` generate atomic IDs (`L-DL-0001`), whereas `Deals.jsx` and `Leads.jsx` generate timestamp-sliced IDs (`L-DL-XXXXXX` / `L-PK-XXXXXX`). |
| **Triggers and side effects** ("All status changes and job creation are manual.") | **Accurate** | Confirmed: All creations require manual clicks (form or external buttons). Stage moves require user drag-and-drop or column arrow buttons. No automated Firestore triggers exist. |
| **Triggers and side effects** ("AI route suggestion via `/api/generate` (hardcoded hub).") | **Broken in Implementation** | While code targets `/api/generate`, it omits authentication bearer tokens, causing HTTP 401 rejections and falling back to a static hardcoded string. Real AI suggestion is non-functional. |
| **Triggers and side effects** ("No effect on deals or projects when Completed.") | **Accurate** | Confirmed: Transition to `Completed` writes only `{ status: "Completed", endTime, duration }` to `COLLECTIONS.LOGISTICS`. No downstream writes to `projects` or `leads`. |
| **Before you edit** ("`DRIVER_DIRECTORY`, `FLEET_VEHICLES` and the route hub are hardcoded in code.") | **Accurate** | Confirmed: Defined as static arrays in `src/utils/logisticsEngine.js`. Route hub `"Kadawatha Central Hub"` is hardcoded in `Logistics.jsx:L414` and `L607`. |
| **Before you edit** ("`AddressPickerModal` / Maps JS API are used by Customers, not Logistics.") | **Accurate** | Confirmed: `Logistics.jsx` and `LogisticsCardDetails.jsx` do not import or use `AddressPickerModal`. Navigation uses plain URL generation via `getGoogleMapsUrl`. |

### 2.2 `docs/02_modules/operations-logistics/README.md`

| Section / Claim | Code Status | Verification Details & Discrepancies |
|---|---|---|
| **Files and folders** ("`Logistics.jsx`: Kanban... add-job form, AI route suggestion.") | **Accurate** | Confirmed: Lines 1–1023 implement the board, modal wrapper for new tasks, and AI route trigger. |
| **Files and folders** ("`LogisticsCardDetails.jsx`: job detail modal: COD calculation, WhatsApp notify, Maps link, print.") | **Accurate** | Confirmed: Supports invoice display, waybill printing, official invoice printing, WhatsApp dispatch, and Maps search. |
| **Firestore collections read/written** ("Ids from `generateAtomicId('L-DL' \| 'L-PK')`.") | **Discrepancy** | Only true for `Logistics.jsx` and `FabricationWorks.jsx`. Dispatches from `Deals.jsx` and `Leads.jsx` use `Date.now().slice(-6)`. |
| **Firestore collections read/written** ("`FabricationWorks.jsx` writes `dispatchedToLogistics` / `logisticsTaskId` to `projects` when it dispatches.") | **Accurate** | Confirmed in `FabricationWorks.jsx:L554-L559`. However, `Deals.jsx` does not flag the deal with any dispatch metadata. |
| **Cloud Functions / triggers** ("Pending to In Transit stamps `startTime`; In Transit to Completed stamps `endTime` and `duration`; moving back clears them.") | **Accurate** | Confirmed in `Logistics.jsx:L512-L575` (`handleMoveJob`, `handleMoveJobBack`) and `L357-L377` (`handleDrop`). |
| **Computation** ("only `calculateCODFromInvoices` (balance due from `invoices`).") | **Accurate** | Confirmed: Sums unpaid matched invoices. No custom delivery freight or mileage pricing engine exists. |
| **Google Maps** ("deep links only in Logistics (`getGoogleMapsUrl`)... No Distance Matrix or Directions usage.") | **Accurate** | Confirmed: Generates Google Maps place search links. No Directions API or waypoints calculation. |
| **Customer notification** ("manual WhatsApp click-to-chat; sets `notified: true` and `lastNotifiedAt`.") | **Discrepancy** | Clicking 1-Tap WhatsApp on the Kanban card (`Logistics.jsx:L212-235`) does **not** update `notified` or `lastNotifiedAt`. It is only set in component state inside `LogisticsCardDetails.jsx:L143-147`, and only persisted to DB if the user subsequently clicks "Save Updates". |

---

## 3. Cross-Module Triggers Audit (`CROSS_MODULE_TRIGGERS.md`)

### Trigger 8: Manual Dispatch to Logistics

Cross-Module Trigger 8 states:
> *"Fabrication 'Dispatch to Logistics' (manual) creates a `logistics` task and flags the project; Deals and Leads have their own manual create-job buttons. Completing a logistics job changes nothing else."*

Code audit confirms four distinct manual entrypoints for creating records in `COLLECTIONS.LOGISTICS`:

```
                               ┌────────────────────────────────────────┐
                               │     Logistics Module Creation          │
                               │  (Logistics.jsx: handleAddJob)         │
                               │  • Uses generateAtomicId(L-DL / L-PK)  │
                               │  • Sets driver, vehicle, customerPhone │
                               └──────────────────┬─────────────────────┘
                                                  │
┌───────────────────────────────┐                 │                ┌───────────────────────────────┐
│   Fabrication Works Module    │                 │                │          Deals Module         │
│  (FabricationWorks.jsx: L522) │                 │                │       (Deals.jsx: L412)       │
│  • Uses generateAtomicId(L-DL)│                 │                │  • Uses Date.now().slice(-6)  │
│  • Sets linkedJobNo           │                 │                │  • Sets dealId & leadId       │
│  • Flags project doc          │                 ▼                │  • Missing linkedJobNo        │
│  • Missing customerPhone      │      ┌────────────────────┐      │  • Sets phone (wrong key)     │
└──────────────┬────────────────┘      │    COLLECTIONS.    │      └───────────────┬───────────────┘
               │                       │     LOGISTICS      │                      │
               └──────────────────────►│    (Firestore)     │◄─────────────────────┘
                                       └──────────▲─────────┘
                                                  │
                                       ┌──────────┴────────────────────┐
                                       │          Leads Module         │
                                       │       (Leads.jsx: L676)       │
                                       │  • Uses Date.now().slice(-6)  │
                                       │  • Sets leadId                │
                                       │  • Missing customerPhone      │
                                       │  • Missing linkedJobNo        │
                                       └───────────────────────────────┘
```

#### Detailed Comparison Across Creation Points:

| Property / Behavior | Direct in `Logistics.jsx` (`handleAddJob`) | From `FabricationWorks.jsx` (`handleDispatchToLogistics`) | From `Deals.jsx` (`handleCreateDeliveryJob`) | From `Leads.jsx` (`handleCreateLogisticsJob`) |
|---|---|---|---|---|
| **Trigger Action** | "New Task" form in Logistics Kanban | "Dispatch to Logistics" button on Completed project card | "Deliver" button on Ready To Load / Hand Over deal card, or "Dispatch Delivery" in `LeadCardDetails` | Red Truck button on Kanban card in "75% Invoice Submitted" stage |
| **ID Scheme** | `generateAtomicId('L-DL' / 'L-PK')` $\rightarrow$ `L-DL-0001` | `generateAtomicId('L-DL')` $\rightarrow$ `L-DL-0002` | `L-DL-${Date.now().slice(-6)}` (Non-atomic) | `L-PK-${Date.now().slice(-6)}` (Non-atomic) |
| **Type** | User-selected: `Delivery` or `Pickup` | Fixed: `Delivery` | Fixed: `Delivery` | Fixed: `Pickup` |
| **Sub-Type** | User-selected (e.g. `Finished Steel Frame`, `Printed Canvas`) | Fixed: `Finished Steel Frame` | Fixed: `Framed Works / Finished Goods` | Fixed: `Material/Flex` |
| **Customer Name** | `form.customer` or `"Direct Customer"` | Customer name lookup or `job.customerName` | `deal.name` or `"Direct Customer"` | `lead.name` |
| **Phone Number** | `form.customerPhone` | **Omitted** (neither `job.phone` nor customer phone saved) | `phone: deal.phone` (**Wrong key**: expects `customerPhone`) | **Omitted** (ignores `lead.phone`) |
| **Job Number Link** | `form.linkedJobNo` | `job.jobNo` | **Omitted** (ignores `deal.jobNo`) | **Omitted** |
| **Entity Lineage** | None (`leadId`/`dealId` not attached) | None (`leadId`/`dealId` not attached) | `dealId: deal.id`, `leadId: deal.originalLeadId \|\| deal.id` | `leadId: lead.id` |
| **Fleet Assignment** | Defaults: Sunil (`Sunil (Driver)`) & Lorry (`WP GE 1234`) | `driver: ""`, `vehicle: ""` | Omitted (`undefined`) | Omitted (`undefined`) |
| **Priority** | User-selected (default `Standard`) | Omitted (`undefined`) | Omitted (`undefined`) | Omitted (`undefined`) |
| **Source Doc Flag** | N/A | Sets `dispatchedToLogistics: true`, `logisticsTaskId: deliveryId` on `projects` | None (deal document unmodified) | None (lead document unmodified) |
| **In-Memory State Sync** | `setJobs([newJob, ...jobs])` | **None** (`setLogisticsJobs` is not passed to `FabricationWorks`) | `setLogisticsJobs(prev => [newJob, ...prev])` | `setLogisticsJobs(prev => [newJob, ...prev])` |

---

### Completion Side-Effects Audit

Code trace of `Logistics.jsx` (L357–377, L524–536) when moving a job to `"Completed"`:
```javascript
const endTime = new Date();
const startTime = job.startTime ? new Date(job.startTime) : endTime;
const diffMs = endTime - startTime;
const hours = Math.floor(diffMs / 3600000);
const mins = Math.round((diffMs % 3600000) / 60000);
updates.endTime = endTime.toISOString();
updates.duration = `${hours}h ${mins}m`;
```
1. **Firestore Write Scope**: The write is targeted exclusively at `COLLECTIONS.LOGISTICS` (`updateDocument(COLLECTIONS.LOGISTICS, id, updatedJob)`).
2. **Fabrication Project Decoupling**: The linked `projects` document is never updated. Even after delivery is completed, `project.dispatchedToLogistics` remains `true`, and `project.status` remains in whatever state it was previously in (usually "Completed" in Fabrication). The fabrication team has no visual indication that the item was successfully received by the client.
3. **Deal Stage Decoupling**: The linked deal is never transitioned. For example, if a deal was in "Ready To Load" or "Hand Over", completing delivery does not move the deal to "Completed", nor does it trigger Trigger 3 (Final invoice reservation and commission accrual).
4. **Billing Decoupling**: If COD cash was collected by the driver, no invoice in `invoices` is updated to status `"Paid"`, and no receipt is generated in `receipts`. The accounting department must manually discover and mark the invoice paid in another module.

---

### Automated Dispatch Audit

`CROSS_MODULE_TRIGGERS.md` (L100-102) notes:
> *"Not found (searched, absent): Any Firestore trigger; automatic logistics creation on stage change..."*

Verification results:
1. **Deal Progression**: Moving a deal forward in `Deals.jsx` (`handleMoveForwardInner`) from "Waiting" $\rightarrow$ "Fabricating" $\rightarrow$ "Ready To Load" $\rightarrow$ "Hand Over" $\rightarrow$ "Completed" **never** automatically creates a logistics job. A delivery job is only created if the user manually clicks the "Deliver" quick-action button on the card or inside `LeadCardDetails`.
2. **Fabrication Progression**: Passing QA or moving a project to "Completed" in `FabricationWorks.jsx` **never** automatically dispatches to logistics. It requires an operator to click the green truck icon on the card.
3. **Lead Progression**: Moving a lead to "75% Invoice Submitted" or "Received" **never** automatically schedules a pickup job.

---

## 4. In-Depth Technical & Architectural Findings

### 4.1 Broken Authentication on AI Route Optimization

- **Location**: `src/components/operations/Logistics.jsx:L400-L416` (`callAIInsights`)
- **Vulnerability / Flaw**:
  ```javascript
  const callAIInsights = async (prompt) => {
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      if (response.ok) {
        const data = await response.json();
        return data.text;
      }
    } catch (err) {
      console.error(err);
    }
    return "Kadawatha Hub -> Peliyagoda -> Central Colombo Route recommended for traffic efficiency.";
  };
  ```
- **Root Cause**:
  `api/generate.js` (L51-55) enforces server-side authentication:
  ```javascript
  const authHeader = req.headers.authorization || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) {
    return res.status(401).json({ error: 'Missing Authorization bearer token' });
  }
  ```
  `Logistics.jsx` calls `fetch('/api/generate')` without an `Authorization` header. Every request returns HTTP 401. `response.ok` is always false, triggering the catch block and returning the static fallback string.
- **Architectural Disconnect**:
  `src/services/gemini.js` exists specifically to handle Firebase ID token extraction (`auth.currentUser.getIdToken()`) and proxy requests to `/api/generate`. `Logistics.jsx` bypassed the service layer with an ad-hoc unauthenticated fetch.

---

### 4.2 Security Rules vs. RBAC Matrix Disconnect: Logistics Role Blind to Invoices

- **Location**:
  - `src/context/PermissionsContext.jsx:L60-L65` (`DEFAULT_PERMISSIONS.Logistics`)
  - `firestore.rules:L150-L154` (`match /invoices/{invoiceId}`)
  - `src/App.jsx:L320` (`subscribeToCollection(COLLECTIONS.INVOICES, setInvoices)`)
- **Code Trace**:
  1. In `PermissionsContext.jsx`:
     ```javascript
     Logistics: {
       dashboard: read(), notifications: full(), messages: full(),
       leads: none(), pipeline: none(), customers: read(), partners: none(),
       invoices: none(), receipts: none(), projects: read(), logistics: ops(),
       agents: none(), calculator: none(), admin: none(),
     }
     ```
  2. In `firestore.rules`:
     ```javascript
     match /invoices/{invoiceId} {
       allow read: if checkPermission('invoices', 'view') || checkPermission('invoices', 'read') || ...
     }
     ```
  3. When an employee with role `Logistics` opens the ERP:
     - `App.jsx` attempts to initialize real-time listeners for all collections, including `subscribeToCollection(COLLECTIONS.INVOICES)`.
     - Firestore evaluates the collection query against the rules. Because `Logistics` has `invoices: { view: false, read: false }`, Firestore rejects the subscription with `FirebaseError: Missing or insufficient permissions`.
     - `invoices` state in `App.jsx` remains `[]`.
  4. In `Logistics.jsx` and `LogisticsCardDetails.jsx`:
     - `calculateCODFromInvoices(invoices, ...)` receives an empty array.
     - No invoices match; `hasUnpaid` is false; `totalBalanceDue` is 0.
     - Drivers logging into their portal see every job marked as "Settled" or "NO INVOICE ALLOCATED IN DATABASE", with zero cash to collect.

---

### 4.3 Premature "All Settled" Status & Substring Matching in COD Engine

- **Location**: `src/utils/logisticsEngine.js:L127-L218` (`calculateCODFromInvoices`)
- **Critical Issues**:
  1. **Premature "Settled" Status When Final Invoice Not Yet Created**:
     - The COD balance is computed solely as the sum of existing unpaid invoices:
       ```javascript
       const unpaidInvoices = matched.filter(inv => {
         const status = String(inv.status || 'Unpaid').toLowerCase();
         return status !== 'paid' && status !== 'cancelled' && status !== 'void';
       });
       const totalBalanceDue = unpaidInvoices.reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0);
       ```
     - In the Print To Frame workflow, the 75% Advance invoice is created at order confirmation, while the 25% Final Settlement invoice is generated much later (at Deal Hand Over $\rightarrow$ Completed or Fabrication QA pass).
     - If a project is finished in fabrication, passes QA without generating an invoice, or is dispatched before the deal is marked Completed, only the 75% Advance invoice exists in Firestore.
     - Because the 75% Advance invoice is already "Paid", `unpaidInvoices` is empty.
     - The function returns `{ hasUnpaid: false, totalBalanceDue: 0, matchedInvoices: [advanceInvoice] }`.
     - In `LogisticsCardDetails.jsx:L360-L364`, because `matchedInvoices.length > 0` and `!hasUnpaid`, the modal prominently displays:
       `"ALL INVOICES SETTLED — NO CASH TO COLLECT"`.
     - In `printWaybill` (`LogisticsCardDetails.jsx:L253-256`), the printed Gate Pass Waybill prints:
       `"PAID / NO COLLECTION"`.
     - **Real-World Business Impact**: A driver delivers a finished steel frame, sees the green "Settled" status and printed Gate Pass, and hands over the goods without collecting the remaining 25% cash from the customer.
  2. **"Direct Customer" Substring Matching Cross-Contamination**:
     - Step 2 of invoice matching in `calculateCODFromInvoices`:
       ```javascript
       if (matched.length === 0 && cleanCustName) {
         matched = invoices.filter(inv => {
           const invCust = String(inv.customerName || inv.company || '').trim().toLowerCase();
           ...
           return invCust && (invCust === cleanCustName || invCust.includes(cleanCustName) || cleanCustName.includes(invCust));
         });
       }
       ```
     - `"Direct Customer"` is the fallback default name across `Logistics.jsx:L472`, `Deals.jsx:L419`, and `FabricationWorks.jsx:L531`.
     - If a job has no linked job number and defaults to `"Direct Customer"`, it matches **all** invoices in the system that have `customerName: "Direct Customer"` or empty job numbers.
     - Furthermore, loose bidirectional `includes()` allows unrelated customer names to collide (e.g. "Art" matching "Art Gallery Colombo" or "Smart Designs").

---

### 4.4 Disparate ID Generation Schemes: Transactional Counters vs. Timestamp Slicing

- **Location**:
  - `src/components/operations/Logistics.jsx:L462`
  - `src/components/operations/FabricationWorks.jsx:L525`
  - `src/components/crm/Deals.jsx:L413`
  - `src/features/leads/Leads.jsx:L677`
- **Tracing**:
  - `Logistics.jsx`: `await generateAtomicId(jobPrefix)` $\rightarrow$ uses Firestore transaction on `counters/{prefix}`.
  - `FabricationWorks.jsx`: `await generateAtomicId('L-DL')` $\rightarrow$ uses Firestore transaction on `counters/L-DL`.
  - `Deals.jsx`: ``const jobId = `L-DL-${String(Date.now()).slice(-6)}`;`` $\rightarrow$ non-atomic timestamp slice.
  - `Leads.jsx`: ``const jobId = `L-PK-${String(Date.now()).slice(-6)}`;`` $\rightarrow$ non-atomic timestamp slice.
- **Flaws & Hazards**:
  - `String(Date.now()).slice(-6)` repeats every $1,000,000$ ms ($\approx 16.6$ minutes).
  - In `firestoreSync.js:L117`, `addDocument(collection, data, customId)` executes `setDoc(doc(db, collectionName, customId), docData)`.
  - If two dispatches occur with the same sliced timestamp or if the counter loops, `setDoc` **silently overwrites** the previous delivery job in Firestore without error.
  - Leads and Deals bypass the centralized atomic sequence mechanism built specifically for the ERP.

---

### 4.5 Dispatch Notification & Phone Key Disconnects

- **Location**:
  - `src/components/operations/Logistics.jsx:L194-L248`
  - `src/components/operations/LogisticsCardDetails.jsx:L126-L150`
  - `src/utils/logisticsEngine.js:L55-L62` (`getWhatsAppUrl`)
- **Discrepancies**:
  1. **Kanban Card WhatsApp Button Does Not Update Notification State**:
     - `Logistics.jsx` (L212-235) renders a quick-action WhatsApp button on every card.
     - Clicking it constructs the message and invokes `window.open(url, '_blank')`.
     - It does **not** call `updateDocument` or update local state to set `job.notified = true` or `job.lastNotifiedAt`.
     - Consequently, the bell indicator (`job.notified && <Bell size={11} ... />`) never illuminates when alerts are sent from the board.
  2. **Card Details Notification State Not Persisted Immediately**:
     - Inside `LogisticsCardDetails.jsx:L143-L147`, `handleSendWhatsAppAlert` calls `setFormData(prev => ({ ...prev, notified: true, lastNotifiedAt: now }))`.
     - It only updates component local state. If the user closes the modal without clicking "Save Updates", the notification timestamp is discarded.
  3. **Broken Recipient Phone Numbers from Cross-Module Dispatches**:
     - When dispatched from `Deals.jsx`, phone is saved under key `phone` instead of `customerPhone`.
     - When dispatched from `FabricationWorks.jsx` or `Leads.jsx`, phone is omitted entirely.
     - On the Kanban card, `job.customerPhone` is undefined.
     - Result 1: The 1-Tap Call button (`{job.customerPhone && <a href="tel:..." />}`) is completely hidden.
     - Result 2: The 1-Tap WhatsApp button passes `undefined` to `getWhatsAppUrl`.
     - `cleanPhoneNumber(undefined)` returns `""`.
     - `getWhatsAppUrl` falls back to `https://wa.me/?text=...` without a phone number, forcing the user to manually select a contact inside WhatsApp.

---

### 4.6 Lack of In-Logistics Payment Settlement and Receipt Issuance

- **Location**: `src/components/operations/LogisticsCardDetails.jsx:L344-L451`
- **Issue**:
  - Delivery drivers are the primary employees collecting cash on delivery (COD) across Sri Lankan field deliveries.
  - In `LogisticsCardDetails.jsx`, the modal displays matched invoices and has a "Print" button.
  - However, there is no button or handler to:
    - Mark the invoice as "Paid" (`handleMarkInvoicePaid`).
    - Issue an official payment receipt (`handleGenerateReceipt`).
    - Record whether payment was collected in Cash or Bank Transfer.
  - To record payment, the staff must exit Logistics, navigate to Invoices or Deals, locate the invoice, and mark it paid.

---

### 4.7 Hardcoded Fleet & Geographic Data

- **Location**:
  - `src/utils/logisticsEngine.js:L11-L22` (`FLEET_VEHICLES`, `DRIVER_DIRECTORY`)
  - `src/components/operations/Logistics.jsx:L414, L607`
- **Issue**:
  - `DRIVER_DIRECTORY`: Hardcoded list of 4 drivers (`Saman`, `Kamal`, `Sunil`, `Nimal`) with mock `077` phone numbers.
  - `FLEET_VEHICLES`: Hardcoded list of 3 vehicles (`WP GE 1234`, `WP LH 5678`, `WP XZ 9012`).
  - Neither list pulls from Firestore (`users`, `employees`, or a `fleet` collection). New drivers or vehicles cannot be added via User Management or Admin settings.
  - Route optimization prompt is hardcoded to `"Kadawatha Central Hub is the starting point."` even if operations dispatch from another location.

---

### 4.8 Optimistic Updates Without Rollback & Swallowed Errors

- **Location**: `src/components/operations/Logistics.jsx:L346-L398` (`handleDrop`), `L512-L547` (`handleMoveJob`), `L549-L575` (`handleMoveJobBack`), `L577-L591` (`handleDeleteConfirm`)
- **Tracing**:
  - When a job is moved forward (`handleMoveJob`) or backward (`handleMoveJobBack`):
    - React state is immediately updated via `setJobs(prev => prev.map(...))`.
    - `updateDocument(COLLECTIONS.LOGISTICS, ...)` is awaited inside a try/catch.
    - If Firestore rejects the write (e.g. offline, security rule denial):
      - The error is logged to `console.error(err)`.
      - **No error toast is displayed to the user.**
      - **No rollback of the React state is performed.**
    - The card appears in the new stage in the UI, misleading the operator into believing the task was updated on the server.

---

### 4.9 Dead Security Rule for Customer Delivery Tracking

- **Location**: `firestore.rules:L187-L191`
- **Code**:
  ```javascript
  match /logistics/{logId} {
    allow read: if checkPermission('logistics', 'view') || checkPermission('logistics', 'read') 
      || (isAuthenticated() && resource.data.customerId == request.auth.token.email);
    ...
  }
  ```
- **Flaw**:
  - The security rule explicitly attempts to allow customers to view their own deliveries if `resource.data.customerId == request.auth.token.email`.
  - However, none of the 4 job creation paths (`Logistics.jsx`, `FabricationWorks.jsx`, `Deals.jsx`, `Leads.jsx`) ever set `customerId`.
  - `customerId` is permanently missing on all `logistics` documents. As a result, signed-in customers attempting to view their delivery status will always be denied access by security rules.

---

### 4.10 Google Maps Deep-Link Limitation

- **Location**: `src/utils/logisticsEngine.js:L29-L32` (`getGoogleMapsUrl`)
- **Code**:
  ```javascript
  export function getGoogleMapsUrl(location) {
    if (!location || !location.trim()) return '';
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.trim())}`;
  }
  ```
- **Observation**:
  - Code comments and UI buttons refer to this as "turn-by-turn navigation" or "Open in Google Maps".
  - The URL format `maps/search/?api=1&query=...` performs a text search on Google Maps. It does not initiate turn-by-turn directions from the current GPS location or from the Kadawatha hub.
  - A directions intent (`https://www.google.com/maps/dir/?api=1&destination=...`) would be required for genuine 1-tap mobile navigation for fleet drivers.

---

## 5. Resolved Decisions

> **Status**: All 8 decision points below have been **accepted** by the project owner on 2026-09-20. The recommended approach for each item is now the authoritative implementation target. No further approval is required before coding begins.

| # | Topic / Area | Decision Accepted | Resolution | Files to Change |
|---|---|---|---|---|
| **D-1** | **Fixing AI Route Optimization Auth** | ✅ ACCEPTED | Refactor `callAIInsights` in `Logistics.jsx` to use the centralized `callProxy` from `src/services/gemini.js` (or import token-aware helper). This automatically attaches `Authorization: Bearer ${idToken}`, satisfying the security check in `api/generate.js` and restoring real dynamic multi-stop Gemini route sequence generation. | `src/components/operations/Logistics.jsx` (`callAIInsights`), `src/services/gemini.js` |
| **D-2** | **Logistics Role Permissions for Invoices** | ✅ ACCEPTED | In `PermissionsContext.jsx`, grant `invoices: read()` to the `Logistics` role in `DEFAULT_PERMISSIONS` (e.g. `{ view: true, read: true, create: false, edit: false, delete: false, export: false }`). Update `firestore.rules` if necessary so the real-time `invoices` listener does not fail with permission-denied, enabling drivers and logistics staff to view outstanding COD invoice balances. | `src/context/PermissionsContext.jsx` (`DEFAULT_PERMISSIONS.Logistics`), `firestore.rules` (`match /invoices/{invoiceId}`) |
| **D-3** | **Unifying Cross-Module Dispatch Schema** | ✅ ACCEPTED | Standardize dispatch payload across all entrypoints (`Deals.jsx`, `Leads.jsx`, `FabricationWorks.jsx`): (1) Enforce sequential transaction ID reservation via `generateAtomicId('L-DL')` / `generateAtomicId('L-PK')`. (2) Use standard key `customerPhone` instead of `phone`. (3) Always attach `linkedJobNo` (from `deal.jobNo` or `job.jobNo`) and entity IDs (`dealId`, `leadId`). (4) Ensure default priority `"Standard"` and timestamp `createdAt` are populated. | `src/components/crm/Deals.jsx` (`handleCreateDeliveryJob`), `src/features/leads/Leads.jsx` (`handleCreateLogisticsJob`), `src/components/operations/FabricationWorks.jsx` (`handleDispatchToLogistics`) |
| **D-4** | **Preventing Premature "Settled" COD Balance Display** | ✅ ACCEPTED | Enhance `calculateCODFromInvoices`: When matched invoices contain only a paid 75% Advance invoice and no Final invoice exists yet, inspect the linked entity/quotation total value. If total order value exceeds paid amounts, return status `"Final Invoice Pending"` with `hasUnpaid: true` or a dedicated warning state. Update `LogisticsCardDetails.jsx` and `printWaybill` so it displays *"Pending 25% Settlement Invoice Creation"* rather than falsely announcing *"ALL INVOICES SETTLED — NO CASH TO COLLECT"* or printing *"PAID / NO COLLECTION"*. | `src/utils/logisticsEngine.js` (`calculateCODFromInvoices`), `src/components/operations/Logistics.jsx`, `src/components/operations/LogisticsCardDetails.jsx` (display & waybill template) |
| **D-5** | **Delivery Completion Downstream Side-Effects** | ✅ ACCEPTED | Maintain the core stage isolation (no direct auto-advancing of deal stages), but update `projects` upon delivery state transitions. When a delivery task moves to `"In Transit"` or `"Completed"`, update the linked project's delivery status (e.g. `deliveryStatus: 'in_transit' | 'delivered'` or update `dispatchedToLogistics: 'Delivered'`) so fabrication operators can see on their Kanban cards whether client handover succeeded. | `src/components/operations/Logistics.jsx` (`handleMoveJob`, `handleDrop`), `src/components/operations/FabricationWorks.jsx` (display card delivery badge) |
| **D-6** | **In-Field COD Payment Recording** | ✅ ACCEPTED | Add an authorized "Record Cash Collection" action inside `LogisticsCardDetails.jsx` for delivery jobs with outstanding COD. When confirmed by the driver/dispatcher, invoke `onMarkInvoicePaid` and generate an official receipt via `onGenerateReceipt` (or pass these handlers via `App.jsx`), recording the collecting driver's name and payment method as `"Cash (COD)"`. | `src/App.jsx` (pass invoice/receipt handlers to `<Logistics>`), `src/components/operations/Logistics.jsx`, `src/components/operations/LogisticsCardDetails.jsx` |
| **D-7** | **Fleet & Driver Directory Persistence** | ✅ ACCEPTED | Move fleet vehicles and driver directory out of hardcoded constants into Firestore (e.g. `settings/fleet` or a dedicated collection), editable by Admins in Settings/User Management. Retain `FLEET_VEHICLES` and `DRIVER_DIRECTORY` in `logisticsEngine.js` only as a safe fallback for initial seeding or offline mode. | `src/utils/logisticsEngine.js`, `src/components/operations/Logistics.jsx`, `src/components/operations/LogisticsCardDetails.jsx` |
| **D-8** | **Optimistic Update Error Handling & State Rollback** | ✅ ACCEPTED | Update `handleMoveJob`, `handleMoveJobBack`, `handleDrop`, and `handleDeleteConfirm` in `Logistics.jsx` to retain a snapshot of previous state. In the `catch` blocks, restore the previous state and trigger `toast.error("Failed to sync stage change to server")` so the user is alerted to network or permission rejections. | `src/components/operations/Logistics.jsx` |

---

## 6. Implementation Checklist

> All items in §5 are **accepted**. The following checklist tracks execution status. Mark `[x]` when a change is committed to `review-operations-logistics` branch.

- [x] **D-1** — Refactor `callAIInsights` in `Logistics.jsx` to use authenticated `gemini.js` proxy with current Firebase ID token.
- [x] **D-2** — Grant `invoices: read()` to `Logistics` role in `PermissionsContext.jsx` and adjust `firestore.rules` to allow COD invoice reading.
- [x] **D-3** — Unify dispatch schema in `Deals.jsx`, `Leads.jsx`, and `FabricationWorks.jsx`: use `generateAtomicId('L-DL'/'L-PK')`, standard key `customerPhone`, and link `linkedJobNo`.
- [x] **D-4** — Enhance `calculateCODFromInvoices` to detect unbilled 25% balance; replace false "All Settled" banners and waybill text with "Pending Final Invoice".
- [x] **D-5** — Propagate delivery status (`in_transit`, `delivered`) from Logistics to linked `projects` document so fabrication operators have handover visibility.
- [x] **D-6** — Wire `onMarkInvoicePaid` and `onGenerateReceipt` from `App.jsx` into `Logistics` and add in-field COD collection action in `LogisticsCardDetails`.
- [ ] **D-7** — Persist driver and vehicle directories in Firestore settings with fallback to static constants.
- [x] **D-8** — Implement previous-state rollback and user error toasts on failed Firestore writes in `Logistics.jsx`.
