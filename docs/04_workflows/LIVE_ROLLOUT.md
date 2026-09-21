# Live rollout runbook

Status: prepared 2026-09-21. **Nothing in this document has been applied to the live project.** Every live step below needs the owner's explicit go at that moment; approval of the document is not approval of a step. Background and the reasons work was parked: [0002-deferred-until-live-rollout.md](../05_decisions/0002-deferred-until-live-rollout.md).

Live project: `print-to-frame-erp`. Always pass `--project print-to-frame-erp` explicitly; never run a bare `firebase deploy`.

## What was read from the live project (read-only, 2026-09-21)

- **Rules:** the deployed Firestore ruleset is the old one that `main` still has (no `referral_claims` or `partner_payouts` blocks, `quotations` open to any signed-in user, `counters` open to any signed-in user, the bootstrap emails not part of `isAdmin()`).
- **Permission matrix** (`settings/permissions`): last updated 2026-09-01 02:04 UTC, unchanged since the earlier check. Roles present: Accounts, Admin, Business Client, Customer, Logistics, Manager, Operations, Partner, Sales, Support. Modules present per role: admin, agents, calculator, customers, dashboard, invoices, leads, logistics, messages, notifications, partners, pipeline, projects. **There is no `quotations` and no `receipts` module for any role.**
- **Code:** `main` has no commit that `staging` lacks, and `staging` is 108 commits ahead. Pull request #25 (`staging` to `main`) is open, mergeable, 100 commits, 223 files.
- **`firebase.json`** lists three Firestore databases (`(default)` and two `ai-studio-...` ones); a plain rules deploy applies the same file to all three. The app connects to `(default)`: the committed config says so and the live matrix in `(default)` shows recent activity. If `VITE_FIREBASE_DATABASE_ID` is set to something else in the Vercel Production environment, that would change, and that cannot be seen from the repository: check it in Vercel before step 3.

## Why the order matters

The new client code reads the matrix through `canAccess`, which returns **false for a module a role does not have**. Because the live matrix has no `quotations` or `receipts` module, promoting the new code first would hide the Quotations and Receipts screens and their data from every role except Admin until the matrix is migrated. The matrix change is additive and harmless to the old code, so it goes first.

The new client is compatible with the old, looser live rules: it writes counters `L`, `D`, `PTF`, `QT` and `L-PK` (the old rule allows any counter), and it does not use the new collections yet. So rules can follow the code, not lead it.

## Decisions needed before go

1. **A quiet window** for steps 1 and 2 (they are minutes apart; roles briefly differ if step 2 runs first).
2. **How to write the matrix (step 1):** path A, recommended, below; or path B.
3. **What the restrictive rules (step 5) should keep or take away** per role. The live matrix differs from the defaults in 58 cells (Support, Operations and Logistics hold far more than the defaults; Customer and Business Client have no invoices, projects or logistics view). Decide role by role in [RBAC_MODEL.md](../03_security/RBAC_MODEL.md) before step 5. Step 5 may be left for later.
4. **Whether drivers may record cash on delivery** (needs `invoices` edit and `receipts` create for the Logistics role; see the `PLAN.md` backlog). Not needed to go live.

## Pre-flight (do all of it, in order, on the day)

- [ ] `git fetch` and confirm `main` still has no commit that `staging` lacks: `git rev-list --count origin/staging..origin/main` prints `0`.
- [ ] The latest `staging` commit has a green CI run and a green Vercel preview.
- [ ] On the Vercel preview of `staging`, sign in as Admin and open every sidebar tab: no error, no blank screen. Create a lead, convert it, add a quote, generate an Advance invoice, upload one blueprint, record a delivery status change.
- [ ] Take a **backup of the live matrix**: in the Firebase console open Firestore, `settings/permissions`, and copy the document JSON into a file kept outside the repository; note its `updateTime`. (Or export with `gcloud firestore export` to a bucket you control.) Without this, step 1 has no rollback.
- [ ] Keep the deployed rules text: in the Firebase console open Firestore, Rules, and copy the whole text to a file outside the repository. `git show origin/main:firestore.rules` should be equal to it (it matched on every point checked on 2026-09-21, but it was compared by reading, not by a byte diff, so compare before relying on it for rollback).
- [ ] Tell the team the window and that staff may need to refresh.

## Step 1: matrix migration (additive)

Adds `quotations` and `receipts` to every role from `DEFAULT_PERMISSIONS` and changes nothing else.

**Path A, recommended (no code promotion needed):** the Vercel preview of `staging` runs against the live Firestore. An Admin signs in there, opens Permissions Manager, sees the banner listing the missing modules, clicks **Add missing modules with defaults**, reviews the highlighted cells, and clicks **Save**. Only absent cells are filled; the button never overwrites a saved cell.

**Path B:** an owner-credential write of only those two module keys per role through the console or a one-off script. Same content, more manual.

Verify: re-read `settings/permissions`; each role has `quotations` and `receipts`; every other cell equals the backup (compare the two JSON files).

Rollback: restore the backup document (Admin saves it back, or paste it in the console).

## Step 2: promote `staging` to `main`

Merge pull request #25 (merge commit, as before). Vercel builds `main` to production. This does not touch Firestore rules.

Verify on `portal.print2frame.xyz`: sign in as Admin, Sales, Partner and Customer and confirm each sees the right navigation and that Quotations and Receipts appear for the roles that had access to invoices. Watch the browser console for permission errors.

Rollback: in Vercel, promote the previous production deployment (Instant Rollback). Do not force-push `main`.

## Step 3: additive rules (3.4d)

Deploy the file at commit `1776444` on branch `claude/rules-3-4d-deploy`. It is the 3.4 rules plus one line that allows the lead and deal id counters (`L`, `D`) which arrived later; **do not deploy the current `staging` file, and do not deploy the bare 3.4 commit** (`9690e87`), which would reject every new lead and deal id. The branch's rules tests pass (47 passed, and the counter test is shown to fail without the change).

```bash
git fetch origin claude/rules-3-4d-deploy
git checkout -b deploy-rules-3-4d origin/claude/rules-3-4d-deploy
npm run test:rules                      # must pass
firebase deploy --only firestore:rules --project print-to-frame-erp
```

Confirm before running that a deploy applying the same file to all three databases is acceptable, or limit it to `(default)`; check `firebase deploy --help` for how, since that is not verified here. Nothing in the code reads the two `ai-studio-...` databases (see the backlog).

Verify: repeat the role checks below. Also confirm a signed-in user can still create a lead and a deal (the counter documents `L` and `D` are created on first use) and that quotations and invoices still save.

Rollback: redeploy the old ruleset (`git show origin/main:firestore.rules > firestore.rules` on a scratch branch, then the same deploy command).

## Step 4: role-by-role check (after step 3)

| Role | Check |
|---|---|
| Admin | every tab loads; Permissions Manager saves |
| Manager | Users screen works (non-Admin accounts only); no System Overview |
| Sales | leads, quotations and invoices load and save; no Users screen |
| Operations | fabrication and logistics load and save |
| Partner | dashboard, notifications, partners and profile only |
| Customer | dashboard, messages, notifications only |
| Deactivated user | cannot sign in; an active session is signed out |

## Step 5: restrictive rules (3.5d), separate and later

Only after steps 1 to 4 are stable, the decisions above are made, and the RBAC journey test (B6) exists or a manual role check is agreed. The file is the current `staging` `firestore.rules`. It requires an active account for every permission, ties quotations and messages to their permissions and participants, and lets Managers administer non-Admin users. It is far stricter than what is live, so run step 4 again afterwards and be ready to roll back by redeploying the step 3 file.

## After the rollout

- Record the date and what was applied in `CHANGELOG.md` and tick 3.3, 3.4d (and 3.5d) in `PLAN.md`.
- Payouts (Phase 7 step 4) need step 3 live first.
- The separate-environments plan (Part 1 in `PLAN.md`) is what removes this class of risk: rules and the matrix would be proven on a staging project first.
