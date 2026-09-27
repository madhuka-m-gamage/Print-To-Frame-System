# Milestone 1 handoff: audit to remediation

> **Date:** 2026-09-27 · **Tag:** `v1.0.0` · **Branches:** `main` = `staging`
> **Read with:** [PLAN.md](../PLAN.md) (tracker and roadmap), [BACKLOG.md](04_workflows/BACKLOG.md) (every open item in detail), [CHANGELOG.md](../CHANGELOG.md) (what changed and when)

## What this project is

Print To Frame ERP is a single-page React + Vite ERP/CRM for a Sri Lankan custom-framing business: leads → deals → fabrication → logistics → invoicing, plus a partner referral network. Firebase (Auth, Firestore, Storage) is the only backend, and a few Vercel functions in `api/` handle email, AI and admin user actions.

## The journey

| When | What | PRs |
|---|---|---|
| 2026-09-20 | Investigation phases 1–6: architecture, GCP inventory, 16 module maps and per-module `CLAUDE.md`, cross-module triggers, security and workflow docs. The 16-module review was done in Google Antigravity; its original handoff is in git history before this commit | #1–#3 |
| 2026-09-20 | Test suite: unit, API, component, Firestore rules on the emulator, Playwright smoke, GitHub Actions CI | #4, #5 |
| 2026-09-20/21 | Phase 7 remediation (security wins, duplicate Final guard, Completed locks, COD, pricing, receipts, RBAC prerequisites, admin API, Google scopes, user lifecycle, leads, atomic ids, customers, deals/fabrication/inspection, referral lineage) and 8.2 source restructure into `src/features`, `src/shared` | #6–#57 |
| 2026-09-21 | Project folder moved up to the repo root | #58 |
| 2026-09-25 | Follow-up backlog written as one shared work list | #59 |
| 2026-09-27 | Owner decisions DEC-1..9 answered and implemented; Storage bucket created and rules deployed live; promotions to `main` | #60–#71 |

## Live vs repo

| Area | Live today | In this repo |
|---|---|---|
| Site code | `portal.print2frame.xyz` still deploys the **old** repo `madhukagamage6/Print-To-Frame-ERP-System` | `main` deploys to Vercel project `print-to-frame-system`; production moves here with LIVE-3 |
| Firestore rules | Old ruleset | 3.4 (additive) and 3.5 (restrictive) written and tested, **not deployed** |
| Storage rules | `storage.rules` live since 2026-09-27 (bucket `asia-south1`) | Same file |
| Permission matrix | Live `settings/permissions` differs from defaults in 57 cells | DEC-7: use `DEFAULT_PERMISSIONS`; applied when the fresh environment is set up (LIVE-2) |
| Google APIs | Picker and Cloud Storage for Firebase APIs enabled; the browser key allows Picker | Drive via Google Picker (`drive.file`), Drive and Contacts for the super admin only |

Live data is test data only; the owner plans a fresh Firebase/Vercel environment (DEC-5).

## How we work

One item per fresh session: branch `claude/<topic>` from `staging` → tests first (seen failing) → change → `npm run lint`, `npm run test:all`, `npm run build` (+ `npm run test:e2e` when visible) → docs, module `CLAUDE.md` and `CHANGELOG.md` in the same PR → PR into `staging` → promote to `main` by PR with a merge commit when the owner says so.

- A question only the owner can answer becomes a `DEC-n` item in `BACKLOG.md`; the answer is recorded there, in `PLAN.md`, `CHANGELOG.md` and an ADR in [docs/05_decisions/](05_decisions/).
- Live changes (rules deploys, `settings/permissions`, Vercel or Firebase configuration, deleting data) need the owner's explicit go each time; an earlier approval never carries over.
- A fresh session per item keeps the conversation small: everything a new session needs is in `PLAN.md`, `BACKLOG.md`, `CLAUDE.md` and the module docs.
- Details: [GIT_WORKFLOW.md](04_workflows/GIT_WORKFLOW.md), [TESTING.md](04_workflows/TESTING.md), [DEPLOY_PROCESS.md](04_workflows/DEPLOY_PROCESS.md), [LIVE_ROLLOUT.md](04_workflows/LIVE_ROLLOUT.md).

## Gotchas

- **Squash promotion:** a squash merge of `staging` into `main` makes the next promotion conflict. If the squash tree equals a `staging` commit, run `git merge -s ours origin/main` on a branch and PR it into `staging` (done in #68). Promote with merge commits.
- **Storage deploy:** `firebase deploy --only storage --non-interactive` skips the prompt that lets Storage rules read Firestore; the Storage service agent needs `roles/firebaserules.firestoreServiceAgent` (granted 2026-09-27).
- **Slow Google downloads:** `storage.googleapis.com` is slow from this network (about 130 KB/s); the emulator jars are cached in `~/.cache/firebase/emulators`.
- **Shared template file:** `src/constants/emailTemplates.js` is also loaded by `api/send-email.js` in plain Node, so it imports `quotePricing.js` by relative path (lint exception in `eslint.config.js`).
- **Rules are never deployed by pushing:** `firestore.rules` and `storage.rules` go live only through `firebase deploy ... --project print-to-frame-erp`.

## What's left

- **Wave A, repo only, no live impact:** MON-1, MON-3, MON-2, SEC-1, SEC-2, SEC-3, SEC-9, TST-1, TST-3, FEA-3, FEA-8, FEA-6, FEA-11, ENG-4, ENG-5
- **Wave B, code + rules built and tested here, live with the next rules deploy:** MON-4, MON-5, MON-7, FEA-1, FEA-2, FEA-4, FEA-5, FEA-7, FEA-9, FEA-10, SEC-6, SEC-7, SEC-8
- **Wave C, before restrictive rules go live:** TST-2 (money and RBAC browser journeys)
- **Wave D, environment and go-live (owner sittings):** LIVE-2 fresh environment (seed `DEFAULT_PERMISSIONS`, deploy Firestore + Storage rules), LIVE-3 move production here and archive the old repos, LIVE-1, LIVE-4, SEC-4, SEC-5, SEC-10, TST-4
- **Wave E, code health after tests exist:** ENG-1, ENG-2, ENG-6

## Start here next session

Read [PLAN.md](../PLAN.md), take the first unchecked Wave A item (MON-1: deal completion must wait for its Final invoice), and open its entry in [BACKLOG.md](04_workflows/BACKLOG.md).
