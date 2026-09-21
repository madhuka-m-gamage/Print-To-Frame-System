# Customers Module Review & Correctness Audit Findings

> **Scope**: Correctness review of `docs/02_modules/customers/CLAUDE.md`, `docs/02_modules/customers/README.md`, and all cross-module triggers touching Customers documented in `docs/01_architecture/CROSS_MODULE_TRIGGERS.md`.  
> **Branch / Worktree**: `review-customers` (`.worktrees/review-customers`)  
> **Status**: Review & Audit findings (no functional code modified).

---

## 1. Executive Summary

A comprehensive architectural and code-level audit was conducted across the Customers module and its integration touchpoints:
- **Module Documentation**: `docs/02_modules/customers/CLAUDE.md`, `docs/02_modules/customers/README.md`
- **Cross-Module Architecture**: `docs/01_architecture/CROSS_MODULE_TRIGGERS.md`
- **UI Components**: `src/components/crm/Customers.jsx`, `src/components/crm/ContactSyncModal.jsx`, `src/shared/ui/StatusBadge.jsx`
- **Services & Utilities**: `src/services/contactsService.js`, `src/shared/utils/stringMatch.js`, `src/services/firebase.js`, `src/services/mailer.js`, `src/services/adminUsers.js`, `src/shared/utils/validation.js`
- **Integration & Security Surfaces**: `src/App.jsx`, `firestore.rules`, `src/components/crm/Leads.jsx`, `src/components/crm/LeadCardDetails.jsx`, `src/components/operations/FabricationWorks.jsx`, `src/components/common/UserProfile.jsx`

While the core registry design (client registry keyed by NIC/BRN, Google Contacts import modal, approval handoff via prefill) exists as described, **several critical defects, data disconnects, RBAC security asymmetries, and workflow breaking bugs** were discovered:
1. **Double Order Count Bug**: Saving a lead creates a customer with `orders: 1`. Converting that lead later increments `orders` to `2`, so a single incoming order is counted twice.
2. **Disconnected Fabrication Project `clientNIC`**: Upon Deal conversion in `Leads.jsx`, project creation generates an arbitrary random `AUTO-######` NIC rather than using the customer's actual NIC, severing the link between the Customer and their fabrication project.
3. **Phone Format Mismatch in Lead Deduplication**: `formatPhone` formats lead phone numbers with spaces (`+94 7X XXX XXXX`), while customer creation stores unspaced numbers (`+947XXXXXXXX`). Exact string matching in `Leads.jsx` fails, auto-creating duplicate customer records.
4. **Google Contacts Sync OAuth Scope Missing**: `firebase.js` requests only basic profile/email scopes and omits `contacts.readonly`. Any attempt to sync contacts via Google People API returns HTTP 403 Forbidden. Furthermore, email/password logins crash on contact sync due to a null access token.
5. **False-Positive Deduplication in Contact Import**: Contacts without an email are checked with `existing.email === c.email` (`"" === ""`), causing all subsequent email-less contacts to be silently skipped.
6. **No Edit Functionality**: Existing customer profiles cannot be edited anywhere in `Customers.jsx` (`updateDocument` is not even imported).
7. **RBAC & Cascading Delete Asymmetry**: Managers are permitted to delete customers (`customers.delete: true`), but deleting a Business Client requires deleting their `users` document and Firebase Auth login—both of which require Admin role in `firestore.rules` and `api/admin-user.js`. A Manager deletion deletes the customer document but leaves the user login active and throws an unhandled error.
8. **Permission Denials on Initial App Load**: `App.jsx` unconditionally subscribes all approved users to `COLLECTIONS.CUSTOMERS`, but roles `Customer`, `Business Client`, and `Partner` have no read permissions in `firestore.rules`, throwing console permission-denied errors on startup.
9. **Zero Orders Display Masking**: `{selectedCustomer.orders || 1}` renders `orders: 0` as `1`, misrepresenting imported contacts.

---

## 2. Review of Module Documentation

### 2.1 `docs/02_modules/customers/CLAUDE.md`

| Section / Claim | Code Status | Details / Discrepancy |
|---|---|---|
| **What it does** ("A client registry keyed by NIC or business registration number...") | **Accurate** | Primary key and document ID in Firestore is `nic`. However, auto-generated records from leads use `AUTO-######`, Google sync uses `NIC-######-###`, and manual entry uses user-supplied strings. |
| **Firestore collections it owns or writes** ("Owns `customers`. Deletes matching `users` doc (and Auth login) when a Business Client customer is deleted.") | **Partially Accurate / Fragile** | Confirmed in `handleDeleteProfile`, but fails with a permission-denied / 403 error if triggered by a non-Admin user (e.g., Manager) who has customer delete rights. |
| **Triggers and side effects** ("`Leads.jsx` auto-creates `AUTO-######` customers... and increments `orders` on conversion") | **Accurate but Buggy** | Confirmed, but lead save sets `orders: 1`, and conversion increments `orders + 1`, producing a double-count bug (`orders: 2`). |
| **Triggers and side effects** ("Register Client form is pre-filled after approval; submitting it sends the `client_approval` / `client_activation_confirmed` email.") | **Accurate** | Confirmed: `App.jsx:L840` sets `clientApprovalPrefill` and switches tab to `customers`. Submission in `Customers.jsx:L246` calls `sendTemplatedEmail`. |
| **Before you edit** ("Only delete is audit-logged from this file.") | **Accurate** | Confirmed: Neither manual customer creation nor contact import writes to `auditLog`. Only `handleDeleteProfile` calls `logActivity`. |
| **Before you edit** ("Google Contacts sync calls People API... but `firebase.js` requests no Contacts scope") | **Accurate** | Confirmed: `firebase.js:L44-45` adds only `userinfo.email` and `userinfo.profile`. |

### 2.2 `docs/02_modules/customers/README.md`

| Section / Claim | Code Status | Details / Discrepancy |
|---|---|---|
| **Files and Folders** ("`Customers.jsx`: main UI... CSV export, AI-drafted WhatsApp message") | **Accurate** | Confirmed. |
| **Files and Folders** ("`stringMatch.js`: `findCustomerDuplicates` (fuzzy match, default threshold 0.72)") | **Partially Accurate** | Default parameter in `stringMatch.js:L70` is 0.72, but `Customers.jsx:L195` explicitly overrides this by invoking `findCustomerDuplicates(newProfile, customers, 0.75)`. |
| **Firestore collections read/written** ("`leads`, `invoices`, `projects`: read only, to aggregate per-customer stats") | **Accurate** | Confirmed in `getCustomerStats` (`Customers.jsx:L263-297`). |
| **Cloud Functions / triggers** ("Lead save auto-creates a customer... exact match on email or phone for dedupe") | **Accurate** | Confirmed, but phone comparison fails when phone numbers contain formatting spaces from `formatPhone`. |
| **Cloud Functions / triggers** ("Google Contacts import: skips contacts whose email or phone matches...") | **Accurate but Buggy** | Empty string comparison `"" === ""` causes all subsequent contacts without email to be skipped. |
| **Open questions** ("`CLAUDE.md` says approval 'auto-provisions' a matching customer... the code pre-fills the registration form instead") | **Resolved in Code** | Code clearly uses pre-fill handoff via `prefillClient` / `setClientApprovalPrefill`; no auto-provisioning occurs. Documentation is now reconciled. |
| **Open questions** ("Customer matching is by exact email or phone at lead time, but by fuzzy name / NIC in the UI...") | **Confirmed Issue** | In `Leads.jsx`, matching is exact string. In `Customers.jsx`, manual creation warns on fuzzy match (0.75), but allows saving anyway. `getCustomerStats` falls back to exact name matching. |

---

## 3. Cross-Module Triggers Audit (`CROSS_MODULE_TRIGGERS.md`)

### Trigger 2: Lead Converts to Deal

* **Trigger**: Moving a lead forward in Kanban or clicking "Convert to Deal" in `LeadCardDetails.jsx` (`handleConvertConfirm`).
* **Execution Chain**: `Leads.jsx:L476-608`.
* **Writes Performed**:
  1. Original lead marked `Completed`, locked with `convertedDealId`.
  2. New deal created in `COLLECTIONS.LEADS` (`isDeal: true`, `stage: 'Waiting'`, `jobNo: PTF-xxxx`).
  3. Customer updated (`orders + 1`) or created (`AUTO-######`, `orders: 1`).
  4. Project created in `COLLECTIONS.PROJECTS` (`status: 'Pending'`, `jobNo: PTF-xxxx`).
* **Findings & Architectural Disconnects**:
  1. **Customer Order Double-Counting Bug**:
     - When a lead is first saved in `LeadCardDetails.jsx` (`handleSaveLeadDetails`, `Leads.jsx:L452-464`), if no existing customer is matched, a new customer record is created with `orders: 1`.
     - When that lead is later converted to a Deal (`Leads.jsx:L535-550`), the customer is matched via email/phone and `orders` is incremented: `orders: (match.orders || 0) + 1`.
     - Consequently, for a single deal conversion, the customer record shows `Total Orders: 2`.
  2. **Severed Link to Fabrication Project (`clientNIC` Disconnect)**:
     - In `Leads.jsx:L535-569`, the customer is matched (`match.nic`) or created with a new ID (`nicId`).
     - However, in `Leads.jsx:L576` (project creation), `clientNIC` is assigned as:
       ```javascript
       clientNIC: convertedLead.nic || `AUTO-${Math.floor(100000 + Math.random() * 900000)}`
       ```
     - Leads do not have a `nic` property (it is never set on leads). Therefore, line 576 generates a **second, completely different random `AUTO-######` ID** for `newJob.clientNIC`.
     - As a direct result:
       - In `FabricationWorks.jsx:L530` and `L718`, customer lookup:
         ```javascript
         const cust = customers?.find(c => c.nic === (job.clientNIC || job.customerNic));
         ```
         **Always fails** for converted deals, forcing fallback to `job.customerName`.
       - In `Customers.jsx:L291`, `getCustomerStats` cannot match the project by `clientNIC` and must rely on fallback to `customerName` or `matchIds.has(proj.leadId)`.
  3. **Non-Atomic Operations**:
     - Customer order increment and project creation are separate, unbatched Firestore writes. A failure or tab close leaves state partially written.

---

### Trigger 7c & 7d: Business Client Approval Hand-Off & Onboarding Dispatch

* **Trigger Sequence**:
  - `7b`: Admin clicks "Approve" in User Management (`AgentDatabase.jsx` $\rightarrow$ `approvePending` in `App.jsx:L782`).
  - `7c`: If role is `'Business Client'`, `App.jsx:L840-849` constructs `clientApprovalPrefill` object and sets `activeTab` to `'customers'`.
  - `7d`: Admin reviews pre-filled form in `Customers.jsx` and clicks "Save Profile" (`handleCreateProfile`).
* **Execution Chain**:
  1. `App.jsx:L814-817` writes `users/{email}` as active and deletes `pendingUsers/{email}` via `batchWrite`.
  2. `App.jsx:L841-848` sets:
     ```javascript
     setClientApprovalPrefill({
       name: regData.name,
       businessName: regData.company || regData.name,
       email: regData.identifier,
       phone: regData.mobile || regData.contactNumber || '',
       tempPassword,
     });
     setActiveTab('customers');
     ```
  3. `Customers.jsx:L95-108` listens for `prefillClient`, sets `newProfile` state (forcing `type: 'Business'`), sets `pendingClientApprovalEmail`, opens modal, and calls `onClientPrefillConsumed()`.
  4. On submit (`handleCreateProfile`, `Customers.jsx:L198-261`), `addDocument(COLLECTIONS.CUSTOMERS, newCustomer, newCustomer.nic)` is called.
  5. Upon success, if `approvalEmail` was pending, `sendTemplatedEmail` is dispatched:
     - If `tempPassword` exists: template `client_approval` is sent.
     - If no `tempPassword` (self-registered user): template `client_activation_confirmed` is sent.
* **Findings & Architectural Disconnects**:
  1. **Identification (NIC/BRN) Requirement Barrier**:
     - Self-registration and pending user approval forms collect email, name, phone, and company, but **never collect NIC or Business Registration Number (BRN)**.
     - When the modal opens in `Customers.jsx`, the "Identification (NIC / BRN / Passport) *" field is blank.
     - The admin **must manually invent or procure an NIC/BRN** before the form can be saved (submit button is disabled without NIC).
     - If the admin closes the modal or navigates away without entering an NIC, the prefill state is lost (`onClientPrefillConsumed` already cleared it), the customer record is never created, and no welcome email is dispatched—even though the user's login account is already Active in Firebase Auth and `users`!
  2. **Orphaned User on Abandoned Customer Creation**:
     - Because user approval happens in `App.jsx` *before* the customer record is created in `Customers.jsx`, an abandoned customer modal leaves an active `users` document with role `'Business Client'` that has no corresponding `customers` document.
  3. **No Audit Logging for Customer Creation**:
     - `handleCreateProfile` does not call `logActivity`. While the initial user approval was logged in `App.jsx:L851`, the customer profile creation and email dispatch leave no audit trail.

---

### Trigger 8: Lead Save Auto-Creating Customer

* **Trigger**: User edits or saves lead details in `LeadCardDetails.jsx` $\rightarrow$ `handleSaveLeadDetails` (`Leads.jsx:L442-473`).
* **Execution Chain**: Exact deduplication check against `customers` array $\rightarrow$ if no match, generates `AUTO-######` customer and writes to `COLLECTIONS.CUSTOMERS`.
* **Findings & Architectural Disconnects**:
  1. **Phone Format Mismatch False-Negatives**:
     - `LeadCardDetails.jsx:L441` formats phone inputs using `formatPhone` from `src/shared/utils/validation.js`, which outputs spaced numbers:
       ```
       +94 7X XXX XXXX  (e.g., "+94 77 123 4567")
       ```
     - In `Customers.jsx:L957-958`, manual customer entry formats phone numbers without spaces:
       ```
       +947XXXXXXXX  (e.g., "+94771234567")
       ```
     - In `Leads.jsx:L445-446`:
       ```javascript
       const match = customers.find(c => 
         (updatedLead.email && c.email === updatedLead.email) || 
         (updatedLead.phone && c.phone === updatedLead.phone)
       );
       ```
     - If a customer was registered manually or imported without spaces, and a lead is entered with the same phone (with spaces), `c.phone === updatedLead.phone` evaluates to `false`!
     - If `email` is absent or different, the deduplication fails completely and a duplicate customer profile with a random `AUTO-######` ID is created.
  2. **Inconsistency with In-Modal Cross-Checking**:
     - Inside `LeadCardDetails.jsx:L450`, the in-modal cross-check normalizes phones before comparing:
       ```javascript
       const cPhone = c.phone?.replace(/[^\d+]/g, '');
       const targetPhone = formatted.replace(/\s+/g, '');
       return cPhone === targetPhone || (cPhone?.endsWith(digitsOnly));
       ```
     - Yet when saving the lead (`Leads.jsx:L446`), this normalization was omitted.
  3. **Lead Document Never Stores Customer Link**:
     - Even when `handleSaveLeadDetails` auto-creates or matches a customer, it **never updates the lead document** with `customerId` or `clientNIC`.
     - The lead retains only free-text `name`, `phone`, `email`, and `company`.

---

### Google Contacts & People API Sync

* **Component / Service**: `ContactSyncModal.jsx`, `src/services/contactsService.js`, `Customers.jsx:L33-58`.
* **Flow**:
  1. User clicks "Sync Contacts" in `Customers.jsx`.
  2. `ContactSyncModal.jsx` opens and calls `fetchGoogleContacts()` on mount.
  3. `contactsService.js:L7` calls `getAccessToken()` from `src/services/firebase.js`.
  4. Calls `https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses,phoneNumbers,organizations`.
  5. User selects contacts and clicks "Import & Sync".
  6. `handleImportContacts` in `Customers.jsx` iterates through the list, deduplicates, and adds each customer to Firestore with ID `NIC-${Date.now().slice(-6)}-${rand}`.
* **Critical Findings & Failure Modes**:
  1. **Fatal OAuth Scope Omission (API Returns 403)**:
     - `src/services/firebase.js:L42-45` initializes `GoogleAuthProvider` with only:
       ```javascript
       provider.addScope('https://www.googleapis.com/auth/userinfo.email');
       provider.addScope('https://www.googleapis.com/auth/userinfo.profile');
       ```
     - The required scope `https://www.googleapis.com/auth/contacts.readonly` is **never requested**.
     - When `fetchGoogleContacts` calls the People API, Google rejects the request with HTTP 403 Forbidden (`Request had insufficient authentication scopes`).
  2. **Email/Password Users Crash on Sync**:
     - `getAccessToken()` in `firebase.js` retrieves `sessionStorage.getItem('ptf_google_access_token')`.
     - For users logged in via email and password, this token is `null`.
     - `fetchGoogleContacts()` throws an immediate error:
       `"Not authenticated with Google Workspace. Please sign in with Google."`
     - There is no mechanism for an email-authenticated user to perform a delegated OAuth consent flow to link Google Contacts.
  3. **Empty-String Deduplication Bug (Data Loss During Import)**:
     - In `Customers.jsx:L36`:
       ```javascript
       if (!newCustomers.some(existing => existing.email === c.email || existing.phone === c.phone)) {
       ```
     - If an imported Google contact lacks an email, `c.email` is `""`.
     - If any existing customer record in `newCustomers` has `email: ""` or `email: undefined`:
       - If `existing.email` is `""`, `"" === ""` evaluates to `true`!
       - Consequently, **all subsequent contacts without email addresses are silently discarded** and skipped from import.
  4. **No Pagination Support**:
     - `fetchGoogleContacts` does not supply `pageSize` or follow `nextPageToken`. Only the first default page (up to 100 contacts) can ever be retrieved.
  5. **Unbatched Sequential Network Requests**:
     - `handleImportContacts` iterates with `for (const c of importedList)` and awaits individual `addDocument` calls. Importing 50 contacts generates 50 sequential Firestore roundtrips instead of a single `batchWrite`.
  6. **Optimistic State Desynchronization**:
     - If an individual `addDocument` throws an error, it is caught in `console.error`, but `newCustomers` has already unshifted `newCust`. The unpersisted contact remains in React state until page refresh.

---

## 4. Codebase Tracing & Verification

### 4.1 Target UI Components

#### `src/components/crm/Customers.jsx`
1. **Total Absence of Edit Feature**:
   - `Customers.jsx` provides no UI or handler to update an existing customer's contact number, email, delivery address, company name, or account type.
   - `updateDocument` is not imported from `firestoreSync.js`.
   - If an address or phone number changes, users have no recourse except deleting and re-registering the customer profile.
2. **Display Bug: `orders || 1`**:
   - Line 601 renders: `<p className="text-xl font-extrabold">{selectedCustomer.orders || 1}</p>`.
   - In JavaScript, `0 || 1` evaluates to `1`.
   - When contacts are imported from Google Contacts with `orders: 0` (line 46), the profile inspector displays "Total Orders: 1", corrupting analytical veracity.
3. **Fuzzy Fallback Risk in Customer History Aggregation**:
   - In `getCustomerStats` (lines 263-297), leads, invoices, and projects are matched first by NIC, then email/phone, and finally:
     ```javascript
     return !!(custName && l.name && String(l.name).trim().toLowerCase() === custName);
     ```
   - For customers with common names (e.g., "Kamal Perera" or "Mohamed"), any historical lead or project with that exact string will be attached to this customer's profile, leading to severe cross-contamination of financial records and project logs.
4. **Dead / Unused Fields**:
   - `totalSpent: 0` is initialized on Google Contacts import (line 47), but is never initialized on manual create or lead auto-create, and is never updated when invoices are marked Paid.
5. **AI WhatsApp Message Generator**:
   - `handleGenerateWhatsAppMsg` (line 360) calls `generateText` via Gemini. It is purely client-side and copies to clipboard; it correctly writes no Firestore state.

#### `src/components/crm/ContactSyncModal.jsx`
1. **Selection Reset on Filtering**:
   - Search input filters `contacts`, but `toggleAll` uses `filteredContacts.map(c => c.resourceName)`.
   - Selection state (`selectedContactIds`) is maintained across filter queries, which works correctly.
   - Error presentation provides a "Retry Sync" button, but does not provide a re-authentication trigger.

---

### 4.2 Status Badge Mappings

In `Customers.jsx:L576-579`:
```javascript
<StatusBadge 
  status={selectedCustomer.type === 'Business' ? 'Business Client' : 'Individual Client'} 
  size="xs"
/>
```
And in `Customers.jsx:L757`:
```javascript
<StatusBadge status={inv.status || 'Unpaid'} size="xs" />
```

Inspection of `src/shared/ui/StatusBadge.jsx`:
- Supported style categories:
  - Success: `['completed', 'delivered', 'canvas in', 'received', 'paid', 'approved']`
  - Progress: `['in transit', 'ongoing', 'fabricating', 'processing']`
  - Ready: `['ready', 'ready to load', 'ready for inspection']`
  - Warning: `['pending', 'waiting', 'intake', 'awaiting']`
  - Danger: `['revision', 'blocked', 'cancelled', 'error']`
  - Info: `['75% invoice submitted', 'hand over']`
- **Discrepancies**:
  1. Neither `'Business Client'` nor `'Individual Client'` is present in `STATUS_STYLES`.
  2. `'Unpaid'` is not present in `STATUS_STYLES` (only `'paid'` is present).
  3. All three statuses fall back to `DEFAULT_STYLE` (`bg-surface-container-high text-on-surface-variant border-outline-variant`), displaying as identical neutral gray badges with no semantic icon or distinction.

---

### 4.3 Integration Surfaces, Security Rules & RBAC

#### `firestore.rules` vs. Customer Lifecycle
```javascript
// firestore.rules:L166-170
match /customers/{customerId} {
  allow read: if checkPermission('customers', 'view') || checkPermission('customers', 'read');
  allow create, update: if checkPermission('customers', 'create') || checkPermission('customers', 'edit') || checkPermission('customers', 'write');
  allow delete: if checkPermission('customers', 'delete') || isAdmin();
}
```

1. **Permission Denial on Global App Subscription**:
   - In `App.jsx:L315`:
     ```javascript
     const unsubCustomers = subscribeToCollection(COLLECTIONS.CUSTOMERS, setCustomers);
     ```
     Runs whenever `currentUser?.isApproved` is true.
   - In `DEFAULT_PERMISSIONS` (`PermissionsContext.jsx`), roles `Customer`, `Business Client`, and `Partner` have `customers: none()`.
   - Firestore security rules deny the collection listener for these roles, generating an immediate `permission-denied` Firestore Error on application launch.
2. **Customers Cannot Read or Update Their Own Profile**:
   - While `projects`, `invoices`, `receipts`, and `partners` contain self-read rules (e.g., `resource.data.customerId == request.auth.token.email`), `/customers/{customerId}` has **no self-read or self-update exception**.
   - In `UserProfile.jsx:L160-184`, when an approved customer attempts to update their own profile, `UserProfile` executes a query against `COLLECTIONS.CUSTOMERS` to synchronize their name, phone, and address.
   - This update unconditionally triggers `permission-denied`, which is caught in `UserProfile.jsx:L186` (`console.warn('Cross-collection directory sync notice:', syncErr)`). The customer profile is never updated.
3. **Manager Role Cascading Deletion Failure (RBAC Asymmetry)**:
   - In `DEFAULT_PERMISSIONS`, role `Manager` is granted `customers.delete: true`.
   - When a Manager clicks "Delete Profile" on a Business Client in `Customers.jsx:L385-414`:
     1. `deleteDocument(COLLECTIONS.CUSTOMERS, targetNic)` **succeeds**.
     2. `deleteDocument(COLLECTIONS.USERS, matchingUser.identifier)` **fails** (`firestore.rules:L103` enforces `allow delete: if isAdmin()`).
     3. `deleteUserAccount(matchingUser.identifier)` **fails with 403 Forbidden** (`api/admin-user.js:L60` enforces `callerData.role === 'Admin'`).
   - The UI shows "Failed to delete customer profile from DB", but the customer document is already gone from Firestore and local state, while the user's portal login and Auth account remain completely active and orphaned!

---

## 5. Structured Table of Disconnects & Open Decision Points

| # | Issue / Ambiguity | Current Behavior in Code | Documentation / Trigger Conflict | Resolution Status |
|---|---|---|---|---|
| **1** | **Customer Order Count Double-Counting** | Lead save sets `orders: 1`. Deal conversion increments `(orders \|\| 0) + 1` to `2`. | `CROSS_MODULE_TRIGGERS.md` states conversion increments orders. Initial lead save should not count as an order. | **Resolved**: Lead save does not count as an order (`orders: 0`); order creation and increment occur only upon Deal conversion. |
| **2** | **Disconnected Project `clientNIC`** | `Leads.jsx:L576` generates a random `AUTO-######` for `newJob.clientNIC` instead of using the matched/created customer's NIC. | Breaks Trigger 2 downstream linkage to `projects` and prevents `FabricationWorks` from finding customer data. | **Resolved**: Store the matched/created customer's actual NIC on `newJob.clientNIC` and `newDeal.clientNIC`. |
| **3** | **Phone Number Deduplication Mismatch** | `formatPhone` inserts spaces (`+94 7X ...`), but manual customer creation does not. Exact match fails in `Leads.jsx:L446`. | Trigger 8 claim: "exact email/phone deduplication". In reality, creates duplicate customers. | **Resolved**: Normalize phone numbers (stripping spaces/symbols) before performing deduplication checks. |
| **4** | **Google Contacts 403 Scope Missing** | `firebase.js` does not request `contacts.readonly`. API returns 403 Forbidden. | `CLAUDE.md` acknowledges no scope in `firebase.js`. Feature is broken in production. | **Resolved**: Add `https://www.googleapis.com/auth/contacts.readonly` scope and handle incremental OAuth consent in `ContactSyncModal`. |
| **5** | **Empty String Deduplication in Contact Import** | `existing.email === c.email` matches `"" === ""`, skipping all contacts without an email. | Causes catastrophic data loss when importing phone-only contacts. | **Resolved**: Require non-empty strings before matching email/phone in deduplication logic. |
| **6** | **Missing Customer Profile Edit Functionality** | No edit button, modal, or `updateDocument` handler exists in `Customers.jsx`. | Normal CRM operations require updating client addresses, phones, and company names. | **Resolved**: Implement an "Edit Customer Profile" modal in `Customers.jsx` using `updateDocument`. |
| **7** | **RBAC Cascading Delete Disconnect** | Managers have `customers.delete`, but cannot delete `users` or Auth accounts (Admin only). | Causes partial deletion, leaving orphaned logins and throwing uncaught errors. | **Resolved**: Restrict deleting customers with linked portal logins strictly to Admins, with clear UI warnings. |
| **8** | **App-level Subscription Permission Errors** | `App.jsx` subscribes to `customers` for all approved users, but `Customer`/`Partner` roles are denied read access by rules. | Console fills with Firestore permission-denied errors on startup for portal users. | **Resolved**: Guard `subscribeToCollection(COLLECTIONS.CUSTOMERS)` in `App.jsx` with `canAccess(currentUser?.role, 'customers')`. |
| **9** | **Customer Self-Profile Sync Denied by Rules** | `UserProfile.jsx` attempts to update `COLLECTIONS.CUSTOMERS`, but rules deny customers write access. | Customer cannot update their own phone or delivery address in their portal profile. | **Resolved**: Update `firestore.rules` for `/customers` to permit self-read and self-update when `email == request.auth.token.email`. |
| **10** | **Total Orders `0` Displayed as `1`** | `{selectedCustomer.orders \|\| 1}` coerces falsy `0` to `1`. | Inaccurate metrics for newly imported contacts with zero orders. | **Resolved**: Use nullish coalescing `{selectedCustomer.orders ?? 0}` to accurately display zero orders. |
| **11** | **Missing StatusBadge Mappings** | `'Business Client'`, `'Individual Client'`, and `'Unpaid'` fall back to neutral gray default style. | Status badges lack distinct visual cues for client types and payment states. | **Resolved**: Add explicit badge styles in `StatusBadge.jsx` for client types and `'unpaid'` invoice status. |
| **12** | **Approval Prefill NIC Barrier** | Self-registered approval does not supply an NIC. Admin must fabricate one or cancel. | If admin cancels, user login remains Active but customer profile is never created. | **Resolved**: Auto-generate a fallback `AUTO-######` ID if NIC is blank during approval prefill save. |

---

## 6. Resolved Decisions & Agreed Architectural Resolutions

All proposed directions have been reviewed and accepted as the target architectural specification:

### Decision 1: Order Counting Semantics & Lifecycle
* **Policy**: Inquiries are not orders. Auto-creating a customer upon lead save initializes `orders: 0` (or defers customer creation entirely to conversion).
* **Deal Conversion**: When `handleConvertConfirm` executes in `Leads.jsx`:
  - If customer exists: `orders` is incremented by 1 (`(match.orders || 0) + 1`).
  - If customer is new: customer is created with `orders: 1`.
* **Result**: Eliminates order double-counting; a customer converting one lead into a deal has exactly 1 order recorded.

### Decision 2: Fabrication Project Customer Linkage
* **Policy**: Master identity propagation must be strictly preserved across conversion.
* **Implementation**: In `Leads.jsx:handleConvertConfirm`, the resolved customer's `nic` (`match.nic` or the newly generated `nicId`) must be passed explicitly into:
  - `newJob.clientNIC = customerNic`
  - `newJob.customerId = customerNic`
  - `newDeal.clientNIC = customerNic`
  - `newDeal.customerId = customerNic`
* **Result**: Restores relational integrity between Customers, Deals, and Fabrication Floor records. Lookups in `FabricationWorks.jsx` and `Customers.jsx` succeed immediately.

### Decision 3: Phone Number Deduplication Normalization
* **Policy**: All phone matching across the CRM must compare normalized digits.
* **Implementation**: Create a standardized phone normalizer helper (stripping spaces, parentheses, dashes, and standardizing Sri Lankan country code `+94`). Apply this normalization to `c.phone` and `lead.phone` in `Leads.jsx` (L446, L538), `Customers.jsx` (L36), and `stringMatch.js`.
* **Result**: Eliminates false-negative customer duplication caused by `formatPhone` space formatting.

### Decision 4: Google Contacts Sync OAuth Scope & Auth Flow
* **Policy**: Google Contacts import must be functional and secure.
* **Implementation**:
  - Add `https://www.googleapis.com/auth/contacts.readonly` to `GoogleAuthProvider` in `src/services/firebase.js`.
  - In `ContactSyncModal.jsx`, add an explicit "Sign in with Google" / "Re-authenticate with Google" button for email/password users or sessions without contacts permissions, invoking an incremental OAuth consent popup (`signInWithPopup(auth, provider)`).
  - Implement pagination handling for `nextPageToken` in `fetchGoogleContacts`.

### Decision 5: Contact Import Ingestion Integrity
* **Policy**: Import deduplication must handle missing emails safely and perform atomic writes.
* **Implementation**:
  - Update `Customers.jsx:handleImportContacts` deduplication to verify `(c.email && existing.email && c.email.toLowerCase() === existing.email.toLowerCase()) || (c.phone && existing.phone && normalizePhone(c.phone) === normalizePhone(existing.phone))`.
  - Replace sequential `for` loop `addDocument` calls with `batchWrite` to commit imported contacts atomically and roll back cleanly on failure.

### Decision 6: Customer Profile Edit Capability
* **Policy**: CRM administrators must be able to maintain customer master data.
* **Implementation**:
  - Import `updateDocument` in `Customers.jsx`.
  - Add an "Edit Profile" button in the Customer detail inspector.
  - Implement an Edit Profile modal allowing modification of `name`, `businessName`, `phone`, `email`, `address`, and `photoURL`.
  - Log customer updates to `auditLog` via `logActivity(..., 'UPDATE', 'Customers', ...)`.

### Decision 7: RBAC & Cascading Delete Hardening
* **Policy**: Preventing orphaned authentication accounts and unhandled runtime exceptions.
* **Implementation**:
  - In `Customers.jsx`, if a customer has an associated Business Client portal login (`matchingUser`), check whether `currentUser.role === 'Admin'`.
  - If the user is a Manager (not Admin), disable the delete button for accounts with logins or display an informative modal explaining that revoking portal access requires Admin authorization.
  - Ensure deletion errors roll back optimistic local state cleanly.

### Decision 8: App-Level Subscription Authorization Guard
* **Policy**: Eliminate console security errors and unnecessary listeners for unauthorized roles.
* **Implementation**:
  - In `App.jsx`, guard collection subscriptions:
    ```javascript
    if (canAccess(currentUser?.role, 'customers')) {
      unsubCustomers = subscribeToCollection(COLLECTIONS.CUSTOMERS, setCustomers);
    }
    ```
  - Prevents `Customer`, `Business Client`, and `Partner` roles from attempting unauthorized collection-level reads.

### Decision 9: Customer Self-Update in Firestore Rules
* **Policy**: Clients must be able to maintain their own profile info in `UserProfile.jsx`.
* **Implementation**:
  - Update `firestore.rules` under `match /customers/{customerId}`:
    ```javascript
    allow read, update: if isAuthenticated() && (
      resource.data.email == request.auth.token.email ||
      resource.data.nic == request.auth.token.email
    );
    ```
  - Enables `UserProfile.jsx:L160-184` to synchronize address, phone, and name changes directly to the client's customer record without triggering permission-denied errors.

### Decision 10: Accurate Metric Rendering
* **Policy**: Zero orders must be rendered faithfully.
* **Implementation**: In `Customers.jsx:L601`, replace `{selectedCustomer.orders || 1}` with `{selectedCustomer.orders ?? 0}`.

### Decision 11: Semantic Status Badge Mappings
* **Policy**: Statuses must have consistent, accessible, theme-aware styling.
* **Implementation**:
  - In `StatusBadge.jsx`, add:
    - Business / Corporate types: `['business client', 'corporate client']` $\rightarrow$ Info/Amber styling.
    - Individual types: `['individual client', 'customer']` $\rightarrow$ Neutral/Primary styling.
    - Payment states: add `'unpaid'` to `STATUS_STYLES` warning category (`bg-status-warning/10 text-status-warning-on`).

### Decision 12: Resilient Approval Prefill
* **Policy**: Approved Business Clients must not become orphaned if an admin exits the prefill modal.
* **Implementation**: If an admin saves a prefilled customer profile without an NIC/BRN, auto-generate a fallback `AUTO-######` ID (similar to Lead conversion) so the customer record and onboarding welcome email are created successfully.

---

## 7. Next Implementation Plan (Action Checklist)

### Phase 1: Pipeline & Data Integrity Fixes (High Priority)
- [ ] **Leads.jsx**: Update `handleSaveLeadDetails` so auto-created customers receive `orders: 0`.
- [ ] **Leads.jsx**: In `handleConvertConfirm`, pass the resolved customer's `nic` to `newJob.clientNIC` and `newDeal.clientNIC`.
- [ ] **Leads.jsx**: Implement normalized phone comparison (`replace(/[^\d+]/g, '')`) in `handleSaveLeadDetails` and `handleConvertConfirm`.
- [ ] **Customers.jsx**: Change `{selectedCustomer.orders || 1}` to `{selectedCustomer.orders ?? 0}`.

### Phase 2: Google Contacts Sync & Ingestion Fixes (High Priority)
- [ ] **firebase.js**: Add `https://www.googleapis.com/auth/contacts.readonly` to `GoogleAuthProvider`.
- [ ] **ContactSyncModal.jsx**: Add interactive re-authentication / consent popup trigger for sessions lacking contacts tokens.
- [ ] **Customers.jsx**: Fix empty-string deduplication bug in `handleImportContacts`.
- [ ] **Customers.jsx**: Refactor `handleImportContacts` to use `batchWrite` for atomic persistence.

### Phase 3: Security & RBAC Hardening (Medium Priority)
- [ ] **App.jsx**: Guard `subscribeToCollection(COLLECTIONS.CUSTOMERS)` with `canAccess(currentUser?.role, 'customers')`.
- [ ] **firestore.rules**: Add self-read and self-update rule for authenticated clients matching `resource.data.email`.
- [ ] **Customers.jsx**: Restrict deletion of customers with portal logins to Admins, with rollback on failure.

### Phase 4: CRM Usability & Master Data Management (Medium Priority)
- [ ] **Customers.jsx**: Add "Edit Customer Profile" modal and hook up `updateDocument` with audit logging.
- [ ] **StatusBadge.jsx**: Map `'business client'`, `'individual client'`, and `'unpaid'` statuses.
- [ ] **Customers.jsx**: Support fallback ID generation for Business Client approval prefill when NIC is not supplied.

