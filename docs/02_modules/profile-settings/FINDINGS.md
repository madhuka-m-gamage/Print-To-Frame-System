# User Profile & Settings Module Review & Correctness Audit Findings

> **Scope**: Correctness review of `docs/02_modules/profile-settings/CLAUDE.md`, `docs/02_modules/profile-settings/README.md`, and cross-module triggers touching User Profile and Settings.  
> **Branch / Worktree**: `review-profile-settings` (`.worktrees/review-profile-settings`)  
> **Status**: Review & Audit findings (no functional code modified).

---

## 1. Executive Summary

A thorough architectural and code-level audit was conducted across the User Profile & Settings module and its integration touchpoints:
- **Module Documentation**: `docs/02_modules/profile-settings/CLAUDE.md`, `docs/02_modules/profile-settings/README.md`
- **Cross-Module Architecture**: `docs/01_architecture/CROSS_MODULE_TRIGGERS.md`
- **UI Components**: `src/components/common/UserProfile.jsx`, `src/shared/ui/ImageCropModal.jsx`, `src/shared/ui/StatusBadge.jsx`, `src/shared/ui/PageHeader.jsx`
- **App State & Lifecycle**: `src/App.jsx` (`handleUpdateUser`, `handleSignOut`, theme management, auth listener, users snapshot listener)
- **Tokens & Styling**: `brand-tokens.json`, `tailwind.config.js`, `src/index.css`
- **Security Rules & RBAC**: `firestore.rules` (`/users/{userId}`, `/partners/{partnerId}`, `/customers/{customerId}`, `/settings/permissions`), `src/context/PermissionsContext.jsx`
- **Constants & Utilities**: `src/constants/companyInfo.js`, `src/shared/utils/toast.js`, `src/services/auditLog.js`

While the core presentation layer (avatar cropping, section tabs for personal, workspace, and preferences) is implemented, **critical architectural defects, security rule permission failures, dual sync race conditions, and UI stubs** were identified:
1. **Broken Customer Profile Mirroring (Silent Firestore Permission Denied)**: `UserProfile.jsx` attempts to query and update `COLLECTIONS.CUSTOMERS` when a Customer or Business Client edits their profile. However, `firestore.rules` lacks any self-read/update rule on `/customers/{customerId}` (unlike `/projects` or `/invoices`), and `PermissionsContext` grants `customers: none()` to these roles. Consequently, customer updates fail with `permission-denied` 100% of the time, caught silently with `console.warn` while the UI falsely reports success.
2. **Dual Sync Redundancy & Partner Over-Privilege Flaw**: When a Partner saves their profile, `UserProfile.jsx` updates `partners` directly, then calls `onUpdateUser`, which triggers `handleUpdateUser` in `App.jsx` to update `partners` a second time. Furthermore, `DEFAULT_PERMISSIONS` grants `Partner` role `partners: full()`, meaning any partner possesses Firestore permissions to edit or delete any other partner's document in the system.
3. **Password Reset UI Placebo**: The "Reset Password" button in `UserProfile.jsx` executes a toast notification stating instructions were sent, but makes zero calls to Firebase Auth (`sendPasswordResetEmail` or `updatePassword`) or any backend endpoint. No email or reset instruction is ever sent.
4. **Google OAuth Avatar Clobbering Preset Avatars**: If a user selects an avatar preset (which intentionally clears `photoURL` to empty string), the next Google sign-in detects `!userData.photoURL && user.photoURL` and automatically overwrites their profile with their Google account picture, destroying their chosen avatar preset.
5. **Inline Base64 Avatars Inflating Document Reads**: Profile pictures are cropped to a 400x400 JPEG and saved directly as base64 data URLs in Firestore `users/{email}.photoURL` (and mirrored to `partners`/`customers`). Because internal messaging subscribes all users to `COLLECTIONS.USERS`, every avatar in the company is transferred over the wire on every user state change. No Cloud Storage bucket is configured.
6. **Phantom System Preferences**: The "Desktop Browser Notifications" and "Audio Sound Effects" toggles write booleans to `users`, but are never consulted by browser notification triggers (`uT` in `App.jsx`), and no audio playback system or sound files exist in the application.
7. **Theme Persistence Disconnect**: Theme (`light`/`dark`) is kept purely in browser `localStorage` and DOM `data-theme`. It is never stored in the user profile in Firestore, causing preferences to be lost across devices, and `UserProfile.jsx` contains no theme setting controls.
8. **Dead LocalStorage Cache (`ptf_user`)**: `handleUpdateUser` writes the entire user profile (including large base64 photos) to `localStorage.setItem("ptf_user", ...)`, but `localStorage.getItem("ptf_user")` is never called anywhere in the codebase.
9. **Role Misuse in `StatusBadge`**: `UserProfile.jsx` renders user roles (`Admin`, `Sales`, `Partner`, etc.) using `StatusBadge`, but `StatusBadge` only supports workflow stages (`completed`, `in transit`, `pending`). Every role falls back to an identical neutral gray badge.

---

## 2. Review of Module Documentation

### 2.1 `docs/02_modules/profile-settings/CLAUDE.md`

| Section / Claim | Code Status | Details / Discrepancy |
|---|---|---|
| **What it does** ("One self-service profile page plus a theme toggle. There is no separate settings screen.") | **Accurate** | Confirmed: Tab `profile` renders `UserProfile.jsx`; theme toggle is embedded in top bar and sidebar in `App.jsx`. There is no dedicated settings route. |
| **Firestore collections it owns or writes** ("Writes `users/{identifier}`; mirrors into `partners` or `customers` for those roles; `auditLog` (`UPDATE`, `Profile`). localStorage: `ptf_theme`, `ptf_user`.") | **Partially Accurate / Broken in Practice** | - Writes to `users/{identifier}` and `auditLog` succeed.<br>- Mirroring to `partners` executes twice (once in `UserProfile.jsx`, once in `App.jsx`).<br>- Mirroring to `customers` **fails 100% of the time** due to missing `firestore.rules` permissions.<br>- `ptf_user` is written to `localStorage` but never read. |
| **Triggers and side effects** ("Photos are cropped to base64 and stored inline in `photoURL` (no Storage).") | **Accurate** | Confirmed: `ImageCropModal.jsx` outputs `canvas.toDataURL('image/jpeg', 0.88)` and stores directly into `photoURL`. No Firebase Storage is used. |
| **Triggers and side effects** ("Two sync paths (UserProfile and `handleUpdateUser`) differ: only the first updates `customers`.") | **Accurate but Understates Bug** | Accurately notes that `handleUpdateUser` omits `customers`, but fails to mention that the `UserProfile` path for `customers` is blocked by Firestore security rules. |
| **Before you edit** ("Password change is a stub (toast only).") | **Accurate** | Confirmed: `handlePasswordReset` calls only `toast.info(...)`. |
| **Before you edit** ("Role, status and email are protected only by the client payload; rules block role / status changes for non-admins.") | **Contradictory / Discrepancy** | `CLAUDE.md` states "protected only by the client payload" and immediately asserts "rules block role / status changes for non-admins". Code inspection confirms `firestore.rules:L97-99` strictly enforces `request.resource.data.role == resource.data.role && ...` for non-admins. |
| **Before you edit** ("`src/constants/companyInfo.js` is unused.") | **Accurate** | Confirmed: `COMPANY_INFO` is never imported under `src/`. Hardcoded duplicates exist throughout `UserProfile.jsx`. |

### 2.2 `docs/02_modules/profile-settings/README.md`

| Section / Claim | Code Status | Details / Discrepancy |
|---|---|---|
| **Files and Folders** ("`UserProfile.jsx`... `ImageCropModal.jsx`... `App.jsx`... `companyInfo.js`") | **Accurate** | File locations and relationships are verified. |
| **Firestore collections read/written** ("`users/{lowercased identifier}`: `setDoc(..., { merge: true })` with name, contactNumber...") | **Accurate** | Field list in `UserProfile.jsx:L112-126` matches document. |
| **Firestore collections read/written** ("`customers`... updates name, photoURL, and phone / address when non-empty.") | **Broken by Security Rules** | Code attempts this in `UserProfile.jsx:L160-184`, but the write is rejected by `firestore.rules` because neither `Customer` nor `Business Client` has write permissions on `customers`. |
| **Firestore collections read/written** ("`localStorage`: `ptf_theme`... `ptf_user` (cached user; set in `handleUpdateUser`, removed on sign-out).") | **Misleading** | While `ptf_user` is set and removed, it is **never read** on startup or re-render. Calling it a "cached user" implies offline or initial session restoration, which does not exist. |
| **Cloud Functions / triggers** ("Editable: the `users` fields listed above. Protected on the client only: role, status, email and identifier... whether rules also block them was not examined here...") | **Resolved in Rules Audit** | Rules audit confirms `firestore.rules:L97-101` explicitly validates that non-admins cannot change `role`, `isApproved`, or `status`. However, other fields like `partnerId` or `clientNIC` are unconstrained in rules. |
| **Open questions** ("Photos as base64 in Firestore documents inflate every read of `users`...") | **Confirmed Major Concern** | Verified: Storing 30-60KB base64 strings directly in `users` documents inflates bandwidth for global snapshot listeners (such as Messaging user lists). |

---

## 3. Trigger & Architecture Audit (`CROSS_MODULE_TRIGGERS.md`)

Profile and settings updates are currently omitted from `docs/01_architecture/CROSS_MODULE_TRIGGERS.md` under section 8 ("Other cross-module writes"). Below is the formal execution chain and failure analysis for this module:

### Trigger Chain A: User Updates Profile in `UserProfile.jsx`

| Step | Trigger | Function | Effect | Downstream Module(s) | Sync / Async |
|---|---|---|---|---|---|
| **A1** | User clicks "Save Info" / "Save Profile Changes" | `handleSaveProfile` (`UserProfile.jsx:L106`) | Writes `users/{email}` via `setDoc(..., { merge: true })` | User Management / Auth | Awaited in-app |
| **A2** | If `currentUser.role === 'Partner'` | `UserProfile.jsx:L133-158` | Queries `partners` by `email` and `partnerId`; updates `name`, `contactPerson`, `photoURL`, `phone`, `address`, `company` via `updateDoc` | Partners | Awaited in-app (errors caught in `console.warn`) |
| **A3** | If `currentUser.role` in `['Customer', 'Business Client']` | `UserProfile.jsx:L159-184` | Queries `customers` by `email` and `nic`; attempts `updateDoc` on matched docs | Customers | Awaited in-app (**Fails with `permission-denied`**) |
| **A4** | Profile write succeeds | `onUpdateUser` $\rightarrow$ `handleUpdateUser` (`App.jsx:L881`) | Updates React state `currentUser`, updates `users` array, writes `localStorage.setItem('ptf_user')` | App root state | Synchronous |
| **A5** | If `updatedUser.role === 'Partner' \|\| updatedUser.partnerId` | `handleUpdateUser` (`App.jsx:L891-908`) | Finds partner in React state; calls `updateDocument(COLLECTIONS.PARTNERS, pDocId, pUpdates)` | Partners | Unawaited (`.catch(console.warn)`) |
| **A6** | Profile write succeeds | `logActivity` (`UserProfile.jsx:L197`) | Writes to `auditLog` collection (`UPDATE`, `Profile`) | Audit Log | Awaited in-app |

#### Critical Findings in Chain A:
1. **Unchecked Firestore Permission Rejection on `customers`**:
   - `UserProfile.jsx:L160-184` runs when a Customer or Business Client updates their profile.
   - `firestore.rules:L166-170` allows read/write on `/customers/{customerId}` only if `checkPermission('customers', ...)` is satisfied.
   - `DEFAULT_PERMISSIONS` gives `Customer` and `Business Client` `none()` for `customers`.
   - Result: Both the `getDocs` query and the `updateDoc` call fail with `permission-denied`.
   - The error is swallowed in `UserProfile.jsx:L186` (`console.warn('Cross-collection directory sync notice:', syncErr)`). The UI shows `toast.success('Profile updated successfully')`, creating a false guarantee of persistence.
2. **Double-Write Race Condition on `partners`**:
   - Step A2 performs direct Firestore `updateDoc` calls on `COLLECTIONS.PARTNERS`.
   - Step A5 runs immediately after via `onUpdateUser` and fires `updateDocument(COLLECTIONS.PARTNERS, ...)` on the same partner record.
   - This results in two roundtrips to Firestore for every single profile save by a Partner.
3. **Incomplete Field Clear Bug**:
   - Both sync routines guard fields with `if (formData.contactNumber.trim())`.
   - If a partner or customer deletes their phone number, location, or company in their profile, the update payload omits those keys, leaving stale data in `partners` or `customers`.

---

### Trigger Chain B: Theme Toggle and Persistence

| Step | Trigger | Function | Effect | Downstream Module(s) | Sync / Async |
|---|---|---|---|---|---|
| **B1** | App mount / hydration | `useState` initializer (`App.jsx:L256`) | Reads `localStorage.getItem('ptf_theme') \|\| 'dark'` | All UI components | Synchronous |
| **B2** | User clicks Sun/Moon toggle | `toggleTheme` (`App.jsx:L267`) | Switches `theme` between `'dark'` and `'light'` | All UI components | Synchronous |
| **B3** | `theme` state change | `useEffect` (`App.jsx:L260-265`) | Sets `document.documentElement.setAttribute('data-theme', theme)` and `localStorage.setItem('ptf_theme', theme)` | DOM / CSS variables | Synchronous |

#### Critical Findings in Chain B:
1. **No Cloud / User Profile Persistence**:
   - The theme preference is not saved to `users/{identifier}` in Firestore.
   - A user switching devices or browsers is forced back to default `'dark'` mode.
2. **Missing UI in Profile Page**:
   - Despite `UserProfile.jsx` having a "System Preferences" tab, the theme toggle is only present in the top navigation bar and sidebar; it is entirely missing from `UserProfile.jsx`.
3. **Font Token Disconnect**:
   - `brand-tokens.json` specifies `"sans": "Inter, ui-sans-serif, system-ui, sans-serif"`.
   - `tailwind.config.js` configures `sans: ['Poppins', 'ui-sans-serif', 'system-ui', 'sans-serif']`.
   - The portal uses Poppins, drifting from the brand token specification.
4. **Hardcoded Color Tokens in Light Mode**:
   - In `tailwind.config.js`, `secondary: '#34d399'`, `error: '#fca5a5'`, and `error-container: '#7f1d1d'` are hardcoded HEX values and do not use CSS variable indirection (`rgb(var(...) / <alpha-value>)`). In `[data-theme='light']`, these colors remain dark-palette shades, failing contrast standards.

---

### Trigger Chain C: Google OAuth Auto-Sync vs. Avatar Presets

| Step | Trigger | Function | Effect | Downstream Module(s) | Sync / Async |
|---|---|---|---|---|---|
| **C1** | User selects Avatar Preset in Profile | `handleSelectPreset` (`UserProfile.jsx:L97`) | Clears `photoURL: ''`, sets `selectedPreset: presetId` | UserProfile state | Synchronous |
| **C2** | User clicks "Save Info" | `handleSaveProfile` (`UserProfile.jsx:L106`) | Saves `photoURL: ''` and `selectedPreset: presetId` to `users/{email}` | Firestore `users` | Awaited in-app |
| **C3** | User logs in again via Google OAuth | `initAuth` callback (`App.jsx:L591-594`) | Checks `if (!userData.photoURL && user.photoURL)`. Writes `{ photoURL: user.photoURL }` to Firestore | Firestore `users` | Background / Unawaited |
| **C4** | User profile renders | `renderAvatar` (`UserProfile.jsx:L225-249`) | `if (formData.photoURL)` takes precedence over `formData.selectedPreset` | UI Avatar display | Render-time |

#### Critical Findings in Chain C:
- **Destructive Clobbering**: Step C3 detects `photoURL: ''` and assumes the user has no avatar, automatically copying the Google profile picture back into Firestore. Because `renderAvatar` checks `photoURL` first, the user's avatar preset choice is completely erased on their next login.

---

## 4. Codebase Tracing & Verification

### 4.1 Target UI Component: `src/components/common/UserProfile.jsx`

1. **Password Reset Disconnect (`L214-217`)**:
   ```javascript
   const handlePasswordReset = () => {
     toast.info(`Password reset instructions sent to ${currentUser.identifier}`);
   };
   ```
   This is an entirely inert UI mock. No email is sent.
2. **Unvalidated Form Inputs**:
   - `contactNumber` accepts arbitrary non-numeric text without format enforcement or validation.
   - `bio`, `specialty`, `jobTitle`, `location`, `company` have no maximum length boundaries.
3. **Hardcoded Fallback for "Member Since" (`L262`)**:
   - `{toDateObj(currentUser?.createdAt)?.getFullYear() || "2024"}`.
   - Self-registration in `App.jsx:L635-662` does not populate `createdAt`. All self-registered users display "2024".
4. **Hardcoded Company Information**:
   - Lines 41, 45, 504, 552, 704 contain hardcoded strings for `"Kadawatha, Sri Lanka"`, `"+94 71 141 9027"`, and `"Print To Frame Pvt Ltd"`, completely ignoring `src/constants/companyInfo.js`.
5. **Generational Image Quality Loss (`L87-94`)**:
   - When a user clicks "Crop & Adjust Placement" on an existing photo, the already-compressed 400x400 JPEG data URL is re-drawn to canvas and re-compressed at 0.88 quality, degrading image fidelity on every adjustment.
6. **No Reactive Form State from `currentUser`**:
   - `formData` is initialized once from `currentUser` via `useState`. If `currentUser` updates via Firestore `onSnapshot`, `formData` is not refreshed, risking overwriting remote updates if the user saves late.

---

### 4.2 App State & Handlers: `src/App.jsx`

1. **Snapshot Listener Incomplete Diffing (`L694-714`)**:
   ```javascript
   if (currentUser?.identifier && data.identifier === currentUser.identifier) {
     setCurrentUser(prev => {
       if (!prev) return data;
       if (
         prev.photoURL !== data.photoURL ||
         prev.role !== data.role ||
         prev.name !== data.name ||
         prev.selectedPreset !== data.selectedPreset
       ) {
         const merged = { ...prev, ...data };
         ...
         return merged;
       }
       return prev;
     });
   }
   ```
   - Only changes to `photoURL`, `role`, `name`, and `selectedPreset` trigger a state update.
   - If an administrator deactivates the user (`status: 'Disabled'`), or changes their `contactNumber`, `company`, or `jobTitle`, `setCurrentUser` **does not update**. The user's in-memory session retains stale data.
2. **Dead LocalStorage Key `ptf_user` (`L876, L885`)**:
   - `handleUpdateUser` executes `localStorage.setItem("ptf_user", JSON.stringify(updatedUser))`.
   - `handleSignOut` executes `localStorage.removeItem("ptf_user")`.
   - `localStorage.getItem("ptf_user")` is **never invoked anywhere in the codebase**. Session restoration relies exclusively on Firebase Auth's persistent token. This results in useless storage consumption.

---

### 4.3 Privilege Isolation: `firestore.rules` vs. User Updates

```javascript
// firestore.rules:L84-104
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

1. **Privilege Isolation Verification**:
   - **`role`**: Protected. If a non-admin attempts to change their role, `request.resource.data.role == resource.data.role` evaluates to `false` and the write is rejected.
   - **`isApproved`**: Protected. Non-admins cannot approve themselves.
   - **`status`**: Protected. Non-admins cannot reactivate a disabled account.
   - **`permissions`**: Permissions are stored in `/settings/permissions`, writable only by `isAdmin()` (`L71`).
2. **Gaps in Document Attribute Protection**:
   - `partnerId`, `clientNIC`, and `tempPassword` are not guarded in `firestore.rules:L97-100`. A direct SDK write from an authenticated user could alter `partnerId` to claim another partner's ledger.

---

### 4.4 Status Badge Mapping: `StatusBadge.jsx`

In `UserProfile.jsx:L320`:
```javascript
<StatusBadge status={currentUser?.role || 'Member'} size="sm" />
```
Inspection of `src/shared/ui/StatusBadge.jsx`:
- `STATUS_STYLES` categories:
  - Success: `['completed', 'delivered', 'canvas in', 'received', 'paid', 'approved']`
  - Progress: `['in transit', 'ongoing', 'fabricating', 'processing']`
  - Ready: `['ready', 'ready to load', 'ready for inspection']`
  - Warning: `['pending', 'waiting', 'intake', 'awaiting']`
  - Danger: `['revision', 'blocked', 'cancelled', 'error']`
  - Info: `['75% invoice submitted', 'hand over']`
- **Result**: No user roles (`Admin`, `Manager`, `Sales`, `Operations`, `Support`, `Accounts`, `Logistics`, `Partner`, `Customer`, `Business Client`) match any status category.
- **Outcome**: The role badge always falls back to `DEFAULT_STYLE` (`bg-surface-container-high text-on-surface-variant border-outline-variant`), displaying as a generic gray box with no role-specific color coding.

---

## 5. Structured Table of Disconnects & Open Decision Points

| # | Issue / Disconnect | Current Behavior in Code | Documentation / Trigger Conflict | Recommended Solution / Decision Required |
|---|---|---|---|---|
| **1** | **Customer Profile Mirroring Fails (Permission Denied)** | `UserProfile.jsx:L160-184` queries and updates `customers`, but Firestore rules reject write for Customer/Business Client roles. | `profile-settings.md` claims profile edits mirror into `customers`. Error is swallowed with `console.warn`. | Update `firestore.rules` for `customers` to permit authenticated users to update their own document matching `request.auth.token.email`, or delegate sync to a backend function. |
| **2** | **Redundant Double-Write to `partners`** | Both `UserProfile.jsx` (direct `updateDoc`) and `App.jsx` (`handleUpdateUser` $\rightarrow$ `updateDocument`) update `COLLECTIONS.PARTNERS`. | Generates two Firestore writes per profile save. | Consolidate partner mirroring into a single location (preferably `handleUpdateUser` in `App.jsx`). |
| **3** | **Partner Role Over-Privileged in Firestore Rules** | `DEFAULT_PERMISSIONS` gives `Partner` role `partners: full()`, enabling full create, edit, and delete permissions on all partner documents in rules. | Violates least-privilege security principle. | Restrict `Partner` role in `DEFAULT_PERMISSIONS` to read-only or self-profile edits, and update `firestore.rules` to check ownership (`partnerId == request.auth.token.email`). |
| **4** | **Password Reset Button is an Inactive Stub** | `handlePasswordReset` shows `toast.info(...)` without invoking any Firebase Auth or backend API. | Users are misled to believe instructions were dispatched. | Integrate Firebase Auth client SDK `sendPasswordResetEmail(auth, currentUser.identifier)` with real error handling. |
| **5** | **Google OAuth Overwrites Preset Avatars** | `App.jsx:L591-594` detects empty `photoURL` on login and writes Google's photo URL, overriding user-selected avatar presets. | Avatar presets chosen by users are deleted on subsequent Google logins. | In `App.jsx`, do not auto-sync Google photoURL if `userData.selectedPreset` is populated. |
| **6** | **Inline Base64 Images Inflating Document Reads** | Avatars are saved directly as base64 strings in Firestore `users/{email}` documents (and mirrored to `partners`/`customers`). | Storing 30-60KB data URLs in Firestore inflates bandwidth on global listeners (`COLLECTIONS.USERS` snapshot). | Transition avatar storage to Firebase Cloud Storage (upload cropped blob, store HTTPS download URL). |
| **7** | **Incomplete Field Removal on Mirror Sync** | Profile sync uses `if (formData.contactNumber.trim())` before setting keys on `partners`/`customers`. | If a user clears their phone or address, the old value remains in directory collections. | Explicitly pass empty strings or `deleteField()` when optional contact fields are cleared. |
| **8** | **Phantom System Preference Toggles** | Notification and audio toggles write to `users` doc, but browser notifications ignore them and no audio system exists. | Misrepresents system capabilities in UI. | Connect `notificationsEnabled` to `uT()` in `App.jsx`, and either implement sound effects or remove the audio toggle. |
| **9** | **Theme Not Synced to User Profile** | Theme (`light`/`dark`) is saved only in browser `localStorage`. | User preferences do not follow their account across devices or browsers. | Add `theme` to `users/{identifier}` schema and sync on change, while retaining `localStorage` for pre-hydration flash prevention. |
| **10** | **Dead LocalStorage Key `ptf_user`** | `handleUpdateUser` writes `ptf_user` to `localStorage`, but it is never read anywhere. | Dead code and storage waste (including large base64 photos). | Remove `localStorage.setItem('ptf_user')` or use it intentionally during app bootstrapping. |
| **11** | **`StatusBadge` Has No Role Styles** | User roles passed to `StatusBadge` fall back to generic neutral gray. | Role badges in UserProfile lack visual differentiation. | Add role badge definitions (`admin`, `manager`, `sales`, `partner`, `customer`, etc.) to `StatusBadge.jsx`. |
| **12** | **Font & Color Disconnect in Brand Tokens** | `brand-tokens.json` specifies `Inter`, but `tailwind.config.js` specifies `Poppins`. Secondary/error colors are hardcoded HEX. | Breaks single source of truth and causes light-theme contrast issues. | Align font family to brand token specification, and convert secondary/error colors to CSS custom properties. |
| **13** | **Unused `COMPANY_INFO` Constant** | `src/constants/companyInfo.js` is never imported; hardcoded strings are scattered in `UserProfile.jsx`. | Code duplication and maintenance hazard when company details change. | Import and use `COMPANY_INFO` across `UserProfile.jsx` and footer components. |
| **14** | **Missing `createdAt` on Self-Registered Users** | `App.jsx` does not write `createdAt` during self-registration; "Member Since" defaults to "2024". | Inaccurate user metadata. | Ensure `createdAt: new Date().toISOString()` is set on all new user registrations. |
| **15** | **App `onSnapshot` Ignores Profile Metadata Changes** | `App.jsx:L698-701` only checks `photoURL`, `role`, `name`, and `selectedPreset`. | Admin deactivations (`status`) or remote contact updates do not update `currentUser` in memory. | Check `data.status`, `data.contactNumber`, `data.company`, etc. in `setCurrentUser` diff check. |

---

## 6. Resolved Architectural Decisions & Action Matrix

All major architectural decisions identified during the audit have been formally aligned and resolved:

| Decision Area | Agreed Resolution | Implementation Scope |
|---|---|---|
| **1. Customer Directory Sync** | **Secure Backend Serverless Endpoint** | Implement dedicated authenticated serverless endpoint (`api/sync-profile.js`) with Firebase Admin SDK to whitelist updates to `name`, `phone`, `address`, and `photoURL` on matching `customers` documents, preventing exposure or tampering of financial/order metrics. |
| **2. Partner Mirroring Consolidation** | **Consolidate solely into `handleUpdateUser` in `App.jsx`** | Remove redundant direct `partners` queries and writes from `UserProfile.jsx`; centralize all partner record synchronization and state update logic in `handleUpdateUser`. |
| **3. Partner Privilege Isolation** | **Restrict to Self-View / Self-Edit Only** | Update `DEFAULT_PERMISSIONS` to revoke `create`, `edit`, and `delete` across all partners, and configure `firestore.rules` on `/partners/{partnerId}` to enforce ownership (`partnerId == request.auth.token.email \|\| resource.data.email == request.auth.token.email`). |
| **4. Password Management** | **Interactive Authenticated Password Change Modal** | Replace placeholder toast with `PasswordChangeModal` utilizing Firebase Auth client SDK (`reauthenticateWithCredential` + `updatePassword`), with clear provider delegation notices for Google OAuth accounts. |
| **5. Google OAuth vs. Avatar Presets** | **Preserve Preset Selection in Auth Listener** | In `App.jsx` auth listener, condition Google photoURL auto-sync on `!userData.photoURL && user.photoURL && !userData.selectedPreset`, ensuring user-chosen avatar presets are never clobbered. |
| **6. Avatar Storage Architecture** | **Transition to Firebase Cloud Storage** | Upload cropped avatar blobs to Firebase Storage (`avatars/${userId}_${Date.now()}.jpg`) and persist the HTTPS download URL in `photoURL`, stopping Firestore document inflation and high bandwidth overhead. |
| **7. System Sound Preferences** | **Implement Web Audio API Synthesizer** | Add pure Web Audio API chime synthesizer (`playChimeSound()`) without external asset dependencies, wiring it to notification events when `audioAlertsEnabled !== false`. |
| **8. Theme Cloud Persistence** | **Save Theme to `users/{identifier}`** | Synchronize theme preference to Firestore `users/{identifier}.theme` on change, initialize theme from cloud profile on login, and add theme selector UI inside `UserProfile.jsx` preferences. |
| **9. Brand Token Authoritative Font** | **`Poppins` is Authoritative** | Update `brand-tokens.json` to declare `Poppins` as canonical font family, eliminating visual drift with `tailwind.config.js`. |
