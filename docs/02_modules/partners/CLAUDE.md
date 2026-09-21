# Partners: module notes for Claude

Full map: [README.md](README.md). Cross-module chains: [CROSS_MODULE_TRIGGERS.md](../../01_architecture/CROSS_MODULE_TRIGGERS.md). Review findings: [FINDINGS.md](FINDINGS.md). There are no Cloud Functions; all automation is client code (`src/App.jsx`, components) or `api/*.js`.

## What it does

Partner / referral network: public application, admin approval, QR referral link, referred leads, commission ledger.

## Code

- `src/features/partners/Partners.jsx`, `PartnerQRModal.jsx`; `src/features/partners/PartnerRegistration.jsx`, `ReferralForm.jsx`
- Approval in `src/components/admin/AgentDatabase.jsx`; accrual in `Deals.jsx`; eligibility in `src/App.jsx`

## Firestore collections it owns or writes

- Owns `partners`, `partner_applications`, `referral_claims`. `partner_payouts` is defined but **unused**. Creates `leads` from the referral form.

## Triggers and side effects

- Commission accrues when the deal is Completed (`Deals.jsx`); eligibility at full payment (`App.jsx`, and the Partners screen through `invoicesForLineage`).
- **"Disburse Payout" is a toast only**; nothing is written and `pending` is never reduced.

## Before you edit

- `firestore.rules` has no block for `referral_claims` or `partner_payouts` (catch-all deny in the committed file).
- Ledger states are derived on the fly in `Partners.jsx`, not stored.
- Partner users are restricted to dashboard, notifications, partners, profile (route guard + matrix).
