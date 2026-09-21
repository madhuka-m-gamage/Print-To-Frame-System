# Live rollout runbook

Status: prepared 2026-09-21. **Nothing in this document has been applied to the live project.** Every live step below needs the owner's explicit go at that moment; approval of the document is not approval of a step. Background and the reasons work was parked: [0002-deferred-until-live-rollout.md](../05_decisions/0002-deferred-until-live-rollout.md).

Live project: `print-to-frame-erp`. Always pass `--project print-to-frame-erp` explicitly; never run a bare `firebase deploy`.

## What was read from the live project (read-only, 2026-09-21)

- **Rules:** the deployed Firestore ruleset is the old one that `main` still has (no `referral_claims` or `partner_payouts` blocks, `quotations` open to any signed-in user, `counters` open to any signed-in user, the bootstrap emails not part of `isAdmin()`).
- **Permission matrix** (`settings/permissions`): last updated 2026-09-01 02:04 UTC, unchanged since the earlier check. Roles present: Accounts, Admin, Business Client, Customer, Logistics, Manager, Operations, Partner, Sales, Support. Modules present per role: admin, agents, calculator, customers, dashboard, invoices, leads, logistics, messages, notifications, partners, pipeline, projects. **There is no `quotations` and no `receipts` module for any role.**
- **Code:** `main` has no commit that `staging` lacks, and `staging` is 108 commits ahead. Pull request #25 (`staging` to `main`) is open, mergeable, 100 commits, 223 files.
- **Confirmed by the owner, 2026-09-21:** the Firebase project is `print-to-frame-erp`, the app uses only the `(default)` Firestore database, and the two `ai-studio-...` databases exist but are not used.
- **Two repositories, no shared history (found 2026-09-21):** the original project folder `Print-To-Frame-ERP-System` is its own git repository (`github.com/madhukagamage6/Print-To-Frame-ERP-System`, branches `main` and `staging`, last commit 2026-09-15). This repository (`madhuka-m-gamage/Print-To-Frame-System`) has a separate history that starts from a copy of that code. Their source code is nearly identical (under `src/`, `api/` and the rules only two files differ, both from the test-suite work), and their `firestore.rules` are identical. **Which one the live Vercel project deploys from is not known**; it cannot be read from here because the live project is in a Vercel account this tooling cannot see. See pre-flight item 0 and step 2.
- **Storage:** the project has **no active Storage rules** (read-only check). The code has three upload paths (`partners/...` documents from the public registration form and from the Partners screen, and `blueprints/...` from fabrication). They are expected to fail against the live project (not tried), and the blueprint upload falls back to keeping files under 500KB inline. This does not affect the rollout below, but see the backlog.
- **`firebase.json`** lists three Firestore databases (`(default)` and two `ai-studio-...` ones); a plain rules deploy applies the same file to all three. The app connects to `(default)`: the committed config says so, the live matrix in `(default)` shows recent activity, and the owner confirmed it.

## Why the order matters

The new client code reads the matrix through `canAccess`, which returns **false for a module a role does not have**. Because the live matrix has no `quotations` or `receipts` module, promoting the new code first would hide the Quotations and Receipts screens and their data from every role except Admin until the matrix is migrated. The matrix change is additive and harmless to the old code, so it goes first.

The new client is compatible with the old, looser live rules: it writes counters `L`, `D`, `PTF`, `QT` and `L-PK` (the old rule allows any counter), and it does not use the new collections yet. So rules can follow the code, not lead it.

## Decisions (settled 2026-09-21) and what is left for the owner

1. **Quiet window: not required for the matrix.** Step 1 only adds keys the old code ignores, so it can be done at any time, days before the promotion, and nothing changes for anyone. After that, step 2 is an ordinary deploy that can be rolled back instantly in Vercel. Promote outside working hours if you prefer, but nothing depends on it. A short quiet moment is only worth having for step 3 (rules).
2. **Matrix path: A, the button on the staging preview.** The Vercel project `print-to-frame-system` has no `VITE_FIREBASE_DATABASE_ID` override, so its preview uses the `(default)` database that the app and the live rules use, and it is already what you sign in to as Admin. The Admin reviews the added cells before saving, so any role's value can be changed at that moment (see the table below).
3. **Role changes: none needed.** The restrictive rules enforce whatever the live matrix says; they do not require any role to lose access. Leave the 58 differing cells alone. Tightening an over-broad role is a business decision that can be taken later, at any time, in Permissions Manager, without code (it is in the `PLAN.md` backlog). The only values step 1 chooses are the new `quotations` and `receipts` ones below.
4. **Environment check: done.** The preview project has no database override (read-only check), and the owner confirmed the app uses `(default)`. The live production Vercel project is not visible to the tooling, so its variables were not read; the owner's confirmation stands in for that.
5. **Still open, not needed to go live:** whether drivers may record cash on delivery (`PLAN.md` backlog).

### What step 1 writes for `quotations` and `receipts` (from `DEFAULT_PERMISSIONS`)

| Role | quotations | receipts |
|---|---|---|
| Admin | full | full |
| Manager | full | full, no delete |
| Sales | full | view, create, edit |
| Support | view | view |
| Accounts | view | view, create, edit, export |
| Operations | none | none |
| Logistics | none | none |
| Partner | none | none |
| Customer | none | none |

Business Client has no explicit entry for either and gets the same as Customer. Two roles worth a look before saving: **Operations**, which today can create and edit leads and so may use quotations from the lead card, and **Logistics**, which today has full access to invoices but would get no receipts. Both start at none because the defaults say so; give them view if their staff need it.

## Pre-flight (do all of it, in order, on the day)

- [ ] **0. Find out what the live site deploys from.** In Vercel, in the account that owns `portal.print2frame.xyz`, open the project, Settings, Git: note the connected repository and the Production Branch. If it is `madhuka-m-gamage/Print-To-Frame-System` and `main`, step 2 works as written. If it is `madhukagamage6/Print-To-Frame-ERP-System`, merging pull request #25 here changes nothing live; follow step 2 option B. Do not go further until this is known.
- [ ] `git fetch` and confirm `main` still has no commit that `staging` lacks: `git rev-list --count origin/staging..origin/main` prints `0`.
- [ ] The latest `staging` commit has a green CI run and a green Vercel preview.
- [ ] On the Vercel preview of `staging`, sign in as Admin and open every sidebar tab: no error, no blank screen. Create a lead, convert it, add a quote, generate an Advance invoice, upload one blueprint, record a delivery status change.
- [ ] Take a **backup of the live matrix**: in the Firebase console open Firestore, `settings/permissions`, and copy the document JSON into a file kept outside the repository; note its `updateTime`. (Or export with `gcloud firestore export` to a bucket you control.) Without this, step 1 has no rollback.
- [x] Keep the deployed rules text. Done 2026-09-21: the owner copied the deployed Firestore rules from the console, and a line-by-line diff against `git show origin/main:firestore.rules` found them identical (240 lines each) apart from trailing whitespace. So the rollback file for the rules steps is `git show origin/main:firestore.rules`. Repeat the comparison on the day if the rules could have been edited in the console since.
- [ ] Tell the team the window and that staff may need to refresh.

## Step 1: matrix migration (additive)

Adds `quotations` and `receipts` to every role from `DEFAULT_PERMISSIONS` and changes nothing else.

**Path A, recommended (no code promotion needed):** the Vercel preview of `staging` runs against the live Firestore. An Admin signs in there, opens Permissions Manager, sees the banner listing the missing modules, clicks **Add missing modules with defaults**, reviews the highlighted cells, and clicks **Save**. Only absent cells are filled; the button never overwrites a saved cell.

**Path B:** an owner-credential write of only those two module keys per role through the console or a one-off script. Same content, more manual.

Verify: re-read `settings/permissions`; each role has `quotations` and `receipts`; every other cell equals the backup (compare the two JSON files).

Rollback: restore the backup document (Admin saves it back, or paste it in the console).

## Step 2: promote `staging` to `main`

**Option A (live project is connected to this repository's `main`):** merge pull request #25 (merge commit, as before). Vercel builds `main` to production. This does not touch Firestore rules.

**Option B (live project is connected to the original repository):** merging #25 here does nothing to the live site. Choose one, with the owner: (1) in the live Vercel project, Settings, Git, disconnect the original repository and connect `madhuka-m-gamage/Print-To-Frame-System` with Production Branch `main`, then merge #25 (recommended; rollback is reconnecting the original repository, or Vercel's Instant Rollback); or (2) bring the same code into the original repository. The two histories are unrelated, so that means replacing its branch contents, which is a force-push-class change and is not recommended. Either way the code is nearly the same, so a preview build of `staging` is a fair rehearsal.

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

A plain deploy applies the same file to all three databases in `firebase.json`. The two `ai-studio-...` databases are confirmed unused, so that is harmless, but if you would rather deploy to `(default)` only, remove those two entries from `firebase.json` first (backlog) or check `firebase deploy --help` for how to limit it, which is not verified here.

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
