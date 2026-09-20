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
