# Cost Calculator & Quotation

> Module map. Source: Phase 3 mapping pass (read-only). Line numbers are approximate.

## Files and folders

- `src/features/quotations/CostCalculator.jsx`: standalone page (tab `calculator`, lazy-loaded in `App.jsx`). No Firestore access.
- `src/features/quotations/QuotationBuilder.jsx`: embedded in `LeadCardDetails.jsx`; receives `onSaveInvoice`.
- `src/features/quotations/pricingEngine.js`: tier table, `calculateCost`, `determineTier`.
- `src/services/gemini.js`: `generateStructuredQuotation`, `generateQuotation` (markdown variant); both go through `callProxy` to `/api/generate`.
- `src/constants/emailTemplates.js` (quotation templates), `src/features/invoicing/invoiceTemplate.js`, `src/shared/utils/entityUtils.js` (`matchesEntity`).
- Not part of this module despite the names: `src/utils/cutListEngine.js` and `FrameBlueprintPreview.jsx` (used by Fabrication only); `src/constants/companyInfo.js` is not imported anywhere in `src`.

## Firestore collections read/written

- `quotations`: read via the `App.jsx` subscription; written by `QuotationBuilder` (new doc `QT-xxxxxx` with version number; new versions carry `parentQuoteId`).
- Other modules: `invoices` (via `handleSaveInvoice`), `auditLog` (`INVOICE_CREATED` only; there is no quotation-specific audit entry), invoice ids from `generateInvoiceId`.

## Cloud Functions / triggers

No Cloud Functions. Client-side:

- **AI draft:** the "AI draft" button calls Gemini via `/api/generate`, embedding the lead's `pricingMetadata` and asking that line items sum to the final net payable.
- **Split:** the builder totals line items and splits the grand total **75% advance (`advanceDue`) / 25% balance** (`QuotationBuilder.jsx` 89-90).
- **75% Advance invoice:** button requires quotation status `Accepted` and blocks duplicates; saves an invoice with `quotationId` and copied `lineItems`.
- **25% Final invoice:** a matching manual handler in the builder; also created automatically at deal completion (see [deals.md](../deals/README.md)).
- WhatsApp text is built in the builder (`buildWhatsAppQuoteText`, no AI). Drive files attach in local component state only.
- Not found: docx generation, email sending from quotations, quotation-to-deal or -lead auto-creation.

## Depends on / called by

Leads (`LeadCardDetails` owns the sq-ft inputs and `applyPricingToLead`, which writes `value`, `totalSqFt`, `pricingMetadata` into the lead form), Deals (consumes quotations), Invoices, `gemini` service, `GoogleDrivePickerModal`, `PermissionsContext` (`canAccess(role, 'calculator')`).

## Summary

Sq ft is length x height. `determineTier` picks one of five bands (<=50, <=70, <=100, <=150, 150+ sq ft). `calculateCost` works out manufacturing (sq ft x 118.5), fixed per-tier logistics and QA, tier profit and overhead (about 37-40% of base). Discount and partner commission are parameters (`calculateCost(tier, sqFt, discountPct, commissionRate)`), both 0 by default: `getQuotePricingTerms` (`src/features/quotations/quotePricing.js`) gives a referral lead 15% off and its partner's rate (LKR 30.00 per sq ft, flagged `commissionRateDefaulted`, when the partner has none), and a direct lead neither. `applyPricingToLead` stores the final amount and metadata on the lead. Staff draft quotation line items by hand or with Gemini; quotations are saved as versioned documents (Draft, Sent, Accepted, Rejected), and an Accepted quote produces the 75% Advance invoice.

## Open questions

- Pricing constants (118.5, 40, tier bands) live in `pricingEngine.js`; the referral discount (15%) and default commission (LKR 30.00) live in `quotePricing.js` and are described here as read, not validated against the business.
