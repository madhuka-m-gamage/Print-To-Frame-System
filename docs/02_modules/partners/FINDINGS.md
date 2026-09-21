# Partners Module Review & Correctness Audit Findings

> **Scope**: Correctness review of `docs/02_modules/partners/CLAUDE.md`, `docs/02_modules/partners/README.md`, and all cross-module triggers touching Partners documented in `docs/01_architecture/CROSS_MODULE_TRIGGERS.md`.  
> **Branch / Worktree**: `review-partners` (`.worktrees/review-partners`)  
> **Status**: Review & Audit complete — all 12 decision points accepted by product owner on 2026-09-20. Ready for implementation.

---

## 1. Executive Summary

A thorough architectural and trigger audit was conducted across the Partners module, its public touchpoints, authentication and onboarding pipelines, commission ledger engines, and cross-module trigger chains:
- **Module Documentation**: `docs/02_modules/partners/README.md`, `docs/02_modules/partners/CLAUDE.md`, `docs/01_architecture/CROSS_MODULE_TRIGGERS.md`.
- **Target UI Components**: `src/features/partners/Partners.jsx`, `src/features/partners/PartnerQRModal.jsx`, `src/features/partners/PartnerRegistration.jsx`, `src/features/partners/ReferralForm.jsx`.
- **Cross-Module Integrations**: `src/features/admin/AgentDatabase.jsx` (partner application review and user provisioning), `src/features/deals/Deals.jsx` (commission accrual upon stage transition), `src/App.jsx` (route guards, approval hand-off, collection subscriptions, payment clearance, and payout eligibility notifications), `src/features/leads/LeadCardDetails.jsx` (agent assignment dropdown).
- **Backend Services & Security Rules**: `api/send-email.js` (templated email delivery), `api/admin-user.js` (Firebase Admin SDK user creation and password resets), `firestore.rules` (`partners`, `partner_applications`, `leads`, missing collections).
- **Permissions & RBAC**: `src/constants/roles.js`, `src/context/PermissionsContext.jsx`.

### Key Discoveries:

1. **Trigger 6d "Disburse Payout" Is Completely Non-Functional (Toast Only)**:
   - In `Partners.jsx:L857-L865` (Month-End Batch Commission Settlement Ledger), clicking "Disburse Payout" generates a purely cosmetic pseudo-random transaction ID string (`TXN-######`) and displays a success toast.
   - It performs **zero Firestore writes**: `payoutStatus` is never updated, `partner_payouts` is never written (the collection constant exists in `firestoreSync.js` but is 100% dead code across the repository), `partners.pending` is never decremented, and no audit log entry is generated.
2. **Trigger 6b Execution Timing Discrepancy**:
   - `CROSS_MODULE_TRIGGERS.md`, `CLAUDE.md`, and `partners.md` document that commission accrues "when reaching Hand Over" (`partners.pending += totalSqFt * commissionRate`).
   - In reality, `Deals.jsx:L332` gates commission accrual strictly on `if (liveNextStage === "Completed")`. Moving a deal from "Ready To Load" to "Hand Over" performs no commission calculations or writes; commission accrues only when moving *out* of "Hand Over" into "Completed".
3. **Zero SqFt Fallback Flaw in Deals.jsx**:
   - When completing a deal, `Deals.jsx:L363-L368` calculates `commissionAmount = sqFt * commRate`. If `deal.totalSqFt` is 0 or missing (e.g. deals converted without automated pricing metadata), `commissionAmount` evaluates to **LKR 0.00**.
   - Unlike `Partners.jsx:L263` and `App.jsx:L535`, which provide a value-based fallback `(dealVal / 850) * commRate`, `Deals.jsx` lacks any fallback, resulting in 0 commission assigned to the partner in both local state and Firestore.
4. **Stage Reversal Commission Duplication Exploit**:
   - Completed deal cards in `Deals.jsx` can be dragged backward to "Hand Over" via `handleMoveBackward`. This moves the stage back but does **not** decrement or reverse `partners.pending`.
   - Moving the deal forward to "Completed" again re-triggers lines 371–380, incrementing `partners.pending` and `partners.totalSqFt` a second time. This can be repeated indefinitely to inflate accrued commissions.
5. **Duplicate Referral Entries & Premature Eligibility in Partners.jsx Ledger**:
   - When a lead is converted to a deal (Trigger 2), both the original lead (`stage: 'Completed'`, `convertedToDeal: true`) and the newly created deal (`stage: 'Waiting'`, `isDeal: true`) share the same partner tag in the `leads` collection.
   - In `Partners.jsx:L237-L241`, `getPartnerReferrals` queries `leads` without filtering out `convertedToDeal: true`.
   - Because line 278 checks `lead.stage === 'Completed'`, the original lead immediately evaluates to `commState = 'Eligible for Payout'` the instant it is converted to a deal, long before fabrication begins or invoices are paid. When the deal eventually completes and settles, both documents evaluate to "Eligible for Payout", duplicating the referral and doubling the displayed payable commission.
6. **Anonymous Referral Lookup Permission Denied (Trigger 6a)**:
   - When an end-user visits the public referral form `/referral?ref=P-1001`, `ReferralForm.jsx:L40-L45` executes `query(collection(db, 'partners'), where('partnerId', '==', pid))`.
   - Under `firestore.rules:L174`, read access to `/partners` requires authentication and `partners` permission. Public unauthenticated visitors fail this query with `permission-denied`.
   - The catch block in `ReferralForm.jsx:L56-L59` silently falls back to `{ name: 'Verified Partner Studio', partnerId: pid }` and default `53.5` rate, discarding any custom studio branding and custom negotiated rates on intake.
7. **Missing Security Rules for `referral_claims` & `partner_payouts`**:
   - `firestore.rules` has no match blocks for `/referral_claims/{claimId}` or `/partner_payouts/{payoutId}`.
   - Both collections fall into the catch-all deny rule (`match /{document=**} { allow read, write: if false; }`). Any client attempt to submit a claim or subscribe to claims in production Firestore is blocked by security rules.
8. **Broken Marketing Referral URL Discrepancy**:
   - In `Partners.jsx:L699`, the dedicated referral URL copied from the Marketing tab points to an external marketing site route: `https://print2frame.xyz/client-detail-submitting-form?ref=${pid}`.
   - In `PartnerQRModal.jsx:L12`, the QR flyer points to the internal application route: `${origin}/referral?ref=${pid}`.
   - The former URL does not route to `ReferralForm.jsx` and does not integrate with the ERP's Firestore database.
9. **Partner Role Route Guard vs Mobile Dock Conflict (`messages`)**:
   - `App.jsx:L280` protects Partner users with a tab whitelist: `['dashboard', 'notifications', 'partners', 'profile']`.
   - However, the Mobile Quick Dock (`App.jsx:L1458-L1464`) renders a "Chat" button targeting `'messages'` for the Partner role. Tapping Chat updates `activeTab` to `'messages'`, which immediately triggers the route protection `useEffect` and forces navigation back to `'partners'`.
10. **Schema Inconsistency: `partnerId` vs `agentId`**:
    - `ReferralForm.jsx` writes both `partnerId` and `agentId`.
    - `LeadCardDetails.jsx` writes only `agentId`.
    - `Deals.jsx` only checks `deal.agentId`.
    - `App.jsx:L528-L531` (Trigger 6c payment clearance) only matches `targetLead.partnerId`. If an agent is manually selected via `LeadCardDetails.jsx`, `App.jsx` fails to resolve `referredPartner`, defaulting the rate to 53.5 and recording `partnerId: ''` on the commission notification.
11. **Session-Only Non-Persistent Commission Notifications (Trigger 6c)**:
    - When invoices are marked Paid, `App.jsx:L545` emits a `commission` notification using `emitNotification()`.
    - `emitNotification` dispatches an in-memory browser `CustomEvent` on `window.EventTarget`. It is never written to Firestore, vanishes on page refresh, and is received ONLY by the user who marked the invoice paid (admin/staff), never reaching the partner user's portal.
12. **Firestore Rules Block Partner Role from Viewing Their Own Referred Leads**:
    - `Partners.jsx` relies on `leads` and `invoices` props to calculate referral ledgers.
    - `App.jsx:L319-L320` subscribes to the entire `leads` and `invoices` collections on mount.
    - Under `DEFAULT_PERMISSIONS`, `Partner` has `leads: none()` and `invoices: none()`. Under `firestore.rules`, collection queries require `checkPermission('leads', 'view')`. A logged-in Partner user will suffer permission denial on collection subscriptions, resulting in empty state in production.

---

## 2. Review of Module Documentation

### 2.1 `docs/02_modules/partners/CLAUDE.md`

| Section / Claim | Code Status | Details / Discrepancy |
|---|---|---|
| **What it does** ("Partner / referral network: public application, admin approval, QR referral link, referred leads, commission ledger.") | **Accurate** | Confirmed: Covers public application, admin approval flow, QR modal, referred lead ingestion, and commission ledger views. |
| **Firestore collections it owns or writes** ("Owns `partners`, `partner_applications`, `referral_claims`. `partner_payouts` is defined but **unused**. Creates `leads` from the referral form.") | **Accurate** | Confirmed: `partner_payouts` only exists as a constant in `firestoreSync.js`. Creates `leads` in `ReferralForm.jsx`. |
| **Triggers and side effects** ("Commission accrues at Hand Over (`Deals.jsx`); eligibility at full payment (`App.jsx`).") | **Discrepancy (Timing)** | In `Deals.jsx:L332`, accrual runs when moving from Hand Over to **Completed** (`liveNextStage === "Completed"`). It does **not** accrue when entering "Hand Over". |
| **Triggers and side effects** ("**'Disburse Payout' is a toast only**; nothing is written and `pending` is never reduced.") | **Accurate** | Confirmed: `Partners.jsx:L858-L865` only fires `toast.success` with a fake reference ID. |
| **Before you edit** ("`firestore.rules` has no block for `referral_claims` or `partner_payouts` (catch-all deny in the committed file).") | **Accurate** | Confirmed: Both collections are omitted from `firestore.rules` and denied by `match /{document=**}`. |
| **Before you edit** ("Ledger states are derived on the fly in `Partners.jsx`, not stored.") | **Accurate** | Confirmed: `getPartnerReferrals` derives ledger states dynamically in memory from `leads` and `invoices`. |
| **Before you edit** ("Partner users are restricted to dashboard, notifications, partners, profile (route guard + matrix).") | **Partially Discrepant** | The route guard whitelists these 4 tabs, but the Mobile Quick Dock includes a 5th tab (`messages`), causing an immediate redirect bounce. |

### 2.2 `docs/02_modules/partners/README.md`

| Section / Claim | Code Status | Details / Discrepancy |
|---|---|---|
| **Files and folders** ("`PartnerQRModal.jsx`: ... `${origin}/referral?ref=<partnerId>`") | **Accurate for Modal, Discrepant for Tab** | Modal uses `${origin}/referral?ref=<partnerId>`, but `Partners.jsx:L699` marketing tab copies `https://print2frame.xyz/client-detail-submitting-form?ref=<partnerId>`. |
| **Firestore collections read/written** ("`partners`: written by `Partners.jsx`... `Deals.jsx`... and `App.jsx`") | **Accurate** | Confirmed: `Partners.jsx` adds/updates/deletes; `Deals.jsx` updates `pending` and `totalSqFt`; `App.jsx` syncs profile photos and contact numbers. |
| **Cloud Functions / triggers** ("Accrual: when a deal reaches Hand Over...") | **Discrepancy (Timing)** | Accrual happens when transitioning *out* of Hand Over into Completed (`liveNextStage === "Completed"`), not when reaching Hand Over. |
| **Cloud Functions / triggers** ("Pending to eligible: in `App.jsx`... one-time `commission` notification is emitted (`emitNotification`).") | **Accurate (In-Memory Only)** | Confirmed in `App.jsx:L545`. Emitted via DOM `CustomEvent`; not persisted to Firestore or delivered across user sessions. |
| **Registration and approval** ("`AgentDatabase.jsx` creates the Auth account with an admin-set password, then `onApprove` runs... pre-fills Register Partner form... creates `partners` doc.") | **Accurate** | Confirmed: Flow creates Auth user via `api/admin-user.js`, sets `users/{email}`, hands off prefill to `Partners.jsx`, and sends welcome email upon creation. |
| **Open questions** ("Is payout disbursement meant to be manual outside the app? `partner_payouts` is defined but unused.") | **Unresolved Architecture** | Confirmed: Complete gap in payout settlement and ledger finalization. |

---

## 3. Cross-Module Triggers Audit (`CROSS_MODULE_TRIGGERS.md`)

### Trigger 6a: Public Referral Form Submission

* **Trigger**: Prospective customer visits `/referral?ref=<partnerId>` and submits the contact form.
* **Implementation**: `src/features/partners/ReferralForm.jsx:L74-L128`.
* **Trace & Analysis**:
  1. **Partner ID Resolution**:
     - Extracts `pid` from URL query parameter `?ref=` or `?partnerId=`.
     - Calls `fetchPartnerDetails(pid)`, executing `query(collection(db, 'partners'), where('partnerId', '==', pid))`.
     - **Security Rules Block**: Because unauthenticated users are denied read access to `/partners` by `firestore.rules:L174`, this query throws an unhandled error caught in `catch (err)`.
     - It falls back to `{ name: 'Verified Partner Studio', partnerId: pid }` with default commission rate `53.5`.
     - Custom partner names (e.g. "Framing Canvas Studio") and negotiated rates (e.g. 75.00 LKR/sqft) fail to load for anonymous visitors.
  2. **Lead Creation Payload**:
     ```javascript
     const leadData = {
       id: leadId, // LD-######
       name: formData.name.trim(),
       phone: formData.phone.trim(),
       email: formData.email?.trim() || '',
       company: '',
       jobScope: `Claimed 15% Partner Referral Discount (Referred by ${partnerDetails?.name || partnerId})`,
       source: 'Referral',
       agentId: partnerId || 'Direct',
       agentName: partnerDetails?.name || partnerId || 'Partner Referral',
       partnerId: partnerId || '',
       partnerName: partnerDetails?.name || partnerId || '',
       commissionRate: Number(partnerDetails?.commissionRate) > 1 ? Number(partnerDetails?.commissionRate) : 53.5,
       stage: 'Intake',
       value: 0,
       totalSqFt: 0,
       date: new Date().toISOString().split('T')[0],
       callbackSlaDeadline: slaDeadline, // +5 minutes
       callbackStatus: 'Pending',
       createdAt: serverTimestamp(),
       updatedAt: serverTimestamp(),
     };
     ```
  3. **Firestore Permission**:
     - `firestore.rules:L125` contains: `allow create: if ... || (request.resource.data.source == 'Referral');`.
     - This rule permits anonymous creation of the lead document in `/leads/{leadId}`.
  4. **Downstream Effects**:
     - In `Leads.jsx`, the lead renders in the "Intake" Kanban column with a glowing "5-Min SLA" badge and "Referral" source tag.
     - Customer is presented with a success confirmation card and a WhatsApp click-to-chat button targeting `+94 71 141 9027`.

---

### Trigger 6b: Deal Completion Commission Accrual

* **Trigger**: Deal card moved from `"Hand Over"` to `"Completed"` on the Deals Kanban board.
* **Implementation**: `src/features/deals/Deals.jsx:L362-L385`.
* **Trace & Analysis**:
  1. **Execution Timing Discrepancy**:
     - Documented as occurring upon entering "Hand Over".
     - Code implementation executes inside `if (liveNextStage === "Completed")`. Moving from "Ready To Load" to "Hand Over" performs no accrual.
  2. **Accrual Logic**:
     ```javascript
     if (deal.agentId && partners.length && setPartners) {
       const sqFt = Number(deal.totalSqFt) || 0;
       const agent = partners.find(p => p.partnerId === deal.agentId);
       const commRate = Number(agent?.commissionRate) > 0 ? Number(agent.commissionRate) : 53.5;
       const commissionAmount = sqFt * commRate;

       if (agent) {
         setPartners(prevPartners => prevPartners.map(p =>
           p.partnerId === deal.agentId
             ? { ...p, pending: (p.pending || 0) + commissionAmount, totalSqFt: (p.totalSqFt || 0) + sqFt }
             : p
         ));
         updateDocument(COLLECTIONS.PARTNERS, agent._firestoreId || agent.partnerId, {
           pending: (agent.pending || 0) + commissionAmount,
           totalSqFt: (agent.totalSqFt || 0) + sqFt
         }).catch(err => console.error("Partner update error:", err));
       }
     }
     ```
  3. **Zero SqFt Vulnerability**:
     - If `deal.totalSqFt` is missing or 0, `commissionAmount = 0 * commRate = 0`.
     - `Deals.jsx` updates `partners.pending` by adding 0, effectively depriving the referring partner of commission for deals entered without calculator sqft metadata.
  4. **Reversal & Multi-Accrual Exploit**:
     - Moving a deal card backward from Completed to Hand Over via `handleMoveBackward` updates the stage to "Hand Over" without modifying `partners.pending`.
     - Moving the deal forward to Completed again re-accrues the commission, multiplying the partner's recorded pending balance.
  5. **Bulk Action Bypass**:
     - In `Deals.jsx:L198-L212`, `handleBulkStageChange` allows moving selected deals to "Completed" in Table view. This writes directly to Firestore without running `handleMoveForwardInner`, bypassing partner commission accrual entirely.

---

### Trigger 6c: Invoice Payment Clearance & Payout Eligibility

* **Trigger**: User marks an invoice "Paid" in Invoices or Receipts (`App.jsx` `handleMarkInvoicePaid`).
* **Implementation**: `src/App.jsx:L487-L558`.
* **Trace & Analysis**:
  1. **Full Settlement Verification**:
     - Evaluates whether both the latest Advance invoice and Final invoice for the job/lead are `Paid`:
       ```javascript
       const isFullyPaid = Boolean(advanceInvoice) && Boolean(finalInvoice) && paidNow(advanceInvoice) && paidNow(finalInvoice);
       ```
  2. **Lead Status Update**:
     - If `isFullyPaid` and `isPartnerReferral` and `!alreadyEligible`:
       - Updates `leads` document with `{ referralStatus: 'Eligible for Payout', invoicePaid: true }`.
  3. **Live Commission Calculation & Notification**:
     ```javascript
     const sqFt = Number(targetLead.totalSqFt || targetLead.sqFt || (targetLead.pricingMetadata?.costSalesAmount ? (targetLead.pricingMetadata.costSalesAmount / 53.5) : 0));
     const referredPartner = partners.find(p =>
       (targetLead.partnerId && (p.partnerId === targetLead.partnerId || p.id === targetLead.partnerId)) ||
       (targetLead.partnerName && p.name === targetLead.partnerName)
     );
     let commRate = Number(referredPartner?.commissionRate) > 0 ? Number(referredPartner.commissionRate) : 53.5;
     if (commRate > 0 && commRate <= 1) commRate = 53.5;
     const dealVal = Number(targetLead.value || 0);
     const commAmount = sqFt > 0 ? sqFt * commRate : (dealVal / 850) * commRate;

     const notif = {
       id: `notif_comm_${Date.now()}`,
       title: 'Commission Eligible: Full Payment Cleared',
       message: `100% payment cleared for client ${targetLead.name || 'Referred Client'} (Deal ${targetLead.id}). Commission of LKR ${commAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} is now eligible for month-end payout!`,
       date: new Date().toISOString(),
       type: 'commission',
       partnerId: targetLead.partnerId || '',
     };
     emitNotification(notif);
     ```
  4. **Notification Scope Flaw**:
     - `emitNotification` dispatches an in-memory browser `CustomEvent`.
     - The notification is neither persisted in a `notifications` collection nor delivered via WebSocket/FCM. It is displayed strictly in the session of the user who clicked "Mark Paid" (typically an Accounts/Admin staff member), never reaching the partner.
  5. **Schema Divergence Hazard**:
     - Notice line 529 matches `targetLead.partnerId`. If the lead was saved via `LeadCardDetails.jsx`, which populates `agentId` but omits `partnerId`, `referredPartner` evaluates to `undefined`, falling back to 53.5 and setting `notif.partnerId: ''`.

---

### Trigger 6d: "Disburse Payout" Month-End Settlement

* **Trigger**: Admin clicks "Disburse Payout" in the Month-End Settlements view (`Partners.jsx:L857-L866`).
* **Implementation**:
  ```javascript
  <button
    onClick={() => {
      const txId = 'TXN-' + String(Date.now()).slice(-6);
      toast.success(`Monthly settlement processed for ${p.name} (Ref: ${txId})`);
    }}
    className="px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold rounded-xl border border-primary/30 flex items-center gap-1.5 cursor-pointer active:scale-95"
  >
    <CreditCard size={14} /> Disburse Payout
  </button>
  ```
* **Trace & Analysis**:
  1. **Purely Cosmetic**: Generates an ephemeral string `txId = 'TXN-' + String(Date.now()).slice(-6)` and displays a toast notification.
  2. **No Data Persistence**:
     - Does **not** write to `COLLECTIONS.PARTNER_PAYOUTS` (`partner_payouts`).
     - Does **not** update `lead.payoutStatus` to `'Paid'` or `'Settled'`.
     - Does **not** decrement `partner.pending` or increment `partner.settled`.
     - Does **not** record a transaction in `auditLog`.
  3. **Permanent State Stagnation**:
     - Because `payoutStatus` is never written to Firestore, the referrals remain indefinitely in the `commState = 'Eligible for Payout'` state.
     - The "Eligible" balance displayed on the partner's card never transitions to "Settled".

---

### Trigger 7c & 7d: Partner Registration, Admin Approval, and Profile Provisioning

* **Trigger Sources**:
  - **Path A (Public Application)**: Prospective partner submits public registration form at `/partner/register` (`PartnerRegistration.jsx`).
  - **Path B (Manual Staff Sign-up)**: Prospective user signs up with role "Partner" via standard login screen (`pendingUsers`).
* **Implementation Flow**:
  1. **Submission**:
     - `PartnerRegistration.jsx:L165` uploads files to Firebase Storage (`partners/applications/${appId}/...`) and writes document `APP-######` to `COLLECTIONS.PARTNER_APPLICATIONS` with `status: 'Pending'`.
     - `firestore.rules:L118` allows public creation: `allow create: if true;`.
  2. **Review & Approval in AgentDatabase**:
     - `AgentDatabase.jsx:L109-L121` queries `partnerApplications` and normalizes them into the pending review queue.
     - Admin clicks "Approve Application", enters an initial password (min 6 chars), and submits.
     - Calls `createUserAccount(identifier, password, name)` (`api/admin-user.js`), creating the Firebase Auth account.
     - Updates `partner_applications` doc status to `'Approved'`.
  3. **Handoff to Partners Tab**:
     - `onApprove` calls `approvePending` in `App.jsx:L829-L838`.
     - `approvePending` writes `users/{email}` with `{ role: 'Partner', isApproved: true, status: 'Active' }`.
     - Sets `partnerApprovalPrefill` with name, email, phone, studio type, and `tempPassword`.
     - Sets `activeTab('partners')`.
  4. **Profile Completion & Activation Email**:
     - `Partners.jsx:L138-L152` detects `prefillPartner`, pre-populates `newPartner`, sets `pendingApprovalEmail`, and auto-opens the "Register Partner" modal.
     - Admin confirms commission rate (default 53.50), bank account details, and submits.
     - `handleCreatePartner` executes:
       1. `addDocument(COLLECTIONS.PARTNERS, partnerPayload, partnerId)`.
       2. Sends `partner_approval` templated email via `sendTemplatedEmail` (`api/send-email.js`), delivering the login email, temporary password, partner ID, and portal URL.

---

## 4. Architectural & Implementation Disconnects

### 4.1 "Disburse Payout" Dead-End & Missing Payout Architecture

The settlement workflow in `Partners.jsx` is completely severed between UI intent and data persistence:
- `firestoreSync.js` defines `PARTNER_PAYOUTS: 'partner_payouts'`.
- `emailTemplates.js` defines template `commission_disbursement` ("Framing Partner Commission Statement").
- However, `Partners.jsx:L858` executes no database calls when "Disburse Payout" is clicked.
- **Consequences**:
  - `partner.pending` is never debited.
  - Referred leads never receive `payoutStatus: 'Settled'`.
  - No payment receipt or disbursement record is generated.
  - The settlement ledger re-displays the same accumulated balance indefinitely on every page load.

### 4.2 Lead/Deal Conversion Lineage Duplication & False Early Eligibility

In `Partners.jsx:L237-L285` (`getPartnerReferrals`):
```javascript
return leads.filter(lead => {
  const lPid = String(lead.partnerId || lead.agentId || '').toLowerCase();
  const lPname = String(lead.partnerName || lead.agentName || '').toLowerCase();
  return lPid === pid || lPname === pname || (lead.source === 'Referral' && (lPid === pid || lPname === pname));
}).map(lead => {
...
  let commState = 'Pending Quote';
  if (lead.stage === 'Lost' || lead.stage === 'Rejected') {
    commState = 'Cancelled';
  } else if (lead.payoutStatus === 'Paid' || lead.payoutStatus === 'Settled') {
    commState = 'Paid & Settled';
  } else if (paymentStatus === '100% Fully Settled' || lead.referralStatus === 'Eligible for Payout' || lead.stage === 'Delivered' || lead.stage === 'Completed') {
    commState = 'Eligible for Payout';
  } else if (paymentStatus === '75% Advance Paid' || ['Design / Review', 'Advance Paid', 'Production', 'Fabrication', 'Logistics'].includes(lead.stage)) {
    commState = 'Accrued (In Production)';
  } else if (dealVal > 0) {
    commState = 'Quoted / Pending Acceptance';
  }
```
- **The Duplication Bug**:
  1. When a referral lead converts to a deal, `Leads.jsx` marks the original lead `stage: 'Completed'`, `convertedToDeal: true`, and creates a new deal document with `isDeal: true`, `stage: 'Waiting'`.
  2. Both documents reside in the `leads` collection and carry the same partner ID.
  3. `getPartnerReferrals` returns **both** records.
- **The False Early Eligibility Bug**:
  1. The original lead document has `lead.stage === 'Completed'`.
  2. Line 278 tests `lead.stage === 'Completed'` to flag `commState = 'Eligible for Payout'`.
  3. Consequently, the moment a referral lead is converted to a deal, it instantly appears in the partner portal and admin settlement ledger as **"Eligible for Payout"**, despite no work having started and no invoices being paid.
  4. When the deal later completes and reaches 100% payment settlement, the deal document *also* evaluates to "Eligible for Payout", rendering two identical referral rows and double the commission.

### 4.3 Unauthenticated Read Permission Denial in `ReferralForm.jsx`

In `firestore.rules:L172-L177`:
```javascript
// ── Partners & Commission Ledgers ────────────────────
match /partners/{partnerId} {
  allow read: if checkPermission('partners', 'view') || checkPermission('partners', 'read') || (isAuthenticated() && partnerId == request.auth.token.email);
  allow create, update: if checkPermission('partners', 'create') || checkPermission('partners', 'edit') || checkPermission('partners', 'write');
  allow delete: if checkPermission('partners', 'delete') || isAdmin();
}
```
- Prospective customers scanning a QR code are anonymous visitors browsing `/referral?ref=P-1001`.
- `ReferralForm.jsx:L40-L45` executes `getDocs(query(collection(db, 'partners'), where('partnerId', '==', pid)))`.
- Because the visitor has no auth token, `isAuthenticated()` is false and `checkPermission()` fails. Firestore denies the query.
- The form catches the error and falls back to:
  ```javascript
  setPartnerDetails({ name: 'Verified Partner Studio', partnerId: pid });
  ```
- The prospective customer sees generic branding instead of the specific framing studio whose counter display they just scanned, and the commission rate defaults to 53.50 even if the partner has an agreed rate of 75.00.

### 4.4 Missing Firestore Security Rules for `referral_claims` & `partner_payouts`

In `firestore.rules`:
- There are rules for `partner_applications` (create if true, admin read/write).
- There are rules for `partners` (authenticated with permissions).
- There is **no rule** for `referral_claims`.
- In `Partners.jsx:L90`, the component sets up a real-time listener: `subscribeToCollection(COLLECTIONS.REFERRAL_CLAIMS, ...)`.
- When a partner submits an offline claim (`handleSubmitClaim`) or an admin clicks "Verify Claim", it executes `addDocument` or `updateDocument` on `referral_claims`.
- In a production environment with Firestore rules enabled, all operations on `referral_claims` trigger permission-denied errors via the default rule (`match /{document=**} { allow read, write: if false; }`).

### 4.5 Marketing Referral URL Divergence (`print2frame.xyz` vs `/referral`)

There is a direct collision between two public URL generators:
1. `Partners.jsx:L697-L700`:
   ```javascript
   const publicQrUrl = (partner) => {
     const pid = partner?.partnerId || partner?.id || 'P-1001';
     return `https://print2frame.xyz/client-detail-submitting-form?ref=${pid}`;
   };
   ```
2. `PartnerQRModal.jsx:L11-L12`:
   ```javascript
   const origin = typeof window !== 'undefined' ? window.location.origin : 'https://portal.print2frame.xyz';
   const referralUrl = `${origin}/referral?ref=${partner.partnerId || partner.id}`;
   ```
- If a partner copies the referral link from the "Dedicated Counter QR Code & Referral URL" box in `Partners.jsx`, they share `https://print2frame.xyz/client-detail-submitting-form?ref=P-1001`.
- If they download the counter flyer or click "Test Client Referral Form" from `PartnerQRModal.jsx`, they use `${origin}/referral?ref=${pid}`.
- `client-detail-submitting-form` does not exist in the React application (`src/main.jsx` only mounts `ReferralForm` on `/referral`). Leads submitted through any external form will not execute Trigger 6a unless an external webhook or redirect is configured.

### 4.6 Route Guard Bounce & Mobile Dock Conflict (`messages`)

In `src/App.jsx`:
- Line 277: Comment states: `// Route Protection for Partner Role (5 Modules Only)`.
- Line 280: Whitelist contains only 4 tabs:
  ```javascript
  const allowedTabs = ['dashboard', 'notifications', 'partners', 'profile'];
  if (!allowedTabs.includes(activeTab)) {
    setActiveTab('partners');
  }
  ```
- Lines 1458–1464: The Mobile Navigation Dock explicitly renders a "Chat" button for the Partner role:
  ```javascript
  <button
    onClick={() => { setActiveTab('messages'); setMobileMenuOpen(false); }}
    className={`flex-1 py-1 flex flex-col items-center justify-center ...`}
  >
    <MessageSquare size={18} />
    <span className="text-[10px] font-bold">Chat</span>
  </button>
  ```
- When a partner user on a mobile device taps "Chat", `setActiveTab('messages')` is called. The route protection `useEffect` immediately detects `'messages'` is not in `allowedTabs` and snaps the view back to `'partners'`, creating an unusable flickering UI loop.

### 4.7 Partner Role Permission Disconnect on `leads` and `invoices`

In `src/context/PermissionsContext.jsx:L66-L71`:
```javascript
Partner: {
  dashboard: full(), notifications: full(), messages: none(),
  leads: none(), pipeline: none(), customers: none(), partners: full(),
  invoices: none(), receipts: none(), projects: none(), logistics: none(),
  agents: none(), calculator: none(), admin: none(),
},
```
- In `App.jsx:L319-L320`, top-level Firestore subscriptions unconditionally subscribe to `COLLECTIONS.LEADS` and `COLLECTIONS.INVOICES`.
- Under `firestore.rules`:
  - `match /leads/{leadId}` requires `checkPermission('leads', 'view')`.
  - `match /invoices/{invoiceId}` requires `checkPermission('invoices', 'view')`.
- For an authenticated Partner user, both checks return `false`. Firestore rules reject collection-level queries.
- Consequently, in a secured Firestore environment, `leads` and `invoices` remain empty arrays in `App.jsx`, preventing `Partners.jsx` from computing referral stats or displaying referral history in the partner portal.

### 4.8 `partnerId` vs `agentId` Schema Schism

Across the codebase, partner referral attribution suffers from inconsistent field nomenclature:
1. `ReferralForm.jsx` writes: `agentId: partnerId`, `partnerId: partnerId`, `agentName: name`, `partnerName: name`.
2. `LeadCardDetails.jsx:L1028` binds to `formData.agentId`. When saved, it persists `agentId`, but leaves `partnerId` undefined.
3. `Deals.jsx:L362` checks `deal.agentId`.
4. `App.jsx:L528-L530` (invoice payment settlement) checks:
   ```javascript
   const referredPartner = partners.find(p =>
     (targetLead.partnerId && (p.partnerId === targetLead.partnerId || p.id === targetLead.partnerId)) ||
     (targetLead.partnerName && p.name === targetLead.partnerName)
   );
   ```
   It checks `targetLead.partnerId` and `targetLead.partnerName`, but **ignores `targetLead.agentId`**.
- If a lead was assigned to a partner manually in `LeadCardDetails.jsx`, `targetLead.partnerId` is missing. When the invoice is paid, `referredPartner` is not found, defaulting the commission rate and emitting a notification with an empty partner ID.

### 4.9 Offline Referral Claims Verification Phantom Action

In `Partners.jsx:L801-L808`, the Admin Claims Desk displays a button: "Verify & Credit Commission".
- The implementation (`handleVerifyClaim`) executes:
  ```javascript
  await updateDocument(COLLECTIONS.REFERRAL_CLAIMS, claim._firestoreId || claim.id, {
    status: 'Verified & Linked',
    verifiedAt: new Date().toISOString(),
    verifiedBy: currentUser?.email || 'Admin',
  });
  ```
- **Disconnected Action**: It modifies the status text in `referral_claims`, but does **not**:
  - Search for or create a lead in `leads`.
  - Link the customer to the partner.
  - Credit any commission to `partners.pending`.
  - Create any deal or invoice linkage.
- The claim is visually marked "Verified & Linked", but nothing has actually been credited or linked in the CRM or financial ledger.

### 4.10 Dashboard Domain Misclassification

In `src/features/dashboard/Dashboard.jsx:L22`:
```javascript
if (r.includes('operation') || r.includes('logistics') || r.includes('fabricat') || r.includes('workshop') || r.includes('partner')) {
  return 'operations';
}
```
- Because `'partner'` matches this condition, the default dashboard view for a Partner user is categorized as `'operations'`.
- The dashboard displays factory metrics, fabrication works, cutting schedules, and logistics queues—none of which the partner has permission to access or interest in—while partner referral KPIs and commission summaries are absent from the dashboard.

---

## 5. Resolved Decisions

> **Status**: All 12 decision points below have been **accepted** by the project owner on 2026-09-20. The recommended approach for each item is now the authoritative implementation target. No further approval is required before coding begins.

| # | Topic / Area | Decision Accepted | Resolution | Files to Change |
|---|---|---|---|---|
| **D-1** | **Payout Settlement Persistence (Trigger 6d)** | ✅ ACCEPTED | Implement real month-end settlement transaction: create document in `COLLECTIONS.PARTNER_PAYOUTS` (`partner_payouts`) with amount, partner ID, transaction ref (`TXN-######`), timestamp, and list of settled lead IDs; update matching leads to `payoutStatus: 'Paid'`; debit `partner.pending` and increment `partner.settled` (or `paid`); record `PAYOUT_DISBURSED` in `auditLog`. Wire this directly to the "Disburse Payout" button in `Partners.jsx`. | `src/features/partners/Partners.jsx` (`handleDisbursePayout`), `src/services/auditLog.js` |
| **D-2** | **Referral Ledger Lineage & Premature Eligibility** | ✅ ACCEPTED | In `getPartnerReferrals` (`Partners.jsx`), filter out converted lead ancestors (`!lead.convertedToDeal`). Evaluate `Eligible for Payout` strictly when `lead.isDeal && (lead.referralStatus === 'Eligible for Payout' \|\| paymentStatus === '100% Fully Settled')`. This eliminates duplicate referral rows and prevents unconverted/in-progress deals from prematurely showing as payable. | `src/features/partners/Partners.jsx` (`getPartnerReferrals`) |
| **D-3** | **Commission Accrual Timing & Zero SqFt Fallback (Trigger 6b)** | ✅ ACCEPTED | Maintain accrual on Deal Completion in `Deals.jsx:L332` and update documentation to reflect actual behavior. In `Deals.jsx:L363`, add fallback when `totalSqFt <= 0`: `const effectiveSqFt = Number(deal.totalSqFt) > 0 ? Number(deal.totalSqFt) : 0; const commissionAmount = effectiveSqFt > 0 ? effectiveSqFt * commRate : (Number(deal.value \|\| 0) / 850) * commRate;`. Only increment `partner.totalSqFt` when `effectiveSqFt > 0`. | `src/features/deals/Deals.jsx` (`handleMoveForwardInner`), `docs/01_architecture/CROSS_MODULE_TRIGGERS.md`, `docs/02_modules/partners/README.md` |
| **D-4** | **Stage Reversal Commission Duplication** | ✅ ACCEPTED | Lock completed deals from backward transition (`onMoveBack = null` for last stage in `DealColumn`). Additionally, flag the deal document with `commissionAccrued: true` upon completion so any future state transitions will not duplicate the commission accrual. | `src/features/deals/Deals.jsx` (`DealColumn`, `handleMoveForwardInner`) |
| **D-5** | **Public Partner Lookup Security Rules (Trigger 6a)** | ✅ ACCEPTED | Update `firestore.rules` under `match /partners/{partnerId}` to permit public read access for active partners: `allow read: if checkPermission('partners', 'view') \|\| checkPermission('partners', 'read') \|\| (resource.data.status == 'Active') \|\| (isAuthenticated() && partnerId == request.auth.token.email);`. This ensures `ReferralForm.jsx` displays the partner's actual studio branding and negotiated commission rate. | `firestore.rules` (`match /partners/{partnerId}`) |
| **D-6** | **Missing Firestore Security Rules for Claims & Payouts** | ✅ ACCEPTED | Add explicit match blocks in `firestore.rules`: (1) `/referral_claims/{claimId}`: allow create if authenticated or submitting pending claim; allow read if partner view permission or admin; allow update/delete if admin. (2) `/partner_payouts/{payoutId}`: allow read if partner view permission or matching partner email; allow create/update/delete if admin. | `firestore.rules` (add `referral_claims` and `partner_payouts` match blocks) |
| **D-7** | **Marketing URL Discrepancy** | ✅ ACCEPTED | Standardize `publicQrUrl` in `Partners.jsx:L699` to return `${origin}/referral?ref=${pid}`, identical to `PartnerQRModal.jsx`, ensuring partners copy the valid internal referral form route. | `src/features/partners/Partners.jsx` (`publicQrUrl`) |
| **D-8** | **Partner Mobile Navigation Dock Conflict** | ✅ ACCEPTED | Align mobile dock with role permissions. In `App.jsx:L1458-L1464`, replace the "Chat" (`messages`) button with "Profile" (`profile`) in the Partner Mobile Quick Dock, eliminating the tab collision and redirect loop. | `src/App.jsx` (Mobile Quick Dock navigation) |
| **D-9** | **Partner Role Read Access to Referred Leads & Invoices** | ✅ ACCEPTED | In `firestore.rules`, update `/leads/{leadId}` and `/invoices/{invoiceId}` to allow read if the authenticated user is the assigned partner (`resource.data.partnerId == request.auth.token.email \|\| resource.data.agentId == getUserData().partnerId`). In `App.jsx`, scope collection subscriptions for the Partner role to their own records. | `firestore.rules` (`leads` and `invoices` match blocks), `src/App.jsx` (`subscribeToCollection`) |
| **D-10** | **Field Discrepancy: `partnerId` vs `agentId`** | ✅ ACCEPTED | Normalize field assignment across the CRM: when selecting an agent in `LeadCardDetails.jsx`, write both `agentId: p.partnerId` and `partnerId: p.partnerId`, along with `partnerName: p.name` and `commissionRate: p.commissionRate`. Update `App.jsx:L529` to match on `targetLead.partnerId \|\| targetLead.agentId`. | `src/features/leads/LeadCardDetails.jsx` (`handleInputChange`), `src/App.jsx` (`handleMarkInvoicePaid`) |
| **D-11** | **Commission Notification Persistence & Targeting** | ✅ ACCEPTED | In `App.jsx:L545`, write commission clearance notifications to the `notifications` Firestore collection tagged with `recipientEmail: referredPartner?.email` and `targetRole: 'Partner'`, allowing persistent delivery across reloads to the partner portal. | `src/App.jsx` (`handleMarkInvoicePaid`) |
| **D-12** | **Offline Referral Claims Workflow Resolution** | ✅ ACCEPTED | Implement claim resolution workflow in `Partners.jsx`: when an admin clicks "Verify & Credit Commission", open a modal allowing the admin to link the claim to an existing lead (setting `partnerId`) or convert the claim into a new Lead with `source: 'Referral'`, ensuring real downstream pipeline and commission linkage. | `src/features/partners/Partners.jsx` (`handleVerifyClaim`) |

---

## 6. Implementation Checklist

> All items in §5 are **accepted**. The following checklist tracks execution status. Mark `[x]` when a change is committed to the `review-partners` branch.

- [ ] **D-1** — Implement real `handleDisbursePayout` in `Partners.jsx`: write `partner_payouts` doc, update leads `payoutStatus: 'Paid'`, update partner balances, emit `PAYOUT_DISBURSED` audit log.
- [ ] **D-2** — Filter out `!lead.convertedToDeal` in `Partners.jsx` `getPartnerReferrals` and gate `Eligible for Payout` on `lead.isDeal` and full settlement.
- [ ] **D-3** — In `Deals.jsx:L363`, add `(Number(deal.value) / 850) * commRate` fallback when `totalSqFt <= 0`; update trigger documentation.
- [ ] **D-4** — Disable backward moves on Completed deal cards in `Deals.jsx` (`DealColumn` conditional `onMoveBack`); add `commissionAccrued: true` idempotency check.
- [ ] **D-5** — Update `firestore.rules` under `/partners/{partnerId}` to permit read access if `resource.data.status == 'Active'`.
- [ ] **D-6** — Add explicit security rules in `firestore.rules` for `/referral_claims/{claimId}` and `/partner_payouts/{payoutId}`.
- [ ] **D-7** — Standardize `publicQrUrl` in `Partners.jsx:L699` to return `${origin}/referral?ref=${pid}`.
- [ ] **D-8** — Replace "Chat" (`messages`) with "Profile" (`profile`) in `App.jsx` Mobile Quick Dock for Partner role.
- [ ] **D-9** — Add scoped read permissions in `firestore.rules` for Partner role on `/leads` and `/invoices`; scope subscriptions in `App.jsx`.
- [ ] **D-10** — In `LeadCardDetails.jsx`, populate both `partnerId` and `agentId` with name and rate; update `App.jsx:L529` to match `partnerId || agentId`.
- [ ] **D-11** — Write persistent commission clearance notifications to Firestore `notifications` collection targeted to partner email/role in `App.jsx`.
- [ ] **D-12** — Add claim linkage / conversion modal to `handleVerifyClaim` in `Partners.jsx`.

