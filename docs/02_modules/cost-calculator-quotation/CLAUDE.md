# Cost Calculator & Quotation: module notes for Claude

Full map: [README.md](README.md). Cross-module chains: [CROSS_MODULE_TRIGGERS.md](../../01_architecture/CROSS_MODULE_TRIGGERS.md). Review findings: [FINDINGS.md](FINDINGS.md). There are no Cloud Functions; all automation is client code (`src/App.jsx`, components) or `api/*.js`.

## What it does

Computes price from sq ft via a five-tier engine, then staff draft versioned quotations (manually or with Gemini). An Accepted quotation produces the 75% Advance invoice.

## Code

- `src/components/tools/CostCalculator.jsx`, `src/components/crm/QuotationBuilder.jsx`
- `src/services/pricingEngine.js`, `gemini.js`

## Firestore collections it owns or writes

- Owns `quotations` (ids `QT-xxxxxx`, versions via `parentQuoteId`). Writes `invoices` and `auditLog` through `handleSaveInvoice`.

## Triggers and side effects

- AI draft: `generateStructuredQuotation` -> `/api/generate`.
- Advance invoice needs status `Accepted`; the 75 / 25 split is computed here at `QuotationBuilder.jsx` 89-90.

## Before you edit

- Pricing constants (118.5 manufacturing per sq ft, tier table) live in `pricingEngine.js`; discount and commission are parameters, decided by `getQuotePricingTerms` in `quotePricing.js` (referral: 15% and the partner's rate, default LKR 30.00 flagged `commissionRateDefaulted`; direct: none).
- `cutListEngine.js` and `FrameBlueprintPreview.jsx` belong to Fabrication; `companyInfo.js` is unused.
- `quotations` rules allow any authenticated user to read and write; there is no `quotations` permission module.

- `calculateCost(tier, sqFt, discountPct = 0, commissionRate = 0)`: no hidden discount or commission. Referral leads pass the partner's rate and 15%; direct leads pass neither. A quotation becomes `Invoiced` once its Advance invoice exists; use `isAcceptedQuote` (`src/utils/quotationStatus.js`) wherever a quote must count as accepted.
