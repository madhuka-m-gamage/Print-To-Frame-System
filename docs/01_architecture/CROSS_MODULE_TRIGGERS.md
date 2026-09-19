# Cross-Module Triggers

> Trigger chains between modules. One entry per chain, formatted **Trigger -> Function -> Effect -> Downstream module(s)**. Built from the module maps in [docs/02_modules/](../02_modules/); the double-Final-invoice guard check was verified directly in `Deals.jsx` and `FabricationWorks.jsx`.

## Read this first

There are **no Cloud Functions, Eventarc triggers, Scheduler jobs or Pub/Sub topics** on the GCP project (see [GCP_INVENTORY.md](GCP_INVENTORY.md)). Every chain below runs **in the user's browser** (`src/App.jsx` handlers and component code) or, for AI and email, through a Vercel endpoint the browser calls. That has three consequences:

- Chains only run when a user performs the triggering action in the UI. Nothing reacts to a Firestore write made another way.
- A chain can stop half-way (closed tab, network error) because it is a series of separate writes, not one transaction, except where noted.
- "Synchronous vs async" below means: **awaited in-app** (the UI waits) or **fire-and-forget** (not awaited or not observed).

## 1. Call recording finishes and AI analysis fills fields

| | |
|---|---|
| Trigger | User records (MediaRecorder) or uploads audio in `LeadCardDetails.jsx` |
| Function | `analyzeCallRecording` -> `extractCallScope` (`src/services/gemini.js`) -> `POST /api/generate` (`api/generate.js`) |
| Effect | Gemini returns JSON (scope, client name / contact / email, delivery location, frame height / width). Fields are applied to the **form state only when the user clicks apply** (`applyAudioAnalysisToScope`). Persisted only when the user saves the lead. |
| Downstream | Leads (`leads` document on save); Cost calculator (height / width prefill) |
| Sync / async | Awaited in-app (user waits for the analysis). Audio and result are **not stored** anywhere. |

Order: record -> downsample + base64 -> token-verified proxy call -> Gemini -> user reviews -> apply -> save. No automatic write to Firestore happens before the user saves. Not automatic: the "auto-fill" is user-confirmed.

## 2. Lead converts to Deal

| | |
|---|---|
| Trigger | Lead in stage "Received" is moved forward, or Convert is clicked (`Leads.jsx` `handleConvertConfirm`) |
| Function | Client code in `Leads.jsx` (several separate writes) |
| Effect | New `leads` doc `D-xxxxxx` (`isDeal: true`, stage Waiting, `jobNo` `PTF-xxxx`, `originalLeadId`); original lead marked Completed and locked with `convertedDealId`; customer created (`AUTO-######`) or `orders + 1`; Pending `projects` doc created sharing the `jobNo` |
| Downstream | Deals, Customers, Operations-Fabrication |
| Sync / async | Awaited in-app, but multiple separate writes (not one transaction) |

Does **not** touch the quotation builder or invoices. A quotation is linked later through `matchesEntity` (id lineage in `src/utils/entityUtils.js`).

## 3. Deal reaches Completed

| | |
|---|---|
| Trigger | Deal moved from Hand Over to Completed (`Deals.jsx`) |
| Function | Deal stage handler: reserves a Final invoice id (`generateInvoiceId('Final')`), then `onSaveInvoice` -> `handleSaveInvoice` (`App.jsx`) |
| Effect | Aborts the move if the invoice id cannot be reserved. Otherwise creates a **25% Final invoice** (`deal.value * 0.25`, `advancePaid` recorded as 75%), linked to the quotation via `matchesEntity`, copying its line items. `INVOICE_CREATED` audit entry. |
| Downstream | Invoicing (`invoices`, `counters`), Audit log |
| Sync / async | Id reservation awaited; stage update and invoice write are separate writes |

Partner commission is accrued **earlier**, at Hand Over: `partners.pending += totalSqFt * commissionRate` (`Deals.jsx`). See chain 6.

## 4. Fabrication passes QA

| | |
|---|---|
| Trigger | Operator passes the 4-point QA dialog (`FabricationWorks.jsx` `handlePassQA` -> `handlePassQAInner`) |
| Function | Reserves a Final invoice id, then `onSaveInvoice` -> `handleSaveInvoice` |
| Effect | Job set to Completed; if `value > 0`, a **25% Final invoice** (Unpaid, due in 7 days) is created; job is not completed if the id cannot be reserved. **No deal or lead stage is updated.** No `quotationId` is set on this invoice. |
| Downstream | Invoicing, Audit log |
| Sync / async | Id reservation awaited |

## 5. The 75% / 25% pre/post invoice-to-receipt linkage

There is **no function that links invoices to receipts automatically**. The chain is a series of manual and automatic client steps:

| Step | Trigger | Function | Effect |
|---|---|---|---|
| 5a | User clicks "75% Advance Invoice" (needs quotation status `Accepted`) | `QuotationBuilder.jsx` -> `onSaveInvoice` | `INV-ADV-####`, amount = 75% of the grand total, `quotationId`, copied line items |
| 5b | Deal completes **or** fabrication passes QA **or** user clicks "25% Final Settlement" | chains 3 and 4, or `QuotationBuilder.jsx` | `INV-FIN-####`, amount = 25% of the value |
| 5c | User marks an invoice paid | `App.jsx` `handleMarkInvoicePaid` | Invoice Paid; if Advance and stage is "75% Invoice Submitted" the lead stage becomes "Received"; when the latest Advance **and** Final are both Paid the lead gets `invoicePaid` (+ `referralStatus: 'Eligible for Payout'` and a commission notification for partner referrals) |
| 5d | User clicks Generate Receipt on a Paid invoice | `App.jsx` `handleGenerateReceipt` | `receipts` doc; id derived from the invoice id (`INV-ADV-0007` -> `REC-ADV-0007`); transaction rejects duplicates; `RECEIPT_GENERATED` audit entry |

Link fields: invoice `quotationId`; lead / deal / job ids (`leadId`, `dealId`, `originalLeadId`, `convertedDealId`, `jobNo`, `linkedJobNo`); `receipts.invoiceId`. The 75 / 25 split is hardcoded separately in `QuotationBuilder.jsx` (89-90), `Deals.jsx` (335, 350) and `FabricationWorks.jsx` (741). Creating a receipt does **not** change the invoice, and no balance or partial-payment tracking exists.

### Risk found while tracing (not a review, recorded because it changes how the chain behaves)

**Chains 3 and 4 can both create a Final invoice for the same job.** Each reserves a fresh `INV-FIN` counter id and neither checks for an existing Final invoice for the lead / deal / job (no such check found in either code path; the manual builder button is hidden once an invoice exists, but that is UI-only). If a job passes QA and the linked deal is later moved to Completed (or the reverse), two 25% Final invoices are created. Whether both flows are used together in practice is not known from the repo.

## 6. Partner referral to commission

| Step | Trigger | Function | Effect |
|---|---|---|---|
| 6a | Client submits the public referral form | `ReferralForm.jsx` | Lead `source: 'Referral'`, stage Intake, tagged with the partner id and rate |
| 6b | Deal reaches Hand Over | `Deals.jsx` | `partners.pending += totalSqFt * commissionRate` (default 53.5 LKR / sq ft) |
| 6c | Advance and Final both Paid | `handleMarkInvoicePaid` | `referralStatus: 'Eligible for Payout'`; one-time `commission` notification via `emitNotification` (session-only, seen only by the user who marked it paid) |
| 6d | Admin clicks "Disburse Payout" | `Partners.jsx` | **Toast only.** No write to `payoutStatus` or `partner_payouts`; `pending` is never reduced |

## 7. Registration to approval to record creation

| Step | Trigger | Function | Effect |
|---|---|---|---|
| 7a | Email sign-up or first Google sign-in | `handleRegister` / auth listener in `App.jsx` | `pendingUsers/{email}` written, user signed out |
| 7b | Admin approves in User Management | `approvePending` (`App.jsx`) | `batchWrite`: `users/{email}` set active, `pendingUsers` doc deleted, `APPROVE` audit entry |
| 7c | Approved role is Partner or Business Client | `App.jsx` prefill state | Switches to the Partners / Customers tab with the registration form **pre-filled**; no record is created yet |
| 7d | Admin submits that form | `Partners.jsx` / `Customers.jsx` | `partners` / `customers` doc created; welcome email (`partner_approval` / `client_approval` with temp password) via `api/send-email.js` |

## 8. Other cross-module writes

- Lead save auto-creates a customer (exact email or phone match for dedupe), `Leads.jsx`.
- Fabrication "Dispatch to Logistics" (manual) creates a `logistics` task and flags the project; Deals and Leads have their own manual create-job buttons. Completing a logistics job changes nothing else.
- Every `toast.*` call also emits a session-only notification feed entry (`src/utils/toast.js`).

## Not found (searched, absent)

Any Firestore trigger; automatic logistics creation on stage change; deal-stage update from fabrication or logistics; invoice email; receipt email; invoice status change on receipt creation; a Google Contacts / Drive scope request in `firebase.js` (see [auth.md](../02_modules/auth.md)).
