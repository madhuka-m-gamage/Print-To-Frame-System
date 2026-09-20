# Deals: module notes for Claude

Full map: [../deals.md](../deals.md). Cross-module chains: [CROSS_MODULE_TRIGGERS.md](../../01_architecture/CROSS_MODULE_TRIGGERS.md). Review findings: [FINDINGS.md](FINDINGS.md). There are no Cloud Functions; all automation is client code (`src/App.jsx`, components) or `api/*.js`.

## What it does

Deals is the post-sale Kanban (Waiting, Fabricating, Ready To Load, Hand Over, Completed) over `leads` documents flagged `isDeal`. Completing a deal creates the 25% Final invoice.

## Code

- `src/components/crm/Deals.jsx`, `Leads.jsx` (conversion), `LeadCardDetails.jsx`
- `src/utils/entityUtils.js` (`matchesEntity`), `logisticsEngine.js`; handlers in `src/App.jsx`

## Firestore collections it owns or writes

- **No `deals` collection is used.** Deals live in `leads`. Writes `invoices`, `partners` (commission), `logistics` (manual), plus `customers` / `projects` on conversion.

## Triggers and side effects

- Hand Over: accrues partner commission (`sqFt x rate`).
- Hand Over to Completed: reserves a Final invoice id (aborts if it fails), creates a 25% Final invoice.
- Stage moves do not sync the fabrication project.

## Before you edit

- **Duplicate Final invoice risk:** fabrication QA pass also creates a Final invoice and neither path checks for an existing one ([CROSS_MODULE_TRIGGERS.md](../../01_architecture/CROSS_MODULE_TRIGGERS.md) chains 3 and 4).
- The `deals` block in `firestore.rules` and the `pipeline` permission do not govern real deal data.
