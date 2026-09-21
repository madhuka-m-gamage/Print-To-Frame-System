# Employees Module Review & Architecture Audit Findings

> **Scope**: Architectural audit, codebase verification, and accepted design decisions for `docs/02_modules/employees/CLAUDE.md`, `docs/02_modules/employees/README.md`, and cross-module triggers documented in `docs/01_architecture/CROSS_MODULE_TRIGGERS.md`.  
> **Branch / Worktree**: `review-employees` (`.worktrees/review-employees`)  
> **Status**: Review & Audit findings complete. All recommended decisions formally accepted by user. Detailed HR data model specified below.

---

## 1. Executive Summary

An in-depth architectural and code-level audit of the "Employees" domain was conducted across the Print To Frame ERP codebase. The primary findings and user-approved decisions are summarized below:

1. **Absence of Independent Employees Module**: There is no dedicated Employees module, UI route, component, or Firestore collection (`employees` or `staff`). Staff identities exist solely as documents in the `users` collection, administered via the "User Management" interface (`src/components/admin/AgentDatabase.jsx`, tab id `agents`).
2. **Approved HR Data Model (Decision D1)**: Rather than maintaining an unstructured `users` record, an enterprise **HR Data Model** will be integrated into staff records, introducing formalized Employee IDs (`PTF-EMP-####`), departmental classifications, employment terms, NIC verification, emergency contacts, skills tracking, and compensation structures.
3. **Hardcoded Staff & Driver Directory Disconnect (Decision D2)**: `src/utils/logisticsEngine.js` hardcodes a static in-memory `DRIVER_DIRECTORY` (4 named individuals) and `FLEET_VEHICLES` (3 vehicles). Delivery assignment in `Logistics.jsx` and `LogisticsCardDetails.jsx` draws strictly from this array. Real staff enrolled with the `Logistics` role in `users` cannot be assigned to dispatch jobs. **Approved Resolution**: Migrate drivers to live Firestore queries of `users` where `role === 'Logistics'` (or `Operations`), and fleet units to a dynamic `settings/fleet` or `fleet` Firestore collection.
4. **Standardized Task Assignment Across Modules (Decision D3)**: Currently, Leads only assign external referral partners, Fabrication uses an unvalidated free-text string, and Logistics uses a static array. **Approved Resolution**: Standardize operational assignments across CRM (Sales Rep), Fabrication (Factory Assignee), and Logistics (Delivery Driver) using live lookups against `users` filtered by role.
5. **RBAC Delegation for Managers & Admins (Decision D4)**: Management actions in `AgentDatabase.jsx` are gated in the UI by `canAccess(currentUser?.role, 'agents', 'edit')`, but `firestore.rules` and `api/admin-user.js` strictly enforce `role === 'Admin'`. **Approved Resolution**: Update both `firestore.rules` and `api/admin-user.js` to authorize both **Admins and Managers** who have been granted `agents` management authority in the permissions matrix.
6. **Atomic User Deletion Ordering (Decision D5)**: Deleting a user in `AgentDatabase.jsx` deletes the Firestore profile before deleting the Firebase Auth account. If the backend fails, the Auth account becomes orphaned, blocking future re-enrollment with `auth/email-already-exists`. **Approved Resolution**: Reorder deletion to remove the Auth account first (or implement rollback logic if either step fails).
7. **Internal Staff Approval Notifications (Decision D6)**: Approving an applicant into an internal employee role currently sends no notification. **Approved Resolution**: Automatically dispatch an `employee_approved` / `employee_invite` email upon internal user approval.
8. **Removal of Dead UI Navigation Link (Decision D7)**: `src/components/common/UserProfile.jsx` features an "Execution Plan" button that navigates to a non-existent tab (`roadmap`), causing a blank viewport. **Approved Resolution**: Remove the dead button completely.
9. **UI & Status Badge Alignment (Decision D8)**: `StatusBadge.jsx` is imported but unused in `AgentDatabase.jsx`, and email defaulting sends internal onboarding emails to retail `Customer` profiles. **Approved Resolution**: Add `Active` / `Deactivated` support to `StatusBadge.jsx`, replace hardcoded status pills, and correct email template defaulting.

---

## 2. Review of Module Documentation

### 2.1 `docs/02_modules/employees/CLAUDE.md`

| Section / Claim | Code Status | Verification Details |
|---|---|---|
| **What it does** ("There is no separate Employees feature; employee-like data is the `users` collection managed in User Management. No HR data exists.") | **Accurate** | Verified. No `employees` collection or standalone HR routes exist in the codebase. Staff records live in `users`. |
| **Code** ("Staff are `users` documents: see `user-management-rbac.md`.") | **Accurate** | Verified. Managed via `AgentDatabase.jsx` and `App.jsx`. |
| **Code** ("`src/utils/logisticsEngine.js` has a hardcoded `DRIVER_DIRECTORY`.") | **Accurate** | Verified. Lines 17–22 of `logisticsEngine.js` declare 4 hardcoded drivers. |
| **Firestore collections** ("`users`, `pendingUsers`, `auditLog`") | **Accurate** | Verified. In addition, `AgentDatabase.jsx` reads `partner_applications` and writes `settings/permissions` indirectly via `PermissionsManager.jsx`. |
| **Triggers & side effects** ("Enrolling creates an Auth account (`api/admin-user.js`), the `users` doc, an `ENROLL` audit entry and an `employee_invite` email.") | **Accurate** | Verified in `AgentDatabase.jsx:L309-354`. |
| **Before you edit** ("Decide whether an Employees module is planned... Roles 'Sales Executive' and 'Fabricator' do not exist; use `Sales` and `Operations`.") | **Accurate** | Canonical roles in `src/constants/roles.js` confirm `Sales` and `Operations`. |

### 2.2 `docs/02_modules/employees/README.md`

| Section / Claim | Code Status | Verification Details |
|---|---|---|
| **Files and Folders** ("There is no separate Employees module... `AgentDatabase.jsx`: enrol users, role / status change, photo, delete, password reset...") | **Accurate** | Confirmed all listed UI capabilities in `AgentDatabase.jsx`. |
| **Files and Folders** ("`src/constants/roles.js`: 10 system roles...") | **Accurate** | Verified: `Admin`, `Manager`, `Sales`, `Operations`, `Support`, `Accounts`, `Logistics`, `Partner`, `Business Client`, `Customer`. |
| **Files and Folders** ("`src/utils/logisticsEngine.js`: `DRIVER_DIRECTORY`, a hardcoded list of 4 named drivers / fabricators...") | **Accurate** | Verified. Also includes `FLEET_VEHICLES` (3 vehicles). |
| **Cloud Functions / triggers** ("All admin actions write to `auditLog`.") | **Partially Inaccurate** | `handleSaveDetails` (updating profile details such as name, contact, company, location, job title, and bio) **omits** `logActivity`. Only `ENROLL`, `DELETE`, `ROLE_CHANGE`, `STATUS_CHANGE`, and `PASSWORD_RESET` write to `auditLog`. |
| **Summary & Open Questions** ("Is an Employees module (HR data) planned, or is `users` intended to be the employee record?") | **Resolved** | Stakeholders approved designing an **HR Data Model** to formalize staff records within the system. |

---

## 3. Cross-Module Triggers Audit (`CROSS_MODULE_TRIGGERS.md`)

### Trigger 7: Registration to Approval to Record Creation
- **Documented Flow**:
  - `7a`: Self-registration writes to `pendingUsers/{email}`.
  - `7b`: Admin approves in User Management (`AgentDatabase.jsx` $\rightarrow$ `approvePending` in `App.jsx`), issuing a `batchWrite` to activate `users/{email}` and delete `pendingUsers/{email}`.
  - `7c` / `7d`: If role is `Partner` or `Business Client`, switches tab to `partners` or `customers` with pre-filled forms; submission sends welcome emails (`partner_approval` / `client_approval`).
- **Audit Findings**:
  - **No Approval Email for Internal Staff**: When an applicant is approved into an internal employee role (`Sales`, `Operations`, `Support`, `Accounts`, `Logistics`), no email notification is dispatched. The user is activated in Firestore but receives no confirmation that their login is enabled.
  - **Restricted Public Registration**: `src/constants/roles.js` restricts `PUBLIC_REGISTRATION_ROLES` strictly to `Partner` and `Business Client`. Internal staff cannot self-register with employee roles; they must be created directly by an Admin via `AgentDatabase.jsx` or assigned an internal role during review.

### Trigger 3 & 6: Partner Commission vs Internal Sales Accruals
- **Documented Flow**: Hand Over or Deal Completion calculates commission for `deal.agentId` against `partners`.
- **Audit Findings**:
  - `deal.agentId` exclusively represents an external referral partner (`partnerId`), not an internal employee.
  - Internal sales employees have no record of deals closed, commissions earned, or revenue targets within the system.

### Trigger 4: Fabrication QA Pass & Inspector Assignment
- **Documented Flow**: 4-point QA pass in `FabricationWorks.jsx` marks job `Completed` and auto-generates a 25% Final invoice.
- **Audit Findings**:
  - The inspector identity recorded in `projects.qaCheck.inspector` defaults to `currentUser?.name || "Lead Inspector"`, but is completely editable text.
  - QA verification is not recorded in `auditLog`, leaving `projects` as the sole record.

---

## 4. Codebase Tracing & Verification Details

### 4.1 Hardcoded Staff & Fleet Directories (`src/utils/logisticsEngine.js`)

```javascript
// src/utils/logisticsEngine.js:17-22
export const DRIVER_DIRECTORY = [
  { name: 'Saman (Master Welder)', phone: '0771234567', role: 'Lead Driver / Fabricator' },
  { name: 'Kamal (Assistant)', phone: '0772345678', role: 'Driver Assistant' },
  { name: 'Sunil (Driver)', phone: '0773456789', role: 'Primary Fleet Driver' },
  { name: 'Nimal (Driver)', phone: '0774567890', role: 'Delivery Associate' },
];
```

#### Defects & Architectural Disconnects:
1. **Isolated from `users` Collection**: None of these 4 drivers exist in Firestore `users`. Roles specified (`Driver Assistant`, `Delivery Associate`, etc.) do not align with `SYSTEM_ROLES`.
2. **Inability to Assign Real Logistics Users**: Enrolling a real employee with role `Logistics` via `AgentDatabase.jsx` does not make them available for delivery assignment. Both `Logistics.jsx` (L935) and `LogisticsCardDetails.jsx` (L600) populate driver dropdowns strictly from `DRIVER_DIRECTORY`.
3. **Hardcoded Form Default**: `Logistics.jsx` (L322) hardcodes `driver: "Sunil (Driver)"` as the initial form state.
4. **Fragile WhatsApp Dispatch Integration**: In `Logistics.jsx` (L216) and `LogisticsCardDetails.jsx` (L127), driver phone numbers are retrieved via:
   ```javascript
   const matchedDriver = DRIVER_DIRECTORY.find(d => d.name === job.driver);
   ```
   If a user enters a driver name not in `DRIVER_DIRECTORY`, `matchedDriver?.phone` evaluates to empty string, omitting driver contact details from the customer dispatch message.
5. **Hardcoded Vehicles**: `FLEET_VEHICLES` (L11-15) is also a static in-memory array (`Lorry`, `Van`, `Motorbike`), preventing dynamic fleet management.

---

### 4.2 Integration Surfaces & RBAC Implementation

#### Surface 1: `src/components/admin/AgentDatabase.jsx`
- **Module Tabs**: Provides tabs for `all` ("All Members"), `employees` ("Internal Team"), and `clients` ("Corporate & Retail Clients"). `Partner` role users are decoupled via `nonPartnerUsers`.
- **Filtering Logic**:
  ```javascript
  if (activeTab === 'employees') return getRoleCategory(u.role) !== 'Clients';
  if (activeTab === 'clients') return u.role === 'Business Client' || u.role === 'Customer';
  ```
  `getRoleCategory` classifies `Admin`, `Manager`, `Sales`, `Support`, `Operations`, `Logistics`, and `Accounts` as non-Clients, placing them under "Internal Team".
- **Enrolling New Members**:
  - Admin inputs `name`, `identifier` (email), `password`, `contactNumber`, `role`, `company`, `specialty`.
  - Creates Auth user via `createUserAccount(emailKey, password, name)`.
  - Writes to `users/{emailKey}` in Firestore.
  - Sends `employee_invite` email via `sendTemplatedEmail`.
- **Missing Employee Attributes**:
  - No Employee ID / Staff Number.
  - No Hire Date / Date Joined.
  - No National Identity Card (NIC) / Passport number.
  - No Emergency Contacts.
  - No Compensation / Salary / Hourly Rate / Bank Details.
  - No Department selector (role is conflated with department).
  - No Leave / Attendance / Shift tracking.

#### Surface 2: `src/context/PermissionsContext.jsx` & `src/constants/roles.js`
- **Module Name Mismatch**: The permissions engine defines the module as `agents`, not `employees`:
  ```javascript
  export const DEFAULT_PERMISSIONS = {
    Admin: { ... agents: full(), ... },
    Manager: { ... agents: read(), ... },
    Sales: { ... agents: none(), ... },
    Operations: { ... agents: none(), ... },
    Support: { ... agents: none(), ... },
    Accounts: { ... agents: none(), ... },
    Logistics: { ... agents: none(), ... },
    ...
  };
  ```
- **Category Mismatch**: In `roles.js`:
  - `ROLE_CATEGORIES.EXTERNAL` includes `['Partner', 'Business Client', 'Customer']`.
  - `getRoleCategory` maps `Partner` $\rightarrow$ `'Partners'`, `Business Client` / `Customer` $\rightarrow$ `'Clients'`, and default $\rightarrow$ `'Employees'`.

#### Surface 3: Security Matrix Asymmetries (`firestore.rules` & `api/admin-user.js`)
- In `AgentDatabase.jsx:L94`:
  ```javascript
  const isAdmin = canAccess(currentUser?.role, 'agents', 'edit');
  ```
- In `firestore.rules`:
  ```javascript
  match /users/{userId} {
    allow read: if isAuthenticated();
    allow create: if isAdmin() || ...;
    allow update: if isAdmin() || ...;
    allow delete: if isAdmin();
  }
  function isAdmin() {
    return hasRole('admin') || hasRole('Admin');
  }
  ```
- In `api/admin-user.js`:
  ```javascript
  if (callerData.role !== 'Admin') {
    return res.status(403).json({ error: 'Only Admins can manage user credentials.' });
  }
  ```
- **Vulnerability / Broken Delegation**: If an Admin uses `PermissionsManager.jsx` to grant `Manager` permission to edit `agents`, the UI renders the controls, but any attempt by the Manager to create a user, delete a user, change a role, or reset a password fails with Firestore permission denied or API 403 Forbidden.

---

### 4.3 Operational Assignment Tracking Across Modules

| Operational Module | Current Assignment Implementation | Linkage to `users` Collection | Status / Defect |
|---|---|---|---|
| **CRM: Leads** | `LeadCardDetails.jsx:L1028` binds `agentId` to `partners` list only when `source === 'Referral'`. | None (links to `partners`). | Cannot assign internal `Sales` staff to leads. |
| **CRM: Deals** | `Deals.jsx:L362` reads `deal.agentId` to accrue commission to `partners`. | None (links to `partners`). | No sales rep ownership or quota tracking. |
| **Operations: Fabrication** | `FabricationWorks.jsx:L1376` & `FabricationCardDetails.jsx:L841` provide a free-text input (`form.assignee`, placeholder `"e.g. Saman / Kamal"`). | None (unvalidated string). | Fabricators cannot be selected from active `Operations` staff; cannot query work by user. |
| **Operations: Inspection** | `FabricationWorks.jsx:L1138` provides an editable text input for `qaForm.inspector`, defaulted to `currentUser?.name`. | Loose (string snapshot). | No role gate for inspector; no audit log entry for QA signoff. |
| **Operations: Logistics** | `Logistics.jsx:L935` & `LogisticsCardDetails.jsx:L600` populate dropdown from `DRIVER_DIRECTORY`. | None (hardcoded array). | `Logistics` users cannot be assigned to deliveries; no driver queue filtering. |

---

### 4.4 User Profile & UI Disconnects (`src/components/common/UserProfile.jsx`)

1. **Dead Jump Link (`roadmap`)**:
   - `UserProfile.jsx:L718`:
     ```javascript
     <button onClick={() => setActiveTab && setActiveTab('roadmap')}>
       <Map size={14} /> Execution Plan
     </button>
     ```
   - `'roadmap'` is not a valid tab in `App.jsx`. Clicking this button leaves the main viewport empty.
2. **Cosmetic Agent ID**:
   - `UserProfile.jsx:L700`:
     ```javascript
     {currentUser?.identifier?.split('@')[0]?.toUpperCase()}
     ```
   - Computes an ID by taking the email prefix (e.g., `saman@ptf.lk` $\rightarrow$ `SAMAN`). This is not a real employee identifier.
3. **Hardcoded Department Fallback**:
   - Displays `currentUser?.role || 'Operations'` under "Assigned Department", conflating RBAC authorization roles with organizational departments.

---

### 4.5 Data Consistency, Status Badges, & Transaction Integrity

1. **Unused & Incompatible `StatusBadge`**:
   - `StatusBadge.jsx` is imported in `AgentDatabase.jsx:L14` but never invoked.
   - `StatusBadge.jsx` does not define matches for `Active` or `Deactivated` user statuses (only `approved`, `pending`, etc.).
   - `AgentDatabase.jsx` uses hardcoded inline Tailwind string interpolations for status pills (L711, L1026).
2. **Non-Atomic Deletion Hazard**:
   - `handleDeleteAgent` in `AgentDatabase.jsx:L194-196`:
     ```javascript
     await deleteDoc(doc(db, "users", deleteId));
     setUsers(prev => prev.filter(u => u.identifier !== deleteId));
     await deleteUserAccount(deleteId);
     ```
   - Deletes the Firestore document first. If `deleteUserAccount` fails (e.g. network issue or API 502), the Auth account remains active while the profile document is gone. Re-enrolling with that email later fails with `auth/email-already-exists`.
3. **Missing Audit Logging on Profile Edit**:
   - `handleSaveDetails` updates `name`, `contactNumber`, `company`, `location`, `jobTitle`, and `bio` in Firestore, but never calls `logActivity`.
4. **Email Modal Template Mismatch**:
   - `AgentDatabase.jsx:L752` defaults to `employee_invite` for any non-Business Client user, including direct retail `Customer` records.

---

## 5. Table of Accepted Decisions & Target Architecture

All recommended decision points were reviewed and explicitly accepted by the user:

| # | Architecture / Design Item | User Decision | Status | Target Architectural Resolution |
|---|---|---|---|---|
| **D1** | **Employees Module vs. Users Collection** | **Design an HR Data Model** | **ACCEPTED** | Extend internal staff documents in `users` with an embedded `hrProfile` object (or structured attributes) containing official `employeeId`, department, NIC, join date, emergency contact, and compensation data. (See Section 6). |
| **D2** | **Driver & Fleet Storage** | **Migrate to Firestore** | **ACCEPTED** | Deprecate static `DRIVER_DIRECTORY` and `FLEET_VEHICLES` in `logisticsEngine.js`. Query drivers dynamically from `users` (`role === 'Logistics' \|\| hrProfile.isDriver === true`), and manage vehicles in a `settings/fleet` or `fleet` Firestore collection. |
| **D3** | **Internal Task Assignment** | **Standardize Across Modules** | **ACCEPTED** | Add real `assignedSalesId` to Leads/Deals (`Sales`), `assignedFabricatorId` to Fabrication (`Operations`), `inspectorId` to QA, and `assignedDriverId` to Logistics, all referencing active `users`. |
| **D4** | **Manager RBAC Delegation** | **Allow Managers & Admins** | **ACCEPTED** | Update both `firestore.rules` (allow update/delete on `/users/{userId}` if `isAdmin()` or `hasRole('Manager') && checkPermission('agents', action)`) and `api/admin-user.js` (allow callers with `role === 'Admin'` OR `role === 'Manager'`). |
| **D5** | **User Deletion Ordering** | **Safe Auth-First Deletion** | **ACCEPTED** | Reorder deletion sequence: call `deleteUserAccount` first; only upon confirmed deletion proceed to `deleteDoc` (or rollback on failure), preventing orphaned Firebase Auth logins. |
| **D6** | **Staff Approval Notifications** | **Email Notifications** | **ACCEPTED** | Send an automated `employee_approved` / `employee_invite` email when an internal staff applicant is approved in User Management. |
| **D7** | **Dead UI Link in `UserProfile.jsx`** | **Remove Button** | **ACCEPTED** | Remove the dead "Execution Plan" (`roadmap`) navigation button from `src/components/common/UserProfile.jsx`. |
| **D8** | **StatusBadge & Template Defaults** | **Standardize Badge & Templates** | **ACCEPTED** | Add `active` and `deactivated` support to `StatusBadge.jsx`, use it in `AgentDatabase.jsx`, and fix `Customer` email defaulting in `AgentDatabase.jsx:L752`. |

---

## 6. HR Data Model Design Specification (Decision D1)

To fulfill **Decision D1**, the following HR data model has been designed for internal staff members. It seamlessly integrates into the existing Firestore `users` collection without breaking authentication or requiring complex multi-collection joins.

### 6.1 Schema Architecture

For all users categorized as Internal Team (`getRoleCategory(role) !== 'Clients' && role !== 'Partner'`), the `users/{email}` document is extended with an `hrProfile` sub-object:

```json
{
  "identifier": "saman.perera@print2frame.xyz",
  "name": "Saman Perera",
  "role": "Operations",
  "status": "Active",
  "isApproved": true,
  "contactNumber": "+94 77 123 4567",
  "company": "Print To Frame Pvt Ltd",
  "location": "Kadawatha Factory Hub",
  "jobTitle": "Lead Welder & Master Fabricator",
  "bio": "Over 12 years of specialized steel fabrication and architectural framing experience.",
  "photoURL": "data:image/jpeg;base64,...",
  "createdAt": "2026-01-15T08:30:00.000Z",

  "hrProfile": {
    "employeeId": "PTF-EMP-0104",
    "nic": "198812345678",
    "department": "Operations & Fabrication",
    "employmentType": "Full-Time",
    "joinDate": "2024-03-01",
    "probationEndDate": null,
    "workShift": "Day (08:00 - 17:00)",
    "skills": [
      "MIG Welding",
      "TIG Welding",
      "Steel Profile Cutting",
      "QA Inspection"
    ],
    "isDriver": true,
    "driverLicense": {
      "licenseNumber": "B1234567",
      "categories": ["Dual Purpose", "Motor Lorry"],
      "expiryDate": "2028-11-30"
    },
    "emergencyContact": {
      "name": "Sunethra Perera",
      "relationship": "Spouse",
      "phone": "+94 71 987 6543",
      "address": "124 Kandy Road, Kadawatha"
    },
    "compensation": {
      "salaryType": "Monthly Salary",
      "baseSalary": 95000,
      "otRatePerHour": 650,
      "bankDetails": {
        "bankName": "Commercial Bank of Ceylon",
        "branch": "Kadawatha",
        "accountNumber": "8001234567",
        "accountHolderName": "S. Perera"
      }
    },
    "notes": "Certified Master Welder grade 1."
  }
}
```

### 6.2 Key Fields & Validation Rules

| Field | Type | Required | Description & Validation |
|---|---|---|---|
| `hrProfile.employeeId` | `string` | **Yes** | Unique sequential identifier generated via atomic counter: `PTF-EMP-####` (e.g. `PTF-EMP-0101`). Immutable after creation. |
| `hrProfile.nic` | `string` | **Yes** | Sri Lankan National Identity Card (10-character legacy `901234567V` or 12-digit modern `199012345678`). |
| `hrProfile.department` | `string` | **Yes** | Selected from canonical departments: `Executive`, `Front-Office & Sales`, `Operations & Fabrication`, `Logistics & Fleet`, `Finance & Accounts`, `Customer Support`. |
| `hrProfile.employmentType` | `string` | **Yes** | `'Full-Time'` \| `'Part-Time'` \| `'Contract'` \| `'Probationary'`. |
| `hrProfile.joinDate` | `string` | **Yes** | ISO date string (`YYYY-MM-DD`). |
| `hrProfile.isDriver` | `boolean` | Optional | Flag indicating authorization for fleet vehicle operation. Required to appear in Logistics dispatch selector. |
| `hrProfile.driverLicense` | `object` | Conditional | Required if `isDriver === true`. Contains license number, vehicle classes, and expiration date. |
| `hrProfile.emergencyContact`| `object` | **Yes** | Contact name, relationship, Sri Lankan mobile number, and address. |
| `hrProfile.compensation` | `object` | Admin/Manager | Sensitive financial details: salary type, base pay, OT rate, and banking details. |

### 6.3 Security & Field-Level Access Control

1. **Compensation Privacy**: In `firestore.rules`, sensitive financial data in `hrProfile.compensation` must be readable and writable only by `Admin` and `Manager` (or the specific employee for their own banking details).
2. **Self-Service Restrictions**: Regular employees editing their profile via `UserProfile.jsx` can update `emergencyContact`, `bio`, and `photoURL`, but cannot modify `employeeId`, `role`, `department`, `employmentType`, `joinDate`, or `compensation`.
3. **Audit Trail**: Every update to `hrProfile` must trigger a structured `logActivity` entry (`HR_PROFILE_UPDATE`).

---

## 7. Actionable Execution Plan

With all recommendations formally approved, the implementation phase will execute the following steps in order:

### Phase 1: Security & Backend Delegation (Decision D4, D5)
1. **Update `api/admin-user.js`**: Expand access check from `callerData.role === 'Admin'` to allow callers who are `Admin` OR have `callerData.role === 'Manager'`.
2. **Update `firestore.rules`**: Allow `/users/{userId}` create, update, and delete for authenticated users who are `isAdmin()` OR `hasRole('Manager') && checkPermission('agents', 'edit')`.
3. **Atomicity & Order of Deletion**: In `AgentDatabase.jsx`, call `deleteUserAccount(deleteId)` first, followed by Firestore document deletion.

### Phase 2: HR Data Model Implementation (Decision D1, D6, D8)
1. **Extend `AgentDatabase.jsx`**: Add HR form fields (Employee ID generator, Department, NIC, Join Date, Emergency Contact, Compensation) in a new "HR Profile" tab or collapsible panel.
2. **Update `UserProfile.jsx`**:
   - Display real `currentUser?.hrProfile?.employeeId` instead of cosmetic email prefix.
   - Display real `currentUser?.hrProfile?.department`.
   - Remove dead "Execution Plan" button (Decision D7).
3. **Standardize `StatusBadge.jsx`**: Add `'active'` and `'deactivated'` color mapping tokens, replace inline pills in `AgentDatabase.jsx`, and correct template defaults for retail customers.

### Phase 3: Logistics & Fleet Dynamic Migration (Decision D2)
1. **Create `settings/fleet` Collection**: Move `FLEET_VEHICLES` into Firestore with an admin vehicle manager.
2. **Dynamic Driver Selector**: Update `Logistics.jsx` and `LogisticsCardDetails.jsx` to query active users where `role === 'Logistics'` or `hrProfile.isDriver === true`.
3. **Dynamic WhatsApp Dispatch**: Read driver phone number directly from the selected user's profile.

### Phase 4: Operational Task Assignment Integration (Decision D3)
1. **Leads / Deals**: Introduce `assignedSalesId` linking to active `Sales` users.
2. **Fabrication**: Replace free-text `form.assignee` with a dropdown of active `Operations` staff.
3. **QA Inspection**: Formalize inspector assignment and log QA pass/fail events to `auditLog`.
