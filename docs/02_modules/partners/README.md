# Partners

> Module map (partner / referral / agent network). Source: Phase 3 mapping pass (read-only). Line numbers are approximate.

## Files and folders

- `src/features/partners/Partners.jsx`: admin directory, partner self-service view, referral claims, settlements, commission ledger.
- `src/features/partners/PartnerQRModal.jsx`: QR flyer and referral link kit (`${origin}/referral?ref=<partnerId>`, QR rendered by external `api.qrserver.com`; not stored).
- `src/features/partners/PartnerRegistration.jsx`: public application form (route in `src/main.jsx`: `/partner/register` or `/register-partner`).
- `src/features/partners/ReferralForm.jsx`: public referral landing page (`/referral?ref=<partnerId>`).
- `src/features/admin/AgentDatabase.jsx`: reviews and approves partner applications.
- `src/App.jsx`: subscriptions, approval hand-off, payout-eligibility logic.
- `src/features/deals/Deals.jsx`: commission accrual. Partner fields also appear in `Leads.jsx`, `LeadCardDetails.jsx` (agent picker) and `Receipts.jsx`.
- Supporting: `src/services/firestoreSync.js` (collection names), `src/constants/emailTemplates.js`, `src/features/admin/adminUsers.js`, `api/admin-user.js`.

## Firestore collections read/written

- `partners`: written by `Partners.jsx` (add, update, delete), `Deals.jsx` (commission accrual) and `App.jsx` (photo and contact fields).
- `partner_applications`: created by `PartnerRegistration.jsx` (`status: 'Pending'`, `defaultCommissionRate: DEFAULT_REFERRAL_COMMISSION_RATE`, LKR 38.00); `AgentDatabase.jsx` sets Approved or Rejected.
- `referral_claims`: created in `Partners.jsx` (`Pending Verification`), verified to `Verified & Linked`.
- `partner_payouts`: written by Disburse Payout (`Partners.jsx` `handleDisbursePayout`, FEA-1), one record per payout: `partnerId`, `partnerEmail`, `partnerName`, `amount`, `reference` (`TXN-######`), `leadIds`, `createdAt`, `createdBy`. Not read anywhere in `src` yet.
- Other modules: `leads` (created by `ReferralForm.jsx`; `referralStatus` / `invoicePaid` written by `App.jsx`), `users` (deleted when a partner is removed; written on approval), Firebase Auth (created / deleted via `api/admin-user.js`).

## Cloud Functions / triggers

No Cloud Functions. Client-side:

- **Accrual:** when a deal reaches Completed, `partners.pending += sqFt x commissionRate` once (`Deals.jsx`, `calculateDealCommission`; rate read live from the partner, fallback LKR 38.00/sq ft (`DEFAULT_REFERRAL_COMMISSION_RATE`), or an estimate from the value when the area is 0). It happens in the same move that creates the Final invoice; see [deals.md](../deals/README.md). The Partners screen lists a Deal, never its converted lead stub, and treats it as payable only once its invoices are fully paid.
- **Ledger state** (`Partners.jsx`, derived on the fly, not stored): Cancelled (stage Lost / Rejected), Paid & Settled (`payoutStatus` Paid / Settled), Eligible for Payout (fully paid, `referralStatus` Eligible, or stage Delivered / Completed), Accrued (In Production), Quoted / Pending Acceptance, Pending Quote.
- **Pending to eligible:** in `App.jsx`, when a referred lead's invoices are fully paid, `referralStatus` becomes `Eligible for Payout` and a one-time `commission` notification is emitted (`emitNotification`).
- **Eligible to paid (FEA-1):** "Disburse Payout" on Monthly Settlements takes the partner's Eligible for Payout referrals (`buildPayout`, `payout.js`) and commits one `batchWrite`: the `partner_payouts` record, `payoutStatus: 'Paid'` and `payoutReference` on each lead, and the partner's `pending` reduced and `settled` increased by `increment()` deltas (MON-14, not floored at 0). Nothing eligible: info toast, no write; a failed batch: error toast, nothing changed locally. Only an Admin may write `partner_payouts` under the rules.
- **Referral form to lead:** `ReferralForm.jsx` looks up the partner and writes a lead with `source: 'Referral'`, `stage: 'Intake'`, a 5-minute callback SLA and the partner's rate.
- **Registration and approval:** public form uploads BR and NIC files to Storage and writes the application; `AgentDatabase.jsx` creates the Auth account with an admin-set password, then `onApprove` runs; `App.jsx` pre-fills the Register Partner form and switches tab; the admin completes the profile (rate, bank details), which creates the `partners` doc.
- **Emails:** `partner_approval` (with temp password) or `partner_activation_confirmed`, and `password_reset`, via `sendTemplatedEmail`.
- **Audit log:** delete, password reset and payouts (`PAYOUT_DISBURSED`) are logged from `Partners.jsx`; create, edit and claims are not.

## Depends on / called by

Leads and Deals (read leads, invoices for payment status), Invoices / payments in `App.jsx` (eligibility), User Management (`AgentDatabase`, `users`, pending users), Notifications (`emitNotification`), `mailer`, `adminUsers`, `auditLog`, `firestoreSync`, `PermissionsContext` (`canAccess(..., 'partners')` and the Partner-role route lock in `App.jsx`).

## Summary

Agencies apply through a public form; an admin approves in User Management, which creates a login and opens the Register Partner form. The admin completes the profile and a welcome email goes out. The partner shares a QR / link to the referral form, whose submissions become Intake leads tagged to the partner. When a referred deal's invoices are fully paid the lead is flagged Eligible for Payout and a notification fires. Commission states are derived in the ledger from lead and invoice data. An Admin settles the eligible commissions from Monthly Settlements, which records a `partner_payouts` entry and marks the leads paid (FEA-1).

## Open questions

- The bank transfer itself happens outside the app; Disburse Payout records it. A Manager sees the button but the rules reject their payout (Admin only).
- Accrual happens at deal Completed but eligibility at full payment; the two conditions can diverge. Quoting, accrual and payout all use the same LKR 38.00 default (DEC-1).
