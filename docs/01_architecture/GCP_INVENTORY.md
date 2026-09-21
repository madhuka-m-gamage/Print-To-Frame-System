# GCP Inventory

> Cloud automation: what exists as code in the repo vs what exists only in the GCP console.
> Project: `print-to-frame-erp` | Active Account: `madhukagamage6@gmail.com`
> Verified: 2026-09-20 via read-only `gcloud` and `firebase` CLI queries in isolated worktree `architecture-mapping`.

## Result in one line

There are **zero Cloud Functions, Eventarc triggers, Scheduler jobs, or Pub/Sub topics** deployed in GCP, and **zero Cloud Functions or IaC configurations** defined in the repository. All application logic and workflow automation are executed either client-side in the browser (`src/`) or through Vercel serverless endpoints (`api/`).

---

## 1. Repository Audit (Codebase Automation)

### Files & Configurations Checked

| Target | Status / Details |
|---|---|
| `firebase.json` | **Present**. Configures Hosting (`dist`), Firestore rules for 3 databases (`(default)`, `ai-studio-printtoframeerp-66900443-b6c9-4743-892c-f50b58bf8595`, and `ai-studio-printtoframe-66900443-b6c9-4743-892c-f50b58bf8595`), and Local Emulators (Auth `9099`, Firestore `8080`, UI `4000`). **No `functions` stanza exists**. |
| `.firebaserc` | **Not Present**. Project mapping is handled via runtime configs (`firebase-applet-config.json`) and CLI flags. |
| `functions/` folder | **Not present**. It was an empty placeholder (only `.gitkeep`) and was removed in Phase 7 8.2. |
| Functions in the repo | **0 functions**. No background functions, HTTP callables, or event triggers exist. |
| Infrastructure-as-Code (IaC) | **None**. Searched for Terraform (`*.tf`), Pulumi (`Pulumi.yaml`), Serverless Framework (`serverless.yml`), AWS CDK / CloudFormation, Docker, and Kubernetes manifests — none exist. |
| `firestore.rules` | **Present** (241 lines, ~13KB). Defines security rules, role checks (`isAdmin`, `hasRole`), super-admin guards, and collection-level permission checking across Firestore collections. |

### Endpoints Defined in `api/` (Vercel Serverless Functions)

While not GCP Cloud Functions, three serverless HTTPS endpoints are hosted on Vercel:

| Endpoint | File | Trigger / Method | Purpose |
|---|---|---|---|
| `admin-user` | `api/admin-user.js` | HTTPS POST | Server-side Firebase Auth user management (create, reset password, delete). Requires Admin authentication. |
| `generate` | `api/generate.js` | HTTPS POST | Gemini AI proxy endpoint with failover candidates and origin restrictions. |
| `send-email` | `api/send-email.js` | HTTPS POST | Transactional email dispatcher using SMTP / Resend. |
| Dev Proxy | `vite.config.js` (`apiProxyPlugin`) | Local Vite middleware | Local development emulation of the `api/*.js` routes. |

A comprehensive search across `api/` and `src/` for trigger hooks (`onDocumentCreated`, `onDocumentUpdated`, `onDocumentWritten`, `onCall`, `onRequest`, `onSchedule`, `functions.firestore`, `pubsub`) confirms that no Cloud Function triggers exist anywhere in the code.

---

## 2. GCP Live Project Audit (Console / Deployed Resources)

Queried against project `print-to-frame-erp` using `gcloud` and `firebase` CLI as authenticated user `madhukagamage6@gmail.com`:

| Resource Type | Command Executed | Result | Status |
|---|---|---|---|
| **Cloud Functions** | `firebase functions:list --project print-to-frame-erp`<br>`gcloud functions list --project print-to-frame-erp --quiet` | `cloudfunctions.googleapis.com` is **SERVICE_DISABLED** | **0 deployed** |
| **Cloud Pub/Sub** | `gcloud pubsub topics list --project print-to-frame-erp --quiet` | Listed 0 items (`pubsub.googleapis.com` enabled) | **0 topics** |
| **Cloud Scheduler** | `gcloud scheduler jobs list --project print-to-frame-erp --location=- --quiet` | `cloudscheduler.googleapis.com` is **SERVICE_DISABLED** | **0 jobs** |
| **Eventarc Triggers** | `gcloud eventarc triggers list --project print-to-frame-erp --location=- --quiet` | `eventarc.googleapis.com` is **SERVICE_DISABLED** | **0 triggers** |

*(Note: Cloud Run `run.googleapis.com` and Cloud Build `cloudbuild.googleapis.com` are also not enabled on the project).*

---

## 3. Comparison: Code vs GCP Deployed Automation

| Automation Category | Defined in Repo | Deployed in GCP Console | Automation Existing Only in GCP |
|---|---|---|---|
| **Cloud Functions** | None (no `functions/` folder) | None (`cloudfunctions` API disabled) | **None** |
| **Pub/Sub Topics** | None | None (0 topics) | **None** |
| **Scheduler Jobs** | None | None (`cloudscheduler` API disabled) | **None** |
| **Eventarc Triggers** | None | None (`eventarc` API disabled) | **None** |
| **Infrastructure-as-Code** | None | None | **None** |
| **Vercel Serverless API** | 3 endpoints (`api/*.js`) | N/A (hosted on Vercel) | **None** |

### Which automation exists only in GCP with no matching code here?

**Answer: None.** 

There are no orphan resources, dangling triggers, or unmanaged cloud automation jobs in GCP. Every single automated action, status progression (e.g., Lead → Deal → Fabrication → Logistics → Invoice), and calculation is driven by client-side event handlers in React (`src/`) interacting with Firestore directly under `firestore.rules`, supplemented by the three serverless routes under `api/` deployed to Vercel.

---

## 4. Relevant Enabled Services on `print-to-frame-erp`

For reference, the following relevant APIs are enabled and active on the GCP project:
- **Core Firebase / App**: `firestore.googleapis.com`, `identitytoolkit.googleapis.com` (Auth), `firebasehosting.googleapis.com`, `firebaserules.googleapis.com`, `firebaseremoteconfig.googleapis.com`, `fcm.googleapis.com` (Cloud Messaging), `firebaseappcheck.googleapis.com`.
- **AI & Integrations**: `generativelanguage.googleapis.com` (Gemini API), `drive.googleapis.com`, `docs.googleapis.com`, `sheets.googleapis.com`, `forms.googleapis.com`, `people.googleapis.com`, `picker.googleapis.com`.
- **Storage**: `storage-component.googleapis.com`, `storage.googleapis.com`.
- **Pub/Sub**: `pubsub.googleapis.com` (enabled, but contains 0 topics).
