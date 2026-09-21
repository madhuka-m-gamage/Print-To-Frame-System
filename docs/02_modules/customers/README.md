# Customers

> Module map. Source: Phase 3 mapping pass (read-only). Line numbers are approximate.

## Files and folders

- `src/components/crm/Customers.jsx`: main UI (registry, create form, detail view with related leads / invoices / projects, CSV export, AI-drafted WhatsApp message).
- `src/components/crm/ContactSyncModal.jsx` and `src/services/contactsService.js`: one-way Google Contacts import (People API `connections`, using the user's access token). Only `Customers.jsx` uses them.
- `src/utils/stringMatch.js`: `findCustomerDuplicates` (fuzzy match, default threshold 0.72).
- `src/App.jsx`: lazy load, `customers` state, subscription, tab route, and the approval hand-off.
- `src/services/dataDefaults.js` (`defaultCustomers = []`), `src/services/firestoreSync.js` (`COLLECTIONS.CUSTOMERS`), `firestore.rules` (customers block).
- `api/`: no customer-specific handler; `api/admin-user.js` is touched only through `deleteUserAccount`.

## Firestore collections read/written

- `customers`: read via the `App.jsx` subscription. Written from `Customers.jsx` (Google import, create form, delete; the doc id is the NIC / business registration number) and from `Leads.jsx` (auto-create, `orders` increment).
- `users`: `Customers.jsx` deletes the matching `users/{email}` doc when a Business Client customer is deleted (another module's collection).
- `leads`, `invoices`, `projects`: read only, to aggregate per-customer stats (matched by NIC, `customerId`, email, phone or name).

## Cloud Functions / triggers

No Cloud Functions. Client-side:

- **Lead save auto-creates a customer** (`Leads.jsx`): exact match on email or phone for dedupe; a new customer gets an `AUTO-######` id and `orders: 1`; an existing match is left untouched.
- **Lead conversion** (`Leads.jsx`): existing customer gets `orders + 1`, otherwise a new `AUTO-` customer.
- **Google Contacts import:** skips contacts whose email or phone matches; new ones get a `NIC-<time>-<rand>` id and the address "Google Contacts Sync". Nothing is written back to Google.
- **Manual create:** fuzzy duplicate warning (threshold 0.75) and an exact-NIC block.
- **Business Client approval** (`App.jsx` `approvePending`, `AgentDatabase.jsx`): does **not** create a customer. It pre-fills the Register Client form (`setClientApprovalPrefill`) and switches to the customers tab; a customer is created only when an admin submits that form. After that, `sendTemplatedEmail` sends `client_approval` (with a temp password) or `client_activation_confirmed`.
- **Delete:** removes the customer doc; if a `users` record with the same email and role `Business Client` exists, deletes it and calls `deleteUserAccount` (revokes the Firebase Auth login). Only this action is written to the audit log from `Customers.jsx`.
- `generateText` (Gemini) drafts a WhatsApp message on user request; it writes no data.
- Not found: audit entries for create or import, field-edit handling for existing customers (not traced).

## Depends on / called by

- Depends on: `services/mailer`, `auditLog`, `adminUsers`, `gemini`, `firebase` (`getAccessToken`), `utils/csvExport`, `AddressPickerModal`, `ImageCropModal`, `ActivityTimeline`, `PermissionsContext`.
- Used by: `Leads.jsx` (writes), `Deals.jsx` (props only), `FabricationWorks.jsx` and `Logistics.jsx` (lookups by NIC or name), `Dashboard.jsx` (count in AI prompt), `PartnerQRModal.jsx`, `LeadCardDetails.jsx`, `PermissionsContext` / `PermissionsManager` (`customers` permission key).

## Summary

Customers is a client registry in the `customers` collection keyed by NIC or business registration number, kept live by `App.jsx`. Records arrive from manual entry, a one-way Google Contacts import, automatic creation or `orders` increment when leads are saved or converted, and admin completion of the Register Client form after a Business Client approval. The detail view aggregates related leads, invoices and projects. Deleting a customer also removes the matching Business Client login.

## Open questions

- `CLAUDE.md` says approval "auto-provisions" a matching customer or partner; the code pre-fills the registration form instead (see [user-management-rbac.md](../user-management-rbac/README.md)). One of the two is out of date.
- Customer matching is by exact email or phone at lead time, but by fuzzy name / NIC in the UI, so duplicates are possible across the two paths.
