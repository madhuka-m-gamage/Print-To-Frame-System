# User Management & RBAC Review & Correctness Audit Findings

> **Scope**: Correctness review of `docs/02_modules/user-management-rbac/CLAUDE.md`, `docs/02_modules/user-management-rbac.md`, `docs/03_security/RBAC_MODEL.md`, `docs/03_security/FIRESTORE_RULES_NOTES.md`, and cross-module triggers touching User Management documented in `docs/01_architecture/CROSS_MODULE_TRIGGERS.md`.  
> **Branch / Worktree**: `review-user-management-rbac` (`.worktrees/review-user-management-rbac`)  
> **Status**: Review & Audit findings; all 12 recommended resolutions formally accepted by project owner (2026-09-20); ready for implementation.

---

## 1. Executive Summary

A comprehensive architectural, security, and trigger audit was conducted across the User Management & RBAC module, including identity provisioning pipelines, dynamic permission matrices, serverless backend administrative endpoints, Firestore security rules, and cross-module triggers:
- **Module Documentation**: `docs/02_modules/user-management-rbac.md`, `docs/02_modules/user-management-rbac/CLAUDE.md`, `docs/03_security/RBAC_MODEL.md`, `docs/03_security/FIRESTORE_RULES_NOTES.md`, `docs/01_architecture/CROSS_MODULE_TRIGGERS.md`.
- **Target UI Components**: `src/components/admin/AdminPanel.jsx` (System Overview, storage telemetry, and audit trail), `src/components/admin/AgentDatabase.jsx` (User Management, review queue, member workspace, and account lifecycle), `src/components/admin/PermissionsManager.jsx` (Dynamic role-by-module matrix editor).
- **Context, Constants & Routing**: `src/context/PermissionsContext.jsx` (`DEFAULT_PERMISSIONS`, `canAccess`, live Firestore sync), `src/constants/roles.js` (`SYSTEM_ROLES`, `ROLE_METADATA`, `ROLE_CATEGORIES`, `getRoleCategory`), `src/App.jsx` (authentication state listener, self-healing super admin guard, `handleRegister`, `approvePending`, `rejectPending`, route guards, mobile navigation dock).
- **Services & Backend Functions**: `src/services/adminUsers.js` (client wrapper for `/api/admin-user`), `src/services/auditLog.js` (`logActivity`), `api/admin-user.js` (Firebase Admin SDK account provisioning, password reset, and deletion), `src/services/mailer.js` (`sendTemplatedEmail`).
- **Security Rules Engine**: `firestore.rules` (`isAdmin`, `hasRole`, `isBootstrapSuperAdmin`, `checkPermission`, `users`, `pendingUsers`, `partner_applications`, `settings/permissions`, `auditLog`).
- **Test Suites**: `tests/unit/permissions.test.js`, `tests/integration/firestoreRules.test.js`, `tests/integration/adminUser.test.js`.

---

### Key Discoveries & Vulnerabilities:

1. **Deactivated Users Can Still Log In and Retain Full System Access (Inverted Auth Guard & Rules Blindspot)**:
   - In `App.jsx:L612`, the login verification condition is:
     ```javascript
     if (userData.isApproved || userData.status === 'Active' || userData.status === undefined || isSuperAdmin)
     ```
     When an admin toggles a user to "Deactivated" via `AgentDatabase.jsx:L225`, it writes `{ status: 'Deactivated' }` to `users/{email}`. However, `userData.isApproved` was set to `true` when the account was first created or approved and is **never revoked**.
     Because of the logical `||`, `userData.isApproved === true` evaluates to true, rendering the deactivation check completely ineffective!
     To make matters worse, line 613 immediately overwrites the user's status in client state:
     ```javascript
     setCurrentUser({ ...userData, role: isSuperAdmin ? 'Admin' : userData.role, isApproved: true, status: 'Active' });
     ```
   - **Server-Side Security Blindspot**: In `firestore.rules:L13-L22`, `hasRole(role)` and `isAdmin()` strictly check `data.role == role`. **Neither function checks `data.status == 'Active'` or `data.isApproved == true`**. Deactivated staff retain full rule-level access to Firestore collections via the Firebase SDK even if their account is marked deactivated.
   - **Admin API Endpoint Flaw**: In `api/admin-user.js:L55-L57`, `isApproved` uses the same flawed OR logic: `(callerData.isApproved === true || callerData.status === 'Active' || callerData.status === undefined)`. A deactivated Admin can still call `/api/admin-user` to create accounts, reset passwords, and delete accounts.

2. **Rejected Applicants Automatically Re-Enroll on Next Login (Orphaned Firebase Auth Account)**:
   - When a user self-registers in `App.jsx:L773`, `handleRegister` calls `emailRegister(email, password)` (creating a Firebase Auth user) before writing `pendingUsers/{email}`.
   - When an admin rejects an applicant in `AgentDatabase.jsx:L427` / `App.jsx:L863` (`rejectPending`), the code executes `deleteDoc(doc(db, 'pendingUsers', email))`. It **never calls `deleteUserAccount(email)`**.
   - If that rejected person attempts to sign in, Firebase Auth validates their credentials. In `App.jsx:L618-L663`, the auth listener finds no `users` document and no `pendingUsers` document. It falls into the fallback block (lines 648-661), which immediately recreates a `pendingUsers` document with `role: 'Customer'`, logs a `REGISTER` audit event, and places the rejected applicant right back into the pending queue!
   - If the applicant tries to register again via `/register`, `emailRegister` throws `auth/email-already-in-use`, directing them to log in, which triggers this resurrection loop.

3. **Dynamic RBAC Matrix Decoupled from Server-Side Rules ("Matrix Mirage")**:
   - `PermissionsManager.jsx` allows admins to configure granular permissions (`view`, `create`, `edit`, `delete`, `export`) across 14 modules, writing the matrix to `settings/permissions`.
   - However, several modules are **completely disconnected from `firestore.rules`**:
     - **`agents` (User Management)**: In `AgentDatabase.jsx:L94`, admin UI controls are gated by `canAccess(currentUser?.role, 'agents', 'edit')`. If an admin grants Manager `agents: edit`, the UI renders all management buttons (Enroll, Delete, Role Change, Status Toggle, Password Reset). But `firestore.rules:L84-L104` strictly restricts `users` creates, role/status updates, and deletes to `isAdmin()`. Every modification attempted by that Manager fails with `permission-denied` or API 403.
     - **`admin` (System Overview)**: Writing to `settings/permissions` and reading `auditLog` both require `isAdmin()`. The matrix settings for `admin` have no server-side enforcement.
     - **`pipeline` (Deals)**: `firestore.rules:L131-L135` guards `/deals/{dealId}` with `checkPermission('pipeline', ...)`. However, the ERP stores all deals in the `/leads` collection (`isDeal: true`). Deals are actually evaluated against `checkPermission('leads', ...)`, making the `pipeline` matrix rules 100% ignored by the database.
     - **`messages`**: In the matrix, `Partner` is assigned `none()`. However, `firestore.rules:L205` allows any authenticated user to read and create messages. The matrix permission is completely unenforced on the server.
     - **`quotations`**: Quotations is **absent from the RBAC matrix entirely**. In `firestore.rules:L138`, `/quotations/{quotationId}` allows unrestricted read and write to all authenticated users (including external Customers and Partners).
     - **`calculator` vs `pricing`**: The matrix configures `calculator`, but `firestore.rules:L194` guards `/pricing` (`write: if isAdmin()`), ignoring calculator permissions.

4. **Matrix `delete` Action Ignored by Firestore Rules for Core Collections**:
   - In `DEFAULT_PERMISSIONS`, roles like `Manager` have `full()` (which includes `delete: true`), and `Operations`/`Logistics` have `ops()` (`delete: true`).
   - In `firestore.rules`:
     - `leads`: `allow delete: if isAdmin();` (Line 127)
     - `deals`: `allow delete: if isAdmin();` (Line 134)
     - `invoices`: `allow delete: if isAdmin();` (Line 153)
     - `receipts`: `allow delete: if isAdmin();` (Line 162)
     - `projects`: `allow delete: if isAdmin();` (Line 183)
     - `logistics`: `allow delete: if isAdmin();` (Line 190)
   - Only `customers` and `partners` collections check `checkPermission(module, 'delete')`. For all other operational and financial collections, non-admin users cannot delete records even if the matrix explicitly grants delete permissions.

5. **Approval Notification Asymmetry (Internal Employees & Customers Receive No Email)**:
   - When an admin enrolls an employee directly via `AgentDatabase.jsx:L289` (`handleCreateUser`), an `employee_invite` email is automatically dispatched with login credentials.
   - When an admin approves a Partner or Business Client from the pending queue (`AgentDatabase.jsx:L376`, `App.jsx:L803`), prefill state hands off to `Partners.jsx` / `Customers.jsx`, and a welcome email (`partner_approval` or `client_approval`) is dispatched on registration form submission.
   - However, when an applicant is approved for an internal role (Sales, Operations, Support, Accounts, Logistics, Manager) or Customer role from `pendingUsers`:
     - `approvePending` sets `users/{email}` to Active/Approved and deletes `pendingUsers/{email}`.
     - **No notification or email is dispatched.** The user is never notified that their account was approved and has no way of knowing their account is active.

6. **Approved Partners Disappear from User Management (`nonPartnerUsers` Filter)**:
   - In `AgentDatabase.jsx:L97`:
     ```javascript
     const nonPartnerUsers = useMemo(() => users.filter(u => u.role !== 'Partner'), [users]);
     ```
   - Pending Partner requests (from self-registration and `partner_applications`) are reviewed in `AgentDatabase.jsx`. When approved, `users/{email}` is created with `role: 'Partner'`.
   - The instant they are approved, they are filtered out of `AgentDatabase.jsx`. While `Partners.jsx` tracks partner business data, it does not provide account lifecycle management (deactivation, role changes). Admins lose the ability to manage the user profile of Partner accounts.

7. **Email Casing Inconsistency Causes Silent Identity Lookup Failures**:
   - `users` and `pendingUsers` use the email address as the document ID.
   - `handleCreateUser` (`AgentDatabase.jsx:L301`) and `api/admin-user.js:L73` enforce `.trim().toLowerCase()`.
   - Google OAuth sign-in (`App.jsx:L582`) uses `.trim().toLowerCase()`.
   - BUT `handleRegister` (`App.jsx:L781`) uses `regData.identifier` **without lowercasing**.
   - If a user signs up as `John.Doe@example.com`, their documents are created as `John.Doe@example.com`. If they subsequently log in via Google OAuth or another client that lowercases emails, `users/john.doe@example.com` lookup fails, causing the app to treat them as an unregistered user.

8. **Partner Mobile Quick Dock Redirect Bounce (`messages` conflict)**:
   - In `App.jsx:L280`, a route protection guard restricts Partner users to `['dashboard', 'notifications', 'partners', 'profile']`.
   - However, the Mobile Quick Dock (`App.jsx:L1458-L1465`) explicitly renders a "Messages" button for Partner users.
   - Tapping "Messages" updates `activeTab` to `'messages'`, which immediately triggers the route protection `useEffect` and forces navigation back to `'partners'`.

9. **Mobile Dock Broken Navigation Target (`fabrication` vs `projects`)**:
   - In `App.jsx:L1503`, the mobile navigation dock attempts to switch tabs:
     ```javascript
     if (canAccess(currentUser?.role, 'fabrication')) setActiveTab('fabrication');
     ```
   - Neither the permission matrix nor the tab routing system recognizes `'fabrication'`—the module and tab ID are named `'projects'` (Fabrication Works). This check always returns `false`.

10. **World-Readable User Directory & Open Ingestion Security Risks**:
    - `firestore.rules:L85`: `match /users/{userId} { allow read: if isAuthenticated(); }`. Any authenticated user (including external Customers and Partners) can read every user document in the system, exposing internal staff names, personal phone numbers, and operational roles.
    - `firestore.rules:L108, L118`: `allow create: if true;` on `pendingUsers` and `partner_applications` allows completely unauthenticated, schema-less document injection without rate limiting or field validation.
    - `firestore.rules:L225`: `match /auditLog/{logId} { allow create: if isAuthenticated(); }`. Any authenticated user can create arbitrary audit log documents with spoofed user IDs and action types.

---

## 2. Review of Module Documentation

### 2.1 `docs/02_modules/user-management-rbac/CLAUDE.md`

| Section / Claim | Code Status | Details / Discrepancy |
|---|---|---|
| **What it does** ("Registration queue, admin approval, role and status management, password reset, and the role-by-module permission matrix stored at `settings/permissions`.") | **Accurate** | Confirmed: Covers `pendingUsers`, admin review, `/api/admin-user` credentials management, and `settings/permissions` live matrix. |
| **Firestore collections it owns or writes** ("`users`, `pendingUsers`, `settings/permissions`, `auditLog`; sets `partner_applications` status.") | **Accurate** | Confirmed: Directly writes `users`, `pendingUsers`, `settings/permissions`, `auditLog`, and updates `partner_applications` status to 'Approved' or 'Rejected'. |
| **Triggers and side effects** ("`approvePending` batch-writes `users` and deletes `pendingUsers`. It does **not** create partners / customers; it pre-fills their registration form.") | **Accurate** | Confirmed: `App.jsx:L814-L849` executes batch write, sets `partnerApprovalPrefill` or `clientApprovalPrefill`, and switches tabs without creating partner/customer records directly. |
| **Triggers and side effects** ("`api/admin-user.js` needs an Admin caller; delete removes the Auth account only.") | **Accurate** | Confirmed: Enforces Bearer token and checks `callerData.role === 'Admin'`. Delete calls `adminAuth.deleteUser()`, leaving Firestore documents for callers to clean up. |
| **Before you edit** ("The permission matrix is enforced in three places that must stay in sync: `PermissionsContext.jsx`, `firestore.rules` (`checkPermission`), `roles.js`.") | **Architectural Disconnect** | While documented as staying in sync, they are heavily decoupled in practice: `firestore.rules` ignores `agents`, `admin`, `pipeline`, and `messages` matrix entries, and requires `isAdmin()` for deletes on core collections. |
| **Before you edit** ("Never make `role`, `isApproved` or `status` client-settable outside the approve / self-heal paths (see the top of the `users` block in the rules).") | **Accurate** | Confirmed: `firestore.rules:L87-L101` restricts modifications of these fields by non-admin users. |
| **Before you edit** ("The two bootstrap admin email lists (App.jsx and rules) must be edited together.") | **Accurate** | Confirmed: `App.jsx:L186-L188` (`BOOTSTRAP_ADMIN_EMAILS`) matches `firestore.rules:L28-L30` (`isBootstrapSuperAdmin`). |

---

### 2.2 `docs/02_modules/user-management-rbac.md`

| Section / Claim | Code Status | Details / Discrepancy |
|---|---|---|
| **Files and folders** (`AdminPanel.jsx`, `AgentDatabase.jsx`, `PermissionsManager.jsx`, etc.) | **Accurate** | Confirmed: File layout and responsibilities match the codebase. |
| **Firestore collections read/written** ("`users/{email}`, `pendingUsers/{email}`, `settings/permissions`, `auditLog`, `partner_applications`... Writes to other modules' collections: **none found.**") | **Accurate** | Confirmed: User Management does not directly write to `partners`, `customers`, `leads`, etc. |
| **Cloud Functions / triggers** ("A first-time Google / Auth login with no `users` doc creates a `pendingUsers` doc (role Customer, status Pending). Only the bootstrap super-admin emails skip the queue.") | **Accurate** | Confirmed: `App.jsx:L627-L662` creates a `pendingUsers` record with role `Customer` for non-bootstrap users. |
| **Cloud Functions / triggers** ("No email is sent from approval itself; welcome emails are sent later from `Partners.jsx` / `Customers.jsx` when the handed-off form is submitted.") | **Grave Incompleteness** | While accurate for Partner and Business Client roles, it leaves internal staff (Sales, Operations, Support, Accounts, Logistics, Manager) and regular Customers stranded with **zero notification email** upon approval. |
| **Open questions** ("`CLAUDE.md` says `AgentDatabase.jsx` 'auto-provisions a matching partners or customers record'; the code hands off to a pre-filled registration form instead.") | **Resolved in Code** | Code strictly hands off to prefill state (`setPartnerApprovalPrefill`, `setClientApprovalPrefill`). No auto-provisioning occurs. `CLAUDE.md` was previously corrected to reflect this. |
| **Open questions** ("Whether every matrix module (e.g. quotations, calculator, messages) has a matching rules-side `checkPermission` was not verified.") | **Verified: Gaps Found** | Confirmed: `quotations` has no matrix entry; `messages` rules ignore the matrix; `calculator` permissions do not match `pricing` rules; `deals` uses `leads` rules, ignoring `pipeline`. |

---

### 2.3 `docs/03_security/RBAC_MODEL.md` and `docs/03_security/FIRESTORE_RULES_NOTES.md`

| Claim in Security Docs | Code Status | Reality / Vulnerability Found |
|---|---|---|
| **Default permissions table** (`RBAC_MODEL.md:L13-L29`) | **Accurate for Defaults** | Matches `DEFAULT_PERMISSIONS` in `PermissionsContext.jsx`. |
| **`checkPermission` ignores `status` / `isApproved`** (`FIRESTORE_RULES_NOTES.md:L46`) | **Confirmed Vulnerability** | `hasRole()` and `checkPermission()` only inspect `data.role`. Deactivated users maintain full database permissions. |
| **`deals` rule block is unused by the app** (`FIRESTORE_RULES_NOTES.md:L42`) | **Confirmed Discrepancy** | Deals are documents in `leads` collection (`isDeal: true`), governed by `leads` rules and permissions, not `pipeline`. |
| **`quotations` is not permission-gated** (`FIRESTORE_RULES_NOTES.md:L44`) | **Confirmed Vulnerability** | `/quotations/{quotationId}` is open to any authenticated user for read and write. |
| **`messages` reads not restricted to participants** (`FIRESTORE_RULES_NOTES.md:L45`) | **Confirmed Vulnerability** | Rules allow all authenticated users to read and create `/messages`, completely ignoring the matrix (`Partner: none`). |

---

## 3. Cross-Module Triggers Audit (`CROSS_MODULE_TRIGGERS.md`)

### Trigger 7: Registration to Approval to Record Creation

Trigger 7 governs the entire user onboarding lifecycle across four distinct stages (7a through 7d):

```
┌─────────────────────────┐     ┌──────────────────────────┐     ┌──────────────────────────┐     ┌──────────────────────────┐
│       Trigger 7a        │     │        Trigger 7b        │     │        Trigger 7c        │     │        Trigger 7d        │
│   Public Registration   │────▶│   Admin Review Queue     │────▶│     Admin Approval       │────▶│  Prefill Form Handoff    │
│  (Email/Google/Portal)  │     │   (AgentDatabase.jsx)    │     │  (Batch Write Promotion) │     │  (Partners / Customers)  │
└─────────────────────────┘     └──────────────────────────┘     └──────────────────────────┘     └──────────────────────────┘
```

---

#### Step 7a: User Registration & Ingestion

* **Entrypoints**:
  1. **Public Self-Registration Form** (`App.jsx:L770-L795`):
     - Prospective user fills registration form (name, email, password, mobile, requested role: 'Partner' or 'Business Client').
     - Executes `emailRegister(identifier, password)` using Firebase Auth client SDK.
     - Strips password: `const completeRegData = { ...regData }; delete completeRegData.password;`.
     - Writes `pendingUsers/{identifier}` via `setDoc`.
     - Logs activity: `logActivity(identifier, name, 'REGISTER', 'Auth', ...)`.
     - Immediately logs out: `await logout()`.
  2. **First-Time Google OAuth Sign-In** (`App.jsx:L582-L663`):
     - Triggered via `onAuthStateChanged`.
     - If neither `users/{email}` nor `pendingUsers/{email}` exists:
       - If email is in `BOOTSTRAP_ADMIN_EMAILS`, immediately self-provisions active Admin profile in `users/{email}`.
       - Otherwise, creates `pendingUsers/{email}` with `{ identifier: email, password: "", name: displayName, role: "Customer", status: 'Pending' }`.
       - Logs `REGISTER` activity and signs out with "Account pending admin approval".
  3. **Public Partner Studio Application** (`PartnerRegistration.jsx:L18-L65`):
     - Submitted by prospective framing studios.
     - Writes to `partner_applications` with fields: `studioName`, `contactPerson`, `email`, `phone`, `specialty`, `status: 'Pending Review'`.
     - **Creates NO Firebase Auth account at this point.**

* **Architectural & Security Flaws**:
  - **Email Casing Bug**: `handleRegister` fails to lowercase `regData.identifier`. Registering with mixed-case (`User@Example.com`) creates `pendingUsers/User@Example.com`. Subsequent Google sign-in normalizes to `user@example.com` and fails to locate the record.
  - **Unauthenticated Ingestion**: `firestore.rules:L108` and `L118` allow unrestricted, unauthenticated `create` on `pendingUsers` and `partner_applications` with zero schema validation or rate limiting.

---

#### Step 7b: Admin Pending Queue & Dossier Review

* **Implementation**: `AgentDatabase.jsx:L101-L123`, `L360-L440`, `L489-L557`.
* **Trace & Analysis**:
  - `pendingReviewItems` aggregates both `pendingUsers` and `partner_applications` into a unified list:
    ```javascript
    const normalizedApplications = partnerApplications
      .filter(app => !app.status || app.status === 'Pending Review')
      .map(app => ({
        identifier: (app.email || '').trim().toLowerCase(),
        name: app.contactPerson || app.studioName || app.name || app.email,
        role: 'Partner',
        mobile: app.phone || app.contactNumber || '',
        company: app.studioName || app.name || '',
        specialty: app.specialty || '',
        _source: 'partner_application',
        _appDocId: app._firestoreId || app.id,
      }));
    return [...pendingUsers, ...normalizedApplications];
    ```
  - Rendered in a prominent "Registration Applications Awaiting Review" callout for Admins.
  - **Action Paths**:
    1. **Quick Approve** (checkmark button): For `pendingUsers` only. Immediately approves with requested role.
    2. **Review Full Dossier** (eye button): Opens `ModalWrapper` (`reviewingApplicant`). Allows role override (e.g. changing an accidental Google sign-in from 'Customer' to 'Partner' or 'Sales').
    3. **Application Password Gate**: For `_source === 'partner_application'`, Quick Approve is hidden. The review modal enforces entering an `Initial Password` (min. 6 characters) so an Auth account can be generated.
    4. **Decline** (X button): Executes `handleExecuteRejection`.

---

#### Step 7c: Admin Approval Execution & Batch Writes

* **Implementation**: `AgentDatabase.jsx:L376-L417`, `App.jsx:L803-L858` (`approvePending`).
* **Trace & Analysis**:
  1. If `_source === 'partner_application'`:
     - Calls `createUserAccount(identifier, reviewPassword, name)` via `/api/admin-user`.
     - Creates the Firebase Auth account server-side using Firebase Admin SDK.
  2. Calls `onApprove(regData, finalRole, { tempPassword })`, triggering `approvePending`:
     ```javascript
     const approvedUser = {
       ...regData,
       role: finalRole,
       isApproved: true,
       status: 'Active',
       approvedAt: new Date().toISOString(),
       approvedBy: currentUser?.identifier || 'Admin',
     };
     await batchWrite([
       { type: 'set', collection: COLLECTIONS.USERS, docId: regData.identifier, data: approvedUser },
       { type: 'delete', collection: COLLECTIONS.PENDING_USERS, docId: regData.identifier },
     ]);
     ```
  3. If from application: updates `partner_applications/{_appDocId}` with `{ status: 'Approved' }`.
  4. Records audit trail: `logActivity(..., 'APPROVE', 'Admin', ...)`.

* **Architectural & Security Flaws**:
  - **Internal Staff Approval Notification Void**: If approved as `Sales`, `Operations`, `Support`, `Accounts`, `Logistics`, `Manager`, or `Customer`, no email is dispatched. The user remains completely unaware of approval.
  - **Partner Disappearance**: Once approved with `role: 'Partner'`, `nonPartnerUsers` immediately hides them from `AgentDatabase.jsx`.

---

#### Step 7d: Prefill Handoff to Partners / Customers

* **Implementation**: `App.jsx:L829-L850`, `Partners.jsx:L104-L120`, `Customers.jsx:L112-L130`.
* **Trace & Analysis**:
  - `approvePending` does **not** create documents in `partners` or `customers` collections.
  - Instead, it sets prefill state and redirects the admin:
    - **Partner Role**:
      ```javascript
      setPartnerApprovalPrefill({
        name: regData.name,
        email: regData.identifier,
        phone: regData.mobile || regData.contactNumber || '',
        type: regData.specialty ? 'Custom Workshop / Artisan' : 'Agency',
        tempPassword,
      });
      setActiveTab('partners');
      ```
    - **Business Client Role**:
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
  - In `Partners.jsx` / `Customers.jsx`, a `useEffect` detects the prefill state, auto-opens the "Register Partner" / "Register Client" modal, and pre-populates all inputs.
  - Only when the admin completes the form (specifying banking details, negotiated commission rates, business IDs) and submits does the actual `partners` or `customers` document get created.
  - Upon submission, the respective module dispatches the welcome email (`partner_approval` or `client_approval`) containing their newly assigned ID and credentials.

---

#### Step 7 Rejection Flaw: Orphaned Account Resurrection Loop

* **Implementation**: `AgentDatabase.jsx:L419-L439` (`handleExecuteRejection`), `App.jsx:L863-L871` (`rejectPending`).
* **Trace**:
  1. Admin clicks Decline (X button).
  2. `handleExecuteRejection` calls `sendTemplatedEmail(user.identifier, 'registration_declined', ...)`.
  3. `rejectPending` executes `deleteDoc(doc(db, 'pendingUsers', user.identifier))`.
  4. **The Firebase Auth account created during Step 7a is NOT deleted.**
  5. The rejected user receives the decline email. If they attempt to log in at `/login`:
     - Firebase Auth succeeds.
     - `onAuthStateChanged` runs in `App.jsx`.
     - `userDoc.exists()` is `false`.
     - `pendingDoc.exists()` is `false`.
     - Code falls into lines 648-661:
       ```javascript
       const pendingUser = {
         identifier: emailKey,
         password: "",
         name: user.displayName || emailKey,
         role: "Customer",
         status: 'Pending',
       };
       await setDoc(doc(db, COLLECTIONS.PENDING_USERS, emailKey), pendingUser);
       logActivity(emailKey, ..., 'REGISTER', 'Auth', 'New user registered and is pending approval.');
       logout();
       ```
  6. **Outcome**: The rejected user is instantly revived and placed back into the admin's pending approval queue.

---

## 4. RBAC Double-Enforcement Deep Dive

The project architecture specifies double-enforcement of permissions:
1. **Client-Side**: `PermissionsContext.jsx` (`DEFAULT_PERMISSIONS` and `canAccess`).
2. **Server-Side**: `firestore.rules` (`checkPermission(module, action)` reading `settings/permissions`).

The table below contrasts client-side permissions against server-side rule enforcement across all 14 modules:

| Module | Client Permissions Matrix (`DEFAULT_PERMISSIONS`) | Server-Side Enforcement (`firestore.rules`) | Double-Enforcement Status & Gaps |
|---|---|---|---|
| **leads** | Admin: full<br>Manager: full<br>Sales: write<br>Operations: none<br>Support: read<br>Accounts: read<br>Logistics: none<br>Partner: none<br>Clients: none | `match /leads/{leadId}`:<br>Read: `checkPermission('leads', 'view')`<br>Create: `checkPermission('leads', 'create')` or `source == 'Referral'`<br>Update: `checkPermission('leads', 'edit')`<br>Delete: `isAdmin()` | **Partial Divergence (Delete)**:<br>Matrix grants `delete: true` to Manager, but rules strictly enforce `isAdmin()` for delete. Non-admin managers cannot delete leads in Firestore. |
| **pipeline** (Deals) | Admin: full<br>Manager: full<br>Sales: write<br>Operations: none<br>Support: read<br>Accounts: read<br>Logistics: none<br>Partner: none<br>Clients: none | `match /deals/{dealId}`:<br>Read: `checkPermission('pipeline', 'view')`<br>Write: `checkPermission('pipeline', 'create'\|'edit')`<br>Delete: `isAdmin()` | **Complete Disconnect (Dead Rule Block)**:<br>The ERP stores deals inside the `/leads` collection (`isDeal: true`). Rules evaluate deal operations against `checkPermission('leads')`. The `pipeline` matrix settings have zero server-side effect. |
| **customers** | Admin: full<br>Manager: full<br>Sales: write<br>Operations: read<br>Support: read<br>Accounts: read<br>Logistics: read<br>Partner: none<br>Clients: none | `match /customers/{customerId}`:<br>Read: `checkPermission('customers', 'view')`<br>Write: `checkPermission('customers', 'create'\|'edit')`<br>Delete: `checkPermission('customers', 'delete') \|\| isAdmin()` | **Fully Enforced**:<br>Client and server checks match. Delete honors matrix delete permission. |
| **partners** | Admin: full<br>Manager: full<br>Sales: write<br>Operations: none<br>Support: read<br>Accounts: read<br>Logistics: none<br>Partner: full<br>Clients: none | `match /partners/{partnerId}`:<br>Read: `checkPermission('partners', 'view')` or own doc<br>Write: `checkPermission('partners', 'create'\|'edit')`<br>Delete: `checkPermission('partners', 'delete') \|\| isAdmin()` | **Enforced with Document Ownership**:<br>Partners can read their own doc (`partnerId == email`). Note: Anonymous referral lookup fails because unauthenticated reads are denied. |
| **invoices** | Admin: full<br>Manager: full<br>Sales: write<br>Operations: none<br>Support: read<br>Accounts: view/create/edit/export<br>Logistics: none<br>Partner: none<br>Clients: read | `match /invoices/{invoiceId}`:<br>Read: `checkPermission('invoices', 'view')` or own doc<br>Write: `checkPermission('invoices', 'create'\|'edit')`<br>Delete: `isAdmin()` | **Partial Divergence (Delete)**:<br>Matrix `invoices.delete` (granted to Manager) is blocked by rules `isAdmin()` check. |
| **receipts** | Admin: full<br>Manager: full<br>Sales: write<br>Operations: none<br>Support: read<br>Accounts: view/create/edit/export<br>Logistics: none<br>Partner: none<br>Clients: read | `match /receipts/{receiptId}`:<br>Read: `checkPermission('receipts', 'view')` or own doc<br>Write: `checkPermission('receipts', 'create'\|'edit')`<br>Delete: `isAdmin()` | **Partial Divergence (Delete)**:<br>Matrix `receipts.delete` is blocked by rules `isAdmin()` check. |
| **projects** (Fabrication) | Admin: full<br>Manager: full<br>Sales: read<br>Operations: ops<br>Support: read<br>Accounts: read<br>Logistics: read<br>Partner: none<br>Clients: read | `match /projects/{projectId}`:<br>Read: `checkPermission('projects', 'view')` or own customer<br>Write: `checkPermission('projects', 'create'\|'edit')`<br>Delete: `isAdmin()` | **Partial Divergence (Delete)**:<br>Matrix grants `delete: true` to Operations (`ops()`), but rules require `isAdmin()`. Operations staff cannot delete projects. |
| **logistics** | Admin: full<br>Manager: full<br>Sales: read<br>Operations: ops<br>Support: read<br>Accounts: none<br>Logistics: ops<br>Partner: none<br>Clients: read | `match /logistics/{logId}`:<br>Read: `checkPermission('logistics', 'view')` or own customer<br>Write: `checkPermission('logistics', 'create'\|'edit')`<br>Delete: `isAdmin()` | **Partial Divergence (Delete)**:<br>Matrix grants `delete: true` to Logistics (`ops()`), but rules require `isAdmin()`. Logistics staff cannot delete dispatch jobs. |
| **agents** (User Management) | Admin: full<br>Manager: read<br>All others: none | `match /users/{userId}`:<br>Read: `isAuthenticated()`<br>Write/Delete: `isAdmin()`<br>`match /pendingUsers/{userId}`:<br>Create: open; Read/Write: `isAdmin()` | **Complete Disconnect**:<br>No `checkPermission('agents')` exists in rules. If Manager is granted `agents: edit` in matrix, client UI shows controls, but Firestore rules block writes. |
| **admin** (System Overview) | Admin: full<br>Manager: read<br>All others: none | `match /settings/permissions`:<br>Read: open; Write: `isAdmin()`<br>`match /auditLog/{logId}`:<br>Read: `isAdmin()`; Create: authed | **Complete Disconnect**:<br>No `checkPermission('admin')` exists in rules. System overview writes and audit reads strictly require `isAdmin()`. |
| **messages** | Partner: none<br>All others: full | `match /messages/{messageId}`:<br>Read, Create: `isAuthenticated()`<br>Update: Admin, sender, or `readBy`<br>Delete: Admin or sender within 15m | **Completely Unenforced**:<br>Rules do NOT call `checkPermission('messages')`. Any authenticated user (including Partner) can read and create messages. |
| **calculator** | Admin: full<br>Manager: full<br>Sales: full<br>Operations: full<br>Accounts: view/create/edit/export<br>Others: none | `match /pricing/{docId}`:<br>Read: `isAuthenticated()`<br>Write: `isAdmin()` | **Missing Mapping**:<br>The calculator reads/writes the `/pricing` collection. Rules check `isAdmin()`, completely ignoring `calculator` matrix permissions. |
| **quotations** | *NOT IN MATRIX* | `match /quotations/{quotationId}`:<br>Read, Write: `isAuthenticated()` | **Critical Gap**:<br>Quotations is missing from `DEFAULT_PERMISSIONS` and `PermissionsManager.jsx`. In rules, any authenticated user has full read/write access. |
| **dashboard** | All roles: full (Support/Accounts/Logistics: read) | *No Firestore collection* | **Client-Only Virtual Module**:<br>Purely controls UI tab rendering. |
| **notifications** | All roles: full | *No Firestore collection* | **Client-Only Virtual Module**:<br>In-memory DOM event bus; not persisted to Firestore. |

---

## 5. Privilege Escalation & Security Boundary Audit

### 5.1 Profile Privilege Escalation Guards (`users/{userId}`)

In `firestore.rules:L84-L104`, the `users` block implements privilege escalation guards:
```javascript
match /users/{userId} {
  allow read: if isAuthenticated();

  allow create: if isAdmin()
    || (isAuthenticated() && request.auth.token.email == userId && (
         (request.resource.data.role == 'Customer'
           && request.resource.data.isApproved == false
           && request.resource.data.status == 'Pending')
         || (isBootstrapSuperAdmin(userId) && request.resource.data.role == 'Admin')
       ));

  allow update: if isAdmin()
    || (isAuthenticated() && request.auth.token.email == userId && (
         (request.resource.data.role == resource.data.role
           && request.resource.data.isApproved == resource.data.isApproved
           && request.resource.data.status == resource.data.status)
         || (isBootstrapSuperAdmin(userId) && request.resource.data.role == 'Admin')
       ));

  allow delete: if isAdmin();
}
```

#### Verification Findings:
1. **Direct Privilege Escalation Blocked**: An authenticated non-admin cannot change their own `role` to 'Admin' or flip `isApproved` to `true`. This is verified by integration tests in `tests/integration/firestoreRules.test.js:L82-L94`.
2. **Self-Service Creation Guard**: A new user can only self-create their profile if `role == 'Customer'`, `isApproved == false`, and `status == 'Pending'`.
3. **Bootstrap Admin Immunity**: The two hardcoded emails (`madhukagamage6@gmail.com` and `madhukagamage@gmail.com`) can set their own role to 'Admin' on create and update.

#### Critical Gaps Identified:
- **World-Readable Directory Exposure**: `allow read: if isAuthenticated();` permits any logged-in user—including retail customers and external partners—to query and export the entire `/users` collection, exposing full names, personal phone numbers, physical locations, and internal roles.
- **Deactivated Status Bypasses Rules**: Because `hasRole(role)` does not check `status`, a user who is marked `status: 'Deactivated'` retains full database access under their assigned role.
- **Audit Log Spoofing**: `match /auditLog/{logId} { allow create: if isAuthenticated(); }` lacks any constraint enforcing `request.resource.data.userId == request.auth.token.email`. Any authenticated client can inject forged audit records attributing malicious actions to administrators.

---

## 6. UI Gating, Workflow & Data Consistency Audit

### 6.1 Partner Role UI Gating Conflicts

1. **Route Protection vs Mobile Quick Dock Bounce**:
   - `App.jsx:L280`: Whitelists `['dashboard', 'notifications', 'partners', 'profile']`.
   - `App.jsx:L1458-L1465`: Mobile quick dock renders a "Messages" button (`setActiveTab('messages')`).
   - Tapping "Messages" bounces the Partner back to `'partners'`.
   - In `PermissionsContext.jsx:L67`, `Partner.messages` is `none()`.
2. **Mobile Quick Dock Broken Target (`fabrication`)**:
   - `App.jsx:L1503`: Checks `canAccess(currentUser?.role, 'fabrication')`.
   - The correct module and tab name is `'projects'`. This navigation button is permanently dead.

### 6.2 Data Consistency & Account Synchronization

1. **Email Casing Mismatch**:
   - `AgentDatabase.jsx` and `api/admin-user.js` enforce lowercased emails.
   - `App.jsx:L781` (`handleRegister`) writes mixed-case emails directly from user input.
   - Leads to document fragmentation and sign-in lookup failures.
2. **Optimistic Updates vs Deletion Failure**:
   - In `AgentDatabase.jsx:L194-L203` (`handleDeleteAgent`):
     ```javascript
     await deleteDoc(doc(db, "users", deleteId));
     setUsers(prev => prev.filter(u => u.identifier !== deleteId));
     await deleteUserAccount(deleteId);
     ```
     If `deleteUserAccount(deleteId)` fails (e.g. network failure to `/api/admin-user`), the Firestore profile is already gone, but the Firebase Auth account remains active. Subsequent enrollment of that email fails with `auth/email-already-exists`.
3. **Status Badging Inconsistency**:
   - In `AgentDatabase.jsx:L514`, pending application callout cards hardcode `bg-rose-500/15 text-rose-400 border-rose-500/30` for all requested roles, ignoring `ROLE_METADATA[role].badge`.
   - In member list items (`AgentDatabase.jsx:L617`), only the role badge is displayed; account status ('Active' vs 'Deactivated') is not indicated until inspecting the member details.

---

## 7. Structured Table of Decision Points & Accepted Resolutions

> **Status**: **All 12 Recommended Options Formally Accepted by Project Owner (2026-09-20).**  
> The table below records each finding, architectural implication, and the accepted resolution that now serves as the agreed technical specification for implementation:

| # | Issue / Area | Current Behavior | Architecture Conflict / Security Risk | Accepted Decision (Approved Resolution) | Status |
|---|---|---|---|---|---|
| **1** | **Account Deactivation Bypass** (`App.jsx:L612`, `firestore.rules:L13`) | `userData.isApproved \|\| userData.status === 'Active' \|\| ...` allows deactivated users with `isApproved: true` to log in. `firestore.rules` also ignores `status`. | **Critical Security Vulnerability**: Deactivated employees can log in and retain full database access. | **Accepted (Recommended)**: Update client auth check in `App.jsx` to `(userData.isApproved && userData.status !== 'Deactivated') \|\| isSuperAdmin`. Update `/api/admin-user.js:L55` to require `status !== 'Deactivated'`. Update `firestore.rules` `hasRole()` to require `get(.../users/...).data.status == 'Active'`. | **Accepted** |
| **2** | **Rejected User Resurrection Loop** (`App.jsx:L863`, `AgentDatabase.jsx:L427`) | `rejectPending` deletes `pendingUsers` doc but leaves Firebase Auth account alive. Next login recreates `pendingUsers` doc. | **Lifecycle Flaw**: Deleting pending doc without deleting Auth account creates endless pending re-enrollment loop. | **Accepted (Recommended)**: In `handleExecuteRejection`, call `deleteUserAccount(identifier)` via `/api/admin-user` when rejecting self-registered users so the Auth account is deleted alongside the pending record. | **Accepted** |
| **3** | **RBAC Matrix Decoupling for `agents` & `admin`** | `PermissionsManager.jsx` allows granting `agents: edit` to Manager. Client UI renders controls, but Firestore rules block all writes with `permission-denied`. | **Architectural Disconnect ("Matrix Mirage")**: Admins believe they can delegate user management via the matrix, but security rules reject non-Admins. | **Accepted (Option A - Recommended)**: Lock `agents` and `admin` modules in `PermissionsManager.jsx` to Admin-only (remove editability for other roles to eliminate the illusion of delegable authority). | **Accepted** |
| **4** | **Unused `deals` Rules vs `/leads` Storage** (`firestore.rules:L131`) | Rules guard `/deals` using `pipeline` permissions, but deals are stored in `/leads` and governed by `leads` permissions. | **Enforcement Mismatch**: Matrix permissions for `pipeline` are ignored; users with `leads: write` automatically get deals access. | **Accepted (Recommended)**: Update `firestore.rules` under `/leads/{leadId}` to check `request.resource.data.isDeal == true ? checkPermission('pipeline', ...) : checkPermission('leads', ...)` (aligning rule enforcement with collection usage). | **Accepted** |
| **5** | **Missing `quotations` Module in RBAC Matrix** | `quotations` is absent from `DEFAULT_PERMISSIONS` and matrix editor; `firestore.rules` allows any authenticated user full read/write. | **Security Gap**: Partners, Clients, and Support can read and overwrite all customer quotations. | **Accepted (Recommended)**: Add `quotations` to `MODULE_CATEGORIES` and `DEFAULT_PERMISSIONS` (Sales/Manager/Admin: full; others: read or none). Update `firestore.rules` to check `checkPermission('quotations', action)`. | **Accepted** |
| **6** | **Matrix `delete` Action Overridden by `isAdmin()`** | Matrix grants `delete: true` for leads, invoices, receipts, projects, logistics to Manager/Operations, but rules enforce `isAdmin()`. | **Matrix Inaccuracy**: The matrix UI implies non-admin roles can delete, but server rules deny the operation. | **Accepted (Option A - Recommended)**: Update `firestore.rules` on those collections to check `checkPermission(module, 'delete') \|\| isAdmin()` so matrix-granted delete rights actually function. | **Accepted** |
| **7** | **Approval Notification Void for Staff & Customers** (`App.jsx:L803`) | Approving an internal employee or Customer from `pendingUsers` sends zero email notification. | **Poor User Experience**: Approved staff have no way of knowing their account was approved. | **Accepted (Recommended)**: Add an `account_activated` email template in `mailer.js` and dispatch it from `approvePending` when approving non-Partner/Client roles. | **Accepted** |
| **8** | **Approved Partners Hidden in `AgentDatabase.jsx`** (`AgentDatabase.jsx:L97`) | `users.filter(u => u.role !== 'Partner')` hides partner user accounts from User Management. | **Management Gap**: Admins cannot deactivate or manage credentials for Partner users in `AgentDatabase.jsx`. | **Accepted (Recommended)**: Remove `u.role !== 'Partner'` filter or add a dedicated "Partners" tab in `AgentDatabase.jsx` filter bar to manage partner user credentials. | **Accepted** |
| **9** | **Partner Navigation Bounce on Mobile** (`App.jsx:L280`, `L1458`) | Mobile quick dock provides a "Messages" button, but route guard redirects Partner back to `'partners'`. | **UI Defect**: Inconsistent UI controls causing redirect bounce. | **Accepted (Option A - Recommended)**: Replace "Messages" button in Partner mobile quick dock with "Network" (`partners`) or "Profile" (`profile`). | **Accepted** |
| **10** | **Mobile Dock `fabrication` Button** (`App.jsx:L1503`) | Calls `canAccess(..., 'fabrication')` and `setActiveTab('fabrication')`. Module and tab are named `'projects'`. | **Dead UI Control**: Non-partner mobile dock production shortcut fails. | **Accepted (Recommended)**: Change `'fabrication'` to `'projects'` in `App.jsx:L1503`. | **Accepted** |
| **11** | **Email Casing Normalization** (`App.jsx:L781`) | `handleRegister` preserves uppercase email from input; auth listener normalizes to lowercase. | **Data Fragmentation**: Mismatched document keys cause account lookup failures. | **Accepted (Recommended)**: Apply `.trim().toLowerCase()` to `regData.identifier` in `handleRegister` before writing to `pendingUsers`. | **Accepted** |
| **12** | **World-Readable `/users` Collection** (`firestore.rules:L85`) | Any authenticated user can read all documents in `/users`. | **Data Privacy Risk**: Internal staff phone numbers, addresses, and roles exposed to retail clients. | **Accepted (Recommended)**: Restrict `/users/{userId}` read in `firestore.rules` to `isAdmin() \|\| request.auth.token.email == userId \|\| checkPermission('agents', 'view')`. | **Accepted** |

---

## 8. Next Steps & Implementation Roadmap

1. **Stakeholder Alignment Completed**:
   - All 12 recommended options formally accepted by the project owner (2026-09-20).
   - Priority sequence established:
     - **P0 Security & Access**: Account Deactivation Guard (Point 1), Rejection Cleanup Loop (Point 2), and Quotations RBAC Gating (Point 5).
     - **P1 Matrix & Rules Alignment**: Lead/Deal Pipeline Separation (Point 4), Delete Permission Parity (Point 6), Admin/Agents Matrix Locking (Point 3), and User Directory Read Restriction (Point 12).
     - **P2 UI & Workflow Consistency**: Staff Approval Email Dispatch (Point 7), Partner Visibility in User Management (Point 8), Mobile Quick Dock Fixes (Points 9 & 10), and Email Casing Normalization (Point 11).
2. **Security Rules Hardening (`firestore.rules`)**:
   - Update `hasRole()` to require `data.status == 'Active'`.
   - Update `/leads/{leadId}` to branch permission check based on `isDeal`.
   - Add permission-gating block for `/quotations/{quotationId}`.
   - Update delete rules on operational/financial collections to honor `checkPermission(module, 'delete')`.
   - Restrict `/users/{userId}` reads to admins, document owners, or agents viewers.
3. **Client-Side Auth & Lifecycle Fixes**:
   - Update `App.jsx:L612` and `api/admin-user.js:L55` deactivation condition.
   - Wire `deleteUserAccount` into `handleExecuteRejection` for self-registered applicants.
   - Normalize email casing in `handleRegister`.
   - Correct mobile dock navigation targets (`fabrication` -> `projects`, remove Partner `messages`).
   - Add `quotations` to `DEFAULT_PERMISSIONS` and `PermissionsManager.jsx`.
   - Add `account_activated` template and dispatch in `approvePending`.
4. **Automated Verification & Test Coverage**:
   - Run `npm run test:rules` with emulator to verify:
     - Deactivated users are rejected by `hasRole()`.
     - Quotations cannot be accessed without permission.
     - Role escalation remains strictly blocked.
   - Update `tests/unit/permissions.test.js` to include `receipts` and `quotations`.
