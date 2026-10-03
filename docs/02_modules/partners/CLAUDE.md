# Partners: module notes for Claude

Full map: [README.md](README.md). Cross-module chains: [CROSS_MODULE_TRIGGERS.md](../../01_architecture/CROSS_MODULE_TRIGGERS.md). Review findings: [FINDINGS.md](FINDINGS.md). There are no Cloud Functions; all automation is client code (`src/App.jsx`, components) or `api/*.js`.

## What it does

Partner / referral network: public application, admin approval, QR referral link, referred leads, commission ledger.

## Code

- `src/features/partners/Partners.jsx`, `PartnerQRModal.jsx`; `src/features/partners/PartnerRegistration.jsx`, `ReferralForm.jsx`
- Approval in `src/features/admin/AgentDatabase.jsx`; accrual in `Deals.jsx`; eligibility in `src/App.jsx`

## Firestore collections it owns or writes

- Owns `partners`, `partner_applications`, `referral_claims`, `partner_payouts` (written by Disburse Payout). Creates `leads` from the referral form.

## Triggers and side effects

- A lead or deal links to its partner by `partnerId` or `agentId` (`'Direct'` means none); always resolve it with `getLeadPartnerId` / `findPartnerForLead` (`src/features/partners/partnerLink.js`), never a single field. Choosing an agent on the lead card writes `agentId`, `partnerId`, both names and the partner's rate, and quoting uses the partner's current rate (`pricingLeadView`). The public referral form no longer invents a 53.5 rate.
- The default partner commission is `DEFAULT_REFERRAL_COMMISSION_RATE` (LKR 38.00 per sq ft, `src/features/quotations/quotePricing.js`, owner decision DEC-1): new partners, applications, the ledger, payment-cleared and deal-completion fallbacks, and email previews all use it.
- Commission accrues when the deal is Completed (`Deals.jsx`); eligibility at full payment (`App.jsx`, and the Partners screen through `invoicesForLineage`).
- "Disburse Payout" (`handleDisbursePayout`, FEA-1) builds the payout with `buildPayout` (`payout.js`, eligible referrals only) and commits one `batchWrite`: a `partner_payouts` record with a `TXN-######` reference, `payoutStatus: 'Paid'` on each lead, and the partner's `pending` reduced and `settled` increased; then logs `PAYOUT_DISBURSED`. Only an Admin may write `partner_payouts` (rules), and it works live only once those rules are deployed (LIVE-1).
- The same batch creates a `payout_guards/<lead doc id>` document per paid lead (MON-11, `COLLECTIONS.PAYOUT_GUARDS`). The rules make guards create-only (Admin, with the named `partner_payouts` record in the same write), so a second payout of a paid lead is refused as a whole. Balances are still computed from the screen copy: concurrent payouts of different referrals can overwrite each other's `pending`/`settled`.

## Before you edit

- `firestore.rules` has `referral_claims` and `partner_payouts` blocks (Phase 7 3.4, partners D-6); they are not deployed until LIVE-1, so the live catch-all still denies those writes.
- Ledger states are derived on the fly in `Partners.jsx`, not stored.
- Partner users are restricted to dashboard, notifications, partners, profile (route guard + matrix).
- FEA-2: "Verify & Credit Commission" opens a Resolve Referral Claim modal (`handleResolveClaim`). Link to Lead sets `partnerFieldsFor(partner)` on the chosen lead; Create New Lead adds a `source: 'Referral'`, stage `Intake` lead with an id from `generateAtomicId('L')`. Either marks the claim `Verified & Linked` with `linkedLeadId`. Commission-cleared notifications for the partner are written by `handleMarkInvoicePaid` to `notifications` (see the notifications module).
- SEC-7 (rules not deployed): a Partner reads only its own `partners` record (`ownsPartner`: doc id or `email` equals the login email, exact match) and its own `referral_claims` (`partnerEmail`). `App.jsx` subscribes a Partner with `where('email', '==', identifier)` and `Partners.jsx` reads its claims with `where('partnerEmail', '==', identifier)`. A Partner's Edit saves only `PARTNER_EDITABLE_FIELDS` (the commission rate input is hidden and BR number disabled for it); the rules refuse `commissionRate`, `status`, `email` and balances. Partner emails must be stored lowercased (Register Partner now lowercases them).
- SEC-8 (rules not deployed): a Partner reads only the leads whose `partnerId` or `agentId` is its `partners` document id, and those leads' invoices by `leadId` (rules `ownsPartnerRecord` / `isReferringPartnerOf`). `App.jsx` subscribes a Partner with `where('partnerId'|'agentId', '==', <doc id>)` on leads, then one `where('leadId', '==', id)` per lead on invoices, once its own partners record has loaded. A partner's leads must name its document id (Register Partner uses `partnerId` as the document id).
- Storage (`storage.rules`, DEC-3): the document vault writes `partners/<partnerId>/` (staff only, images or PDFs under 10MB). The public registration form writes `partners/applications/<APP-id>/br_...` and `nic_...` (signed out, under 5MB, add-only) and stores `brCertPath` / `nicCopyPath` on the application, not a download link. Staff open them from the application review in `AgentDatabase.jsx` (Open BR copy / Open NIC copy, resolved with `getDownloadURL` on click, FEA-11).
