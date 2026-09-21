# Customers: module notes for Claude

Full map: [README.md](README.md). Cross-module chains: [CROSS_MODULE_TRIGGERS.md](../../01_architecture/CROSS_MODULE_TRIGGERS.md). Review findings: [FINDINGS.md](FINDINGS.md). There are no Cloud Functions; all automation is client code (`src/App.jsx`, components) or `api/*.js`.

## What it does

A client registry keyed by NIC or business registration number, filled manually, by Google Contacts import, by lead save / conversion, and by admins after a Business Client approval.

## Code

- `src/components/crm/Customers.jsx`, `ContactSyncModal.jsx`, `src/services/contactsService.js`, `src/utils/stringMatch.js`

## Firestore collections it owns or writes

- Owns `customers`. Deletes the matching `users` doc (and Auth login) when a Business Client customer is deleted.

## Triggers and side effects

- `Leads.jsx` auto-creates `AUTO-######` customers (exact email / phone dedupe) and increments `orders` on conversion.
- Register Client form is pre-filled after approval; submitting it sends the `client_approval` / `client_activation_confirmed` email.

## Before you edit

- Only delete is audit-logged from this file.
- Google Contacts sync calls the People API with the sign-in token, but `firebase.js` requests no Contacts scope ([auth.md](../auth/README.md)).

- Phone matching uses `normalizePhone` / `phonesMatch` (`src/utils/validation.js`) in lead-to-customer matching, customer stats and the contact import; never compare stored phones with `===`.
