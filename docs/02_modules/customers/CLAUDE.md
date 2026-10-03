# Customers: module notes for Claude

Full map: [README.md](README.md). Cross-module chains: [CROSS_MODULE_TRIGGERS.md](../../01_architecture/CROSS_MODULE_TRIGGERS.md). Review findings: [FINDINGS.md](FINDINGS.md). There are no Cloud Functions; all automation is client code (`src/App.jsx`, components) or `api/*.js`.

## What it does

A client registry keyed by NIC or business registration number, filled manually, by Google Contacts import, by lead save / conversion, and by admins after a Business Client approval.

## Code

- `src/features/customers/Customers.jsx`, `ContactSyncModal.jsx`, `src/services/contactsService.js`, `src/shared/utils/stringMatch.js`

## Firestore collections it owns or writes

- Owns `customers`. Deletes the matching `users` doc (and Auth login) when a Business Client customer is deleted.

## Triggers and side effects

- `Leads.jsx` auto-creates `AUTO-######` customers (exact email / phone dedupe) and increments `orders` on conversion.
- Register Client form is pre-filled after approval; submitting it sends the `client_approval` / `client_activation_confirmed` email.

## Before you edit

- Only delete is audit-logged from this file.
- Google Contacts sync (People API, `contacts.readonly` requested on demand) is offered to the super admin only (DEC-8, `canUseGoogleWorkspace`); the Sync Contacts button is hidden for everyone else.

- `userId` links a row to its login (the Auth uid, FEA-15): registration stores `uid` on `pendingUsers` (and an application approval takes it from `/api/admin-user`), approval copies it to `users`, and the Business Client hand-off pre-fills it into the Register Client form, which saves it. A client reads and updates (`name`, `photoURL`, `phone`, `address` only) the row whose `userId` is their uid, or whose `email` / `nic` is their login email. Rows made by leads, imports or a manual add carry no `userId`.
- An Admin can link an unlinked row from the customer detail panel (FEA-17): the "Linked login" select lists Customer and Business Client `users` with a `uid`, an email match first, and "Link login" writes `userId` and logs an audit entry. Hidden from non-Admins.

- Phone matching uses `normalizePhone` / `phonesMatch` (`src/shared/utils/validation.js`) in lead-to-customer matching, customer stats and the contact import; never compare stored phones with `===`.
