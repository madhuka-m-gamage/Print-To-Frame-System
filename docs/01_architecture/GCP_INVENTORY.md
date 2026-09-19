# GCP Inventory

> Cloud automation: what exists as code in the repo vs what exists only in the GCP console. Project: `print-to-frame-erp`. Console side queried read-only with `firebase` / `gcloud` as `madhukagamage6@gmail.com` on 2026-09-20. No APIs were enabled and nothing was changed.

## Result in one line

There are **no Cloud Functions, Eventarc triggers, Scheduler jobs or Pub/Sub topics** in the repo or in the project. All automation lives in the client (`src/`) and in three Vercel serverless endpoints (`api/`).

## Automation defined in the repo

| Item | Location | Trigger type |
|---|---|---|
| `admin-user` | `api/admin-user.js` | HTTPS (Vercel serverless), create / reset password / delete Auth users |
| `generate` | `api/generate.js` | HTTPS (Vercel serverless), Gemini proxy |
| `send-email` | `api/send-email.js` | HTTPS (Vercel serverless), email sending |
| Local dev proxy for the above | `vite.config.js` (`apiProxyPlugin`) | Vite dev middleware only |

Searches for `onDocumentCreated/Updated/Written`, `onCall`, `onRequest`, `onSchedule`, `functions.firestore` and `pubsub` across `api/`, `src/`, `scripts/` and `server.archive.js` returned no matches.

Repo-side files checked:

| File / folder | Present |
|---|---|
| `firebase.json` | Yes: Hosting (`dist`), Firestore rules for 3 databases, emulators (auth 9099, firestore 8080, ui 4000). No `functions` block. |
| `.firebaserc` | No |
| `functions/` | Only an empty placeholder (`.gitkeep`) created for the target structure |
| Terraform / Pulumi / CDK / Serverless config | None found |
| `firestore.rules` | Yes |
| `firestore.indexes.json` | No |

Firestore databases named in `firebase.json`: `(default)`, `ai-studio-printtoframeerp-66900443-b6c9-4743-892c-f50b58bf8595`, `ai-studio-printtoframe-66900443-b6c9-4743-892c-f50b58bf8595`. All three point at the same `firestore.rules`.

## Automation found only in the console

None found among the services that could be queried.

| Check | Result |
|---|---|
| `firebase functions:list` | Failed: "Failed to list functions" (Cloud Functions API is disabled on the project, see below) |
| `gcloud functions list` | Cloud Functions API (`cloudfunctions.googleapis.com`) is **not enabled**, so no functions can exist |
| `gcloud eventarc triggers list` | Eventarc API is **not enabled**, so no triggers can exist |
| `gcloud pubsub topics list` | API enabled, **0 topics** |
| `gcloud scheduler jobs list` | Needs a `--location`; but Cloud Scheduler API (`cloudscheduler.googleapis.com`) is **not in the enabled-services list**, so no jobs can exist |

Also not enabled: Cloud Run (`run.googleapis.com`) and Cloud Build, which Gen 2 functions and Firebase extensions depend on.

## Comparison (code vs console)

Code and console agree: no server-side event automation exists on GCP. Every "automatic" behaviour in the app (for example filling fields after AI analysis, converting a deal, invoice/receipt linkage) must therefore be implemented either in the browser (`src/App.jsx`, `src/components/**`, `src/services/**`) or in a Vercel endpoint, not in a Firestore trigger. This affects Phase 4: the chains named in [CROSS_MODULE_TRIGGERS.md](CROSS_MODULE_TRIGGERS.md) will be traced through client code, and any that do not exist in code will be reported as not found.

## Other enabled services worth knowing

Enabled on the project and relevant to the app: Firestore, Firebase Auth (`identitytoolkit`), Firebase Hosting, Firebase Rules, FCM, App Check, Remote Config, Pub/Sub (empty), Drive, People, Picker, Docs, Sheets, Forms, Generative Language (Gemini), Cloud Storage. Many others (BigQuery, Dataproc, Dataflow, Composer, Spanner, AlloyDB, Cloud SQL, App Engine, Compute) are enabled too; whether anything is running in them has **not** been checked, and nothing in the repo uses them.

## Unverified / open questions

- Whether the two `ai-studio-*` Firestore databases are still used or are leftovers from AI Studio.
- Whether anything runs in App Engine, Compute or BigQuery (enabled, unchecked, no repo references).
- Vercel-side configuration (env vars, cron jobs in the Vercel dashboard) cannot be seen from the repo or GCP; `vercel.json` defines rewrites only, no crons.
