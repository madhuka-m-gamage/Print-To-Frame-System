# Operations: Logistics

> Module map. Source: Phase 3 mapping pass (read-only). Line numbers are approximate.

## Files and folders

- `src/features/logistics/Logistics.jsx`: Kanban (Pending, In Transit, Completed) with Pickup and Delivery sub-tabs, add-job form, AI route suggestion.
- `src/features/logistics/LogisticsCardDetails.jsx`: job detail modal: COD calculation, WhatsApp notify, Maps link, print.
- `src/features/logistics/logisticsEngine.js`: `FLEET_VEHICLES`, `DRIVER_DIRECTORY` (hardcoded), `getGoogleMapsUrl`, `getWhatsAppUrl`, `formatDispatchMessage`, `calculateCODFromInvoices`.
- `src/services/googleMapsService.js` and `src/shared/components/AddressPickerModal.jsx`: address picker; **only `Customers.jsx` uses it**, Logistics does not.
- Wiring: `src/App.jsx` (lazy import, `logisticsJobs` state, subscription, nav, route), `src/services/firestoreSync.js` (`LOGISTICS: 'logistics'`), `src/services/dataDefaults.js`, `firestore.rules` (logistics block), logistics email templates in `src/constants/emailTemplates.js`.

## Firestore collections read/written

- `logistics`: created by `Logistics.jsx`, `Deals.jsx` (delivery), `Leads.jsx` (pickup) and `FabricationWorks.jsx` (dispatch); updated and deleted from `Logistics.jsx`. Ids from `generateAtomicId('L-DL' | 'L-PK')`.
- Read-only props from `App.jsx`: `customers`, `projects`, `invoices`, `partners`.
- Writes to other modules' collections: none from inside the Logistics components. (`FabricationWorks.jsx` writes `dispatchedToLogistics` / `logisticsTaskId` to `projects` when it dispatches.)

## Cloud Functions / triggers

No Cloud Functions. Client-side:

- **Status changes are all manual** (forward / back buttons and drag-drop). Pending to In Transit stamps `startTime`; In Transit to Completed stamps `endTime` and `duration`; moving back clears them.
- **Job creation is always a manual click:** Logistics form (`L-PK` / `L-DL`), Deals `handleCreateDeliveryJob`, Leads `handleCreateLogisticsJob` (Pickup), Fabrication "Dispatch to Logistics". No automatic creation.
- **Computation:** only `calculateCODFromInvoices` (balance due from `invoices`). No delivery pricing. Route suggestion: `handleOptimizeRoute` builds a prompt from a hardcoded hub ("Kadawatha Central Hub") and POSTs to `/api/generate`; on failure it shows a hardcoded string.
- **Google Maps:** deep links only in Logistics (`getGoogleMapsUrl`). The Maps JS API (Places / Geocoder, key `VITE_GOOGLE_MAPS_API_KEY`) loads only through `AddressPickerModal` (Customers). No Distance Matrix or Directions usage.
- **Customer notification:** manual WhatsApp click-to-chat; sets `notified: true` and `lastNotifiedAt`. No server-side email or SMS.
- **Effect on deals / projects when Completed:** not found. `Deals.jsx` shows a logistics badge by matching jobs (`matchesEntity`).

## Depends on / called by

Depends on `shared/ui`, `Card`, `DeleteModal`, `toast`, `invoiceTemplate` (print), `validation` (`stripEmojis`), `/api/generate`. Consumed by `Dashboard.jsx` (counts Pending jobs); jobs are created from Leads, Deals and Fabrication; `entityUtils.js` documents the Lead, Deal, Project, Logistics chain.

## Summary

A client-side Kanban of pickup and delivery jobs in the `logistics` collection, live via `App.jsx`. Jobs are created by hand or by buttons in Leads, Deals and Fabrication; every status change is user-driven. Computed values are COD from invoices and an AI-suggested route text. Nothing propagates back to deals or projects.

## Open questions

- Driver and vehicle lists are hardcoded in `logisticsEngine.js`, not stored.
- The route-optimisation hub is hardcoded.
