# 0004: Owner decisions for the follow-up backlog (DEC-1 to DEC-9)

Status: accepted (DEC-7 partly open), 2026-09-27. Questions and context: `docs/04_workflows/BACKLOG.md`, section "Owner decisions".

## Context

The live Firebase and Vercel data is test data only; no real business work runs on it yet. The owner plans a fresh environment setup (new Firebase/GCP data store, Vercel project), so decisions do not need to preserve or migrate existing live data.

## Decisions

| ID | Decision | Consequence |
|---|---|---|
| DEC-1 | One default partner commission, LKR 38.00 per sq ft, for every case | Replace 30.00 and 53.50 with one exported constant; update the tests that pin the old values |
| DEC-2 | A dispatcher (Manager or Accounts) records cash on delivery | No code, matrix or rules change |
| DEC-3 | Enable Firebase Storage with narrow rules (signed-in write to `blueprints/`, `partners/`) | Write and test Storage rules; the anonymous registration upload needs its own design; deploy with the fresh setup or on sign-off |
| DEC-4 | Block the QA-pass Final invoice and the delivery job for a Cancelled project | Client code, with a clear message |
| DEC-5 | No migration of old manual jobs that carry a value | Old data is discarded with the fresh setup |
| DEC-6 | This repository is canonical | LIVE-3 approved; run it with step-by-step sign-off, then archive the others |
| DEC-7 | Review the live-vs-default matrix cell by cell before changing anything | Table in `docs/03_security/RBAC_MODEL.md`; the fresh environment is seeded from `DEFAULT_PERMISSIONS`, so the review decides the defaults |
| DEC-8 | Drive through Google Picker with `drive.file`; Drive and Contacts connection offered only to super admin accounts for now | Code change in this repository; the old live deployment is not touched |
| DEC-9 | Proprietary, all rights reserved | `LICENSE` added; `package.json` `"license": "UNLICENSED"` |

## Why

Removing the need to protect test data lets the backlog favour the clean design (one constant, no migrations, defaults decided up front) over compatibility work that the fresh setup would throw away.
