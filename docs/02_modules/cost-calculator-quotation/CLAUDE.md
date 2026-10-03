# Cost Calculator & Quotation: module notes for Claude

Full map: [README.md](README.md). Cross-module chains: [CROSS_MODULE_TRIGGERS.md](../../01_architecture/CROSS_MODULE_TRIGGERS.md). Review findings: [FINDINGS.md](FINDINGS.md). There are no Cloud Functions; all automation is client code (`src/App.jsx`, components) or `api/*.js`.

## What it does

Computes price from sq ft via a five-tier engine, then staff draft versioned quotations (manually or with Gemini). An Accepted quotation produces the 75% Advance invoice.

## Code

- `src/features/quotations/CostCalculator.jsx`, `src/features/quotations/QuotationBuilder.jsx`
- `src/features/quotations/pricingEngine.js`, `gemini.js`

## Firestore collections it owns or writes

- Owns `quotations` (ids `QT-xxxxxx`, versions via `parentQuoteId`). Writes `invoices` and `auditLog` through `handleSaveInvoice`; Advance and Final invoices take `leadId` and `dealId` from `invoiceLineageFields` (`src/features/leads/leadLineage.js`).

## Triggers and side effects

- AI draft: `generateStructuredQuotation` -> `/api/generate`.
- Advance invoice needs status `Accepted`; the 75 / 25 split is computed here at `QuotationBuilder.jsx` 89-90.

## Before you edit

- Pricing constants (118.5 manufacturing per sq ft, tier table) live in `pricingEngine.js`; discount and commission are parameters, decided by `getQuotePricingTerms` in `quotePricing.js` (referral: 15% and the partner's rate, default LKR 38.00 flagged `commissionRateDefaulted`; direct: none). `DEFAULT_REFERRAL_COMMISSION_RATE` is the only default commission in the app (owner decision DEC-1); import it, never write a number. `sqFtFromPricing` recovers area from a saved quote using the rate that quote was priced at.
- `cutListEngine.js` and `FrameBlueprintPreview.jsx` belong to Fabrication; `companyInfo.js` is unused.
- `quotations` rules allow any authenticated user to read and write; there is no `quotations` permission module.

- `calculateCost(tier, sqFt, discountPct = 0, commissionRate = 0)`: no hidden discount or commission. Referral leads pass the partner's rate and 15%; direct leads pass neither. A quotation becomes `Invoiced` once its Advance invoice exists; use `isAcceptedQuote` (`src/features/quotations/quotationStatus.js`) wherever a quote must count as accepted.
- Both invoice buttons `await onSaveInvoice`; a `false` result (MON-4 guard refusal) or a rejection stops before the success toast and before the quotation is marked `Invoiced` (MON-13). `onSaveInvoice` must return `false` to refuse.
- Drive attachments come from Google Picker (`pickDriveFiles`, `drive.file` scope) and the button shows only for the super admin (DEC-8). Saved quotes keep `attachedFiles` as `{ id, name, mimeType, webViewLink }`; everyone still sees and can remove attached files.
- MON-7: the flag is set in `LeadCardDetails.applyPricingToLead` (not in `QuotationBuilder`). A defaulted rate there also stores a `commission` notification per active Admin and Manager; the Leads screen can filter on the flag.
