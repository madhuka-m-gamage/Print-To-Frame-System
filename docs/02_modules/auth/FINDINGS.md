# Auth Module: Architecture & Security Audit Findings

> Comprehensive audit of the Authentication module (`src/components/auth/Login.jsx`, `src/App.jsx`, `src/services/firebase.js`, `api/_lib/firebaseAdmin.js`, `api/admin-user.js`, `api/generate.js`, `api/send-email.js`, `firestore.rules`).
> Baseline comparison against `docs/02_modules/auth/README.md`, `docs/01_architecture/CROSS_MODULE_TRIGGERS.md`, and `docs/03_security/RBAC_MODEL.md`.

---

## 1. Executive Summary

The Print To Frame ERP authentication subsystem combines:
1. **Client-side Firebase Auth**: Google OAuth popup and email/password authentication via the Firebase Web SDK.
2. **Approval Gate Architecture**: A two-tier user state managed across Firestore collections (`users` and `pendingUsers`), gating entrance into the ERP.
3. **Serverless Identity & Revocation Verification**: Vercel serverless endpoints (`api/*.js`) utilizing the Firebase Admin SDK to cryptographically verify ID tokens with server-side revocation checks (`checkRevoked = true`) and database approval checks.
4. **Security Rules Enforcement**: `firestore.rules` implementing role-based access control against the dynamic `/settings/permissions` document and hardcoded bootstrap admin guards.

While functional for everyday login flows, the audit revealed **critical disconnects between documentation, security rules, and client code**, including OAuth scope deficiencies that break downstream integrations, unhandled race conditions in registration, and gaps in security rule enforcement for deactivated users.

---

## 2. Trigger Audit & Cross-Module Analysis

Tracing every trigger chain identified in `docs/01_architecture/CROSS_MODULE_TRIGGERS.md`:

### Trigger 7a: Registration / First Sign-In Queueing

```
User submits registration OR first Google sign-in
   ↓
Firebase Auth user created (or session initialized)
   ↓
App.jsx initAuth listener / handleRegister triggered
   ↓
pendingUsers/{email} written (role: Customer / requested role, status: Pending)
   ↓
User signed out (logout()) & pending notification shown
```

#### Identified Vulnerabilities & Edge Cases

1. **Race Condition & Permission Denied on Email Registration**:
   - When a user submits the registration form in `Login.jsx`, `handleRegister()` calls `emailRegister(identifier, password)`.
   - The moment `createUserWithEmailAndPassword()` resolves, Firebase Auth fires `onAuthStateChanged`, which triggers `initAuth()` in `App.jsx`.
   - Concurrently, `handleRegister()` attempts to write full registration data (name, mobile, company, specialty, requested role) to `pendingUsers/{identifier}` via `setDoc`.
   - In `initAuth()`: if `pendingDoc.exists()` is false (the document hasn't been committed by `handleRegister` yet), `initAuth()` executes lines 649–656, creating a basic pending user (`role: 'Customer'`, `status: 'Pending'`), logs activity, and calls `logout()`.
   - **The Security Rule Block**: In `firestore.rules`:
     ```firestore
     match /pendingUsers/{userId} {
       allow create: if true;
       allow read: if isAuthenticated() && request.auth.token.email == userId;
       allow read, update, delete: if isAdmin();
     }
     ```
     Notice that `allow update` requires `isAdmin()`. If `initAuth()` creates the document first, `handleRegister`'s subsequent `setDoc` becomes an **update**. Because the newly registered user is not an Admin, the write will fail with `FirebaseError: Missing or insufficient permissions`, and the custom registration details (role, company, phone, specialty) are lost!
2. **Architectural Divergence Between Code and Security Rules**:
   - `firestore.rules` under `/users/{userId}` contains an explicit exception:
     ```firestore
     allow create: if isAdmin()
       || (isAuthenticated() && request.auth.token.email == userId && (
            (request.resource.data.role == 'Customer'
              && request.resource.data.isApproved == false
              && request.resource.data.status == 'Pending')
            || (isBootstrapSuperAdmin(userId) && request.resource.data.role == 'Admin')
          ));
     ```
     This matches unit test `tests/integration/firestoreRules.test.js` line 58 (`lets a brand-new sign-in self-provision as an unapproved, pending Customer in users`).
   - However, `App.jsx` writes first-time sign-ins to `/pendingUsers/{emailKey}` instead of `/users/{emailKey}`.
   - There are two conflicting architecture models in the repo: the rules author designed pending users as unapproved entries in `users`, while the frontend author segregated them into `pendingUsers`.

---

### Trigger 7b: Admin Approval & Profile Migration

```
Admin reviews applicant in User Management (AgentDatabase.jsx)
   ↓
Admin clicks "Approve" with selected role
   ↓
App.jsx approvePending() executes atomic batch write:
   • set users/{email} (role, isApproved: true, status: 'Active', approvedAt, approvedBy)
   • delete pendingUsers/{email}
   ↓
App.jsx sets prefill state & switches tab:
   • Partner → prefill partner form, switch to 'partners' tab
   • Business Client → prefill customer form, switch to 'customers' tab
```

#### Observations & Risks

- **Atomic Firestore Migration**: The migration from `pendingUsers` to `users` via `batchWrite` is atomic and properly gated behind `isAdmin()` in both `App.jsx` and `firestore.rules`.
- **Entity Creation Decoupling (Triggers 7c & 7d)**: Approving a user grants system authentication access immediately. However, the corresponding business entity (`partners` or `customers` document) is **not** created by `approvePending`. The admin is redirected to the corresponding tab with a pre-filled form. If the admin leaves without submitting the form, the user has active login rights to the ERP without a corresponding partner/customer entity record.

---

## 3. Security, Scope, and Domain Audit

### 3.1 OAuth Scope Deficit & Downstream Service Failures

> [!CAUTION]
> Root documentation and downstream service implementations are fundamentally misaligned with requested OAuth scopes.

- **Claim in root `CLAUDE.md` (line 47)**:
  > "`src/services/firebase.js` — Firebase app/auth/firestore/storage init, Google OAuth (with Drive/Contacts scopes)..."
- **Actual Code in `src/services/firebase.js` (lines 42–45)**:
  ```javascript
  // Google Auth Provider (Standard Identity Scopes)
  const provider = new GoogleAuthProvider();
  provider.addScope('https://www.googleapis.com/auth/userinfo.email');
  provider.addScope('https://www.googleapis.com/auth/userinfo.profile');
  ```
- **Downstream Consumer Dependencies**:
  - `src/services/driveService.js` line 14: calls `https://www.googleapis.com/drive/v3/files` using `getAccessToken()`.
  - `src/services/contactsService.js` line 14: calls `https://people.googleapis.com/v1/people/me/connections` using `getAccessToken()`.
- **Failure Modes**:
  1. **HTTP 403 Forbidden**: Calls to Google Drive and Google Contacts People API fail immediately with insufficient OAuth scope errors.
  2. **Token Lifetime (1-Hour Expiry)**: `googleSignIn()` captures `credential.accessToken` and caches it in memory and `sessionStorage.getItem('ptf_google_access_token')`. Google OAuth access tokens expire after 3600 seconds. Firebase Auth does not refresh provider access tokens (it only refreshes the Firebase ID token). Once expired, `getAccessToken()` returns a stale token.
  3. **Null Token for Email Logins**: Users authenticating via email and password never obtain a Google access token, causing `getAccessToken()` to return `null`.
  4. **Privacy / Scope Risk**: Adding Drive and Contacts scopes to standard login would require full workspace permissions on the consent screen for external partners and customers, raising severe security and trust objections.

---

### 3.2 Self-Healing Super Admin Guard

The ERP implements a dual-layer self-healing mechanism for two bootstrap administrator emails:
`madhukagamage6@gmail.com` and `madhukagamage@gmail.com`.

- **Client Implementation (`src/App.jsx`)**:
  - `BOOTSTRAP_ADMIN_EMAILS` array and `isSuperAdminEmail()` helper.
  - On sign-in: If the user document exists and `role !== 'Admin'`, merges `{ role: 'Admin', status: 'Active', isApproved: true }`.
  - On first sign-in: Auto-creates `users/{emailKey}` with `role: 'Admin'`, bypassing `pendingUsers`.
  - In `onSnapshot(users)`: Prevents stale snapshot races from reverting the super admin role below `Admin`.
- **Security Rules Implementation (`firestore.rules`)**:
  - `isBootstrapSuperAdmin(email)` helper (lines 28–30) contains the exact same two hardcoded emails.
  - Grants `create` and `update` permissions on `users/{userId}` to enforce `role == 'Admin'`.
- **Vulnerabilities & Latent Bugs**:
  - **Incomplete `isAdmin()` definition in `firestore.rules`**:
    ```firestore
    function isAdmin() {
      return hasRole('admin') || hasRole('Admin');
    }
    ```
    Notice that `isAdmin()` does **not** check `isBootstrapSuperAdmin(request.auth.token.email)`. It strictly evaluates `exists(/users/$(token.email)) && data.role == 'Admin'`. If the super admin's document in `/users` is missing or temporarily deleted, security rules will deny the super admin access to any collection protected by `isAdmin()` (such as `/settings/permissions` or `/pendingUsers` reads) until the client finishes auto-creating the `/users` document.
  - **Coupled Deployment Requirement**: Adding or changing an emergency administrator requires modifying hardcoded strings in both `src/App.jsx` and `firestore.rules`, followed by deploying both Vite frontend and Firestore security rules (`firebase deploy --only firestore:rules`).

---

### 3.3 Auth Domain Configuration

- **Code in `src/services/firebase.js` (lines 18–20)**:
  ```javascript
  authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN && import.meta.env.VITE_FIREBASE_AUTH_DOMAIN !== 'print-to-frame-erp.firebaseapp.com')
    ? import.meta.env.VITE_FIREBASE_AUTH_DOMAIN
    : (fallbackConfig.authDomain || 'auth.print2frame.xyz'),
  ```
- **Analysis**:
  - The configuration intentionally rejects the default Firebase hosting domain (`print-to-frame-erp.firebaseapp.com`) in favor of the dedicated custom domain `auth.print2frame.xyz` (defined in `firebase-applet-config.json`).
  - **Rationale**: Modern web browsers (Safari ITP, Chrome Privacy Sandbox) restrict third-party cookies in cross-origin authentication iframes (`firebaseapp.com` vs `print2frame.xyz`). Using a first-party custom auth domain (`auth.print2frame.xyz`) preserves cookie state across popups and redirects.
  - **Operational Gap**: Authorized domains are managed exclusively in the Firebase Console (Authentication → Settings → Authorized domains). If a developer tests on a new deployment domain (e.g. `preview.print2frame.xyz` or local tunnel), `auth/unauthorized-domain` will be raised by Firebase Auth. `Login.jsx` has an explicit error handler detecting this and displaying an admin guidance message.

---

### 3.4 Session Persistence & Token Revocation Disconnect

> [!WARNING]
> Firestore Security Rules do not enforce account deactivation or approval status.

1. **Serverless API Layer (`api/*.js`)**:
   - Strict verification in `api/admin-user.js`, `api/generate.js`, and `api/send-email.js`.
   - Executes `adminAuth.verifyIdToken(idToken, true)`: passes `checkRevoked = true` to reject server-revoked sessions.
   - Reads `users/{decodedToken.email}` and enforces `isApproved === true || status === 'Active' || status === undefined`. Deactivated accounts receive `403 Forbidden`.
2. **Client Layer (`src/App.jsx`)**:
   - `initAuth()` checks `userData.isApproved || userData.status === 'Active' || userData.status === undefined`. If false, signs the user out immediately.
   - **Real-Time Deactivation Hole**: In `App.jsx` lines 694–715:
     ```javascript
     if (
       prev.photoURL !== data.photoURL ||
       prev.role !== data.role ||
       prev.name !== data.name ||
       prev.selectedPreset !== data.selectedPreset
     ) {
       return { ...prev, ...data };
     }
     ```
     The `onSnapshot` listener specifically observes `photoURL`, `role`, `name`, and `selectedPreset`. It **does not observe `status` or `isApproved`**. If an admin deactivates an active user in the database, the client UI does not sign the user out; the user retains access until a manual page refresh.
3. **Firestore Security Rules Layer (`firestore.rules`)**:
   - In `checkPermission(module, action)`:
     ```firestore
     function checkPermission(module, action) {
       return isAdmin() || (
         isAuthenticated() 
         && exists(/databases/$(database)/documents/users/$(request.auth.token.email))
         && exists(/databases/$(database)/documents/settings/permissions)
         && ( ... role permissions ... )
       );
     }
     ```
   - **Critical Vulnerability**: Security rules check only that the document `users/{email}` exists and that the user's role has permission in `settings/permissions`. The rules **never check `data.isApproved == true` or `data.status == 'Active'`**.
   - As a consequence, a deactivated or unapproved user holding a valid Firebase Auth token can bypass the frontend UI and make direct Firestore SDK reads and writes to business collections (`leads`, `deals`, `invoices`, `customers`) without restriction!

---

### 3.5 Miscellaneous Codebase Gaps & Disconnects

1. **Audit Logging Parity**:
   - `handleLogin()` (email/password) calls `logActivity(..., 'LOGIN', ...)`.
   - Google Sign-In and page refresh session restores (`initAuth`) **never** log a `LOGIN` event to `auditLog`.
   - In registration, `logActivity(..., 'REGISTER', ...)` is fired asynchronously without `await`, immediately followed by `logout()`. If `logout()` unauthenticates the user before the Firestore write completes, `firestore.rules` rejects the log with permission-denied.
2. **Registration Role Toggle Inconsistency in `Login.jsx`**:
   - Initial state sets `role: "Partner"`.
   - The `<select>` element exposes only `Partner` and `Business Client`.
   - However, when the user clicks the "Register" switch button (lines 261–271), the toggle handler resets the form with `role: "Customer"`.
   - Because `"Customer"` is not in the `<select>` options, the dropdown renders inconsistently, conditional fields (`company` / `specialty`) do not appear, and submitting the form writes `role: "Customer"` instead of a valid public role.
3. **Invalid Module Name in Route Guard (`App.jsx` Line 1503)**:
   - Line 1503 executes: `if (canAccess(currentUser?.role, 'fabrication')) setActiveTab('fabrication');`.
   - In `DEFAULT_PERMISSIONS` and `settings/permissions`, the fabrication module is named `'projects'`, not `'fabrication'`. This permission check always returns `false`.
4. **Email Case Sensitivity**:
   - `App.jsx` lowercases emails: `emailKey = user.email.trim().toLowerCase()`.
   - `api/*.js` queries `users/{decodedToken.email}` without lowercasing.
   - `firestore.rules` queries `/users/$(request.auth.token.email)` without lowercasing. If an OAuth identity provider issues a mixed-case email, the document lookup in rules and APIs fails.

---

## 4. Decision Matrix & Resolution Status

All recommendations below have been formally **accepted** for implementation.

| ID | Issue / Disconnect | Location | Resolution Status | Accepted Architecture & Approach |
|---|---|---|---|---|
| **DP-01** | **OAuth Scopes vs Downstream Services** | `src/services/firebase.js`<br>`driveService.js`<br>`contactsService.js` | **ACCEPTED (Option B)** | **On-Demand / Incremental Authorization**: Keep initial sign-in restricted to standard identity scopes (`userinfo.email`, `userinfo.profile`) so customers and external partners are not prompted for invasive Drive/Contacts permissions. Implement on-demand popup authorization (`GoogleAuthProvider` with additional scopes) within Drive and Contacts features. Update documentation to remove outdated scope claims. |
| **DP-02** | **Pending User Provisioning Model & Registration Race** | `App.jsx` (lines 648–656, 770–795)<br>`firestore.rules` (lines 107–111) | **ACCEPTED (Option A)** | **Permit `pendingUsers` Updates in Security Rules**: Update `firestore.rules` for `/pendingUsers/{userId}` to allow updates for unapproved registration data during onboarding (`allow update: if request.auth.token.email == userId || !resource.data.isApproved;`). This resolves the race where `initAuth` creates a shell document and causes `handleRegister` to fail with permission-denied. |
| **DP-03** | **Security Rule Enforcement of Deactivation** | `firestore.rules` (`checkPermission`) | **ACCEPTED (Option A)** | **Database-Level Deactivation Defense**: Update `checkPermission()` in `firestore.rules` to strictly enforce that the user profile is active and approved (`get(.../users/$(token.email)).data.status == 'Active' && get(.../users/$(token.email)).data.isApproved == true`). Prevents deactivated or unapproved accounts with valid tokens from making direct SDK reads/writes. |
| **DP-04** | **Client Real-Time Eviction on Deactivation** | `src/App.jsx` (lines 694–715) | **ACCEPTED (Option A)** | **Real-Time UI Session Eviction**: Expand `onSnapshot(users)` in `App.jsx` to observe `status` and `isApproved`. If the currently authenticated user's record is marked inactive, disabled, or unapproved in Firestore, immediately invoke `handleSignOut()` / `logout()` with an informative banner. |
| **DP-05** | **Registration Form Role State** | `src/components/auth/Login.jsx` (line 268) | **ACCEPTED (Option A)** | **Form State Alignment**: Fix the view-toggle handler in `Login.jsx` to default to `role: "Partner"` (the first option in `PUBLIC_REGISTRATION_ROLES` and `<select>`), eliminating the ghost `"Customer"` state and rendering the correct conditional fields. |
| **DP-06** | **Super Admin Configuration Hardcoding** | `src/App.jsx` (line 94)<br>`firestore.rules` (line 29) | **ACCEPTED (Option A)** | **Synchronized Self-Healing Lists**: Maintain hardcoded bootstrap administrator lists in both files to ensure self-healing capability is resilient against database or rule corruption. Update `isAdmin()` in `firestore.rules` to include `isBootstrapSuperAdmin(request.auth.token.email)` so super admins possess administrative privileges even before their initial document is written. |
| **DP-07** | **Audit Logging Parity & Race Condition** | `src/App.jsx` (lines 658, 763, 783)<br>`src/services/auditLog.js` | **ACCEPTED (Option A)** | **Audit Parity & Awaited Writes**: Add `logActivity(..., 'LOGIN', ...)` inside `initAuth()` for Google sign-in and session restore events. Explicitly `await logActivity(...)` before calling `logout()` in registration flows so audit log writes are not aborted or rejected due to premature session termination. |
| **DP-08** | **Route Guard Module Identifier** | `src/App.jsx` (line 1503) | **ACCEPTED (Option A)** | **Module Key Correction**: Replace `'fabrication'` with `'projects'` in `App.jsx` line 1503 to match `DEFAULT_PERMISSIONS` and the `settings/permissions` schema. |

---

## 5. Implementation Action Plan

Based on the accepted decisions, the following technical actions are scheduled for implementation:

### 5.1 Security Rules (`firestore.rules`)
1. **Enforce Active Status in `checkPermission`**:
   ```firestore
   function isApprovedAndActive(email) {
     return exists(/databases/$(database)/documents/users/$(email))
       && (get(/databases/$(database)/documents/users/$(email)).data.get('isApproved', false) == true
           || get(/databases/$(database)/documents/users/$(email)).data.get('status', '') == 'Active');
   }

   function checkPermission(module, action) {
     return isAdmin() || (
       isAuthenticated() 
       && isApprovedAndActive(request.auth.token.email)
       && exists(/databases/$(database)/documents/settings/permissions)
       && ( ... )
     );
   }
   ```
2. **Include Bootstrap Super Admins in `isAdmin()`**:
   ```firestore
   function isAdmin() {
     return isBootstrapSuperAdmin(request.auth.token.email) || hasRole('admin') || hasRole('Admin');
   }
   ```
3. **Allow Self-Update on `pendingUsers`**:
   ```firestore
   match /pendingUsers/{userId} {
     allow create: if true;
     allow read: if isAuthenticated() && request.auth.token.email == userId;
     allow update: if (isAuthenticated() && request.auth.token.email == userId) || isAdmin();
     allow delete: if isAdmin();
   }
   ```

### 5.2 Client Authentication & UI (`src/App.jsx` & `src/components/auth/Login.jsx`)
1. **Fix Registration Role State in `Login.jsx`**:
   Update line 268 to set `role: "Partner"` instead of `"Customer"`.
2. **Prevent Trigger 7a Race Condition in `App.jsx`**:
   - In `handleRegister`: Ensure `await setDoc(doc(db, COLLECTIONS.PENDING_USERS, ...))` completes, `await logActivity(...)` finishes, and then call `await logout()`.
   - In `initAuth`: If `!userDoc.exists()` and `!pendingDoc.exists()`, check whether a registration action is actively executing before creating a default pending shell doc.
3. **Real-time Session Eviction in `App.jsx`**:
   In `onSnapshot(collection(db, COLLECTIONS.USERS))`, compare `data.status` and `data.isApproved`. If `data.status === 'Disabled'` or `data.status === 'Deactivated'` or `data.isApproved === false`, immediately call:
   ```javascript
   handleSignOut();
   setLoginError("Your account has been deactivated by an administrator.");
   ```
4. **Audit Logging Parity**:
   Add `logActivity(emailKey, user.displayName || emailKey, 'LOGIN', 'Auth', 'User session authenticated.')` in `initAuth()` for successful non-stale sessions.
5. **Route Guard Typo**:
   Update line 1503 in `src/App.jsx` to check `canAccess(currentUser?.role, 'projects')`.

### 5.3 Integrations & Scope Handling (`src/services/`)
1. **Incremental Google OAuth**:
   In `driveService.js` and `contactsService.js`, introduce on-demand authorization helper using `signInWithPopup(auth, new GoogleAuthProvider().addScope(...))` when the user initiates Google Workspace sync, caching the specific token separately with explicit expiry checks.
2. **Normalize Email Lookups**:
   Ensure `api/*.js` normalizes `decodedToken.email.trim().toLowerCase()` prior to querying Firestore.

