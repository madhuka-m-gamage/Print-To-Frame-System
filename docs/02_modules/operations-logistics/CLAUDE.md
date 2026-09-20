# Operations: Logistics: module notes for Claude

Full map: [../operations-logistics.md](../operations-logistics.md). Cross-module chains: [CROSS_MODULE_TRIGGERS.md](../../01_architecture/CROSS_MODULE_TRIGGERS.md). Review findings: [FINDINGS.md](FINDINGS.md). There are no Cloud Functions; all automation is client code (`src/App.jsx`, components) or `api/*.js`.

## What it does

Kanban of pickup and delivery jobs (Pending, In Transit, Completed) with COD from invoices, Maps links and manual WhatsApp notify.

## Code

- `src/components/operations/Logistics.jsx`, `LogisticsCardDetails.jsx`, `src/utils/logisticsEngine.js`

## Firestore collections it owns or writes

- Owns `logistics` (ids `L-DL-…` / `L-PK-…`). Created also by Deals, Leads and Fabrication buttons.

## Triggers and side effects

- All status changes and job creation are manual. AI route suggestion via `/api/generate` (hardcoded hub). No effect on deals or projects when Completed.

## Before you edit

- `DRIVER_DIRECTORY`, `FLEET_VEHICLES` and the route hub are hardcoded in code.
- `AddressPickerModal` / Maps JS API are used by Customers, not Logistics.

- COD: `calculateCODFromInvoices` counts only the latest unpaid Final invoice. A paid Advance with no Final returns `finalInvoicePending: true` and the shortfall against the Advance's `totalValue` (or amount / 0.75), and the UI shows it as pending Final invoice creation instead of settled.

- Create every logistics task with `buildLogisticsTask`; it guarantees `customerPhone`, `linkedJobNo`, entity ids, `priority` and `createdAt`. Delivery stage moves write `deliveryStatus` to the linked project (`deliveryStatusForTask`). Stage handlers restore the previous card on a failed write.
- "Record cash collection" (`handleCollectCod`) only offers the primary unpaid invoice (`getCollectableInvoice`) and only to roles with invoices edit and receipts create. It marks the invoice paid via `handleMarkInvoicePaid`, then issues the receipt.
