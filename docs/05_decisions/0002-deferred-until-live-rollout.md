# 0002: Work deferred until the live site is ready to change

Status: accepted 2026-09-20 (owner). The rule for now: repo work on `staging` that cannot affect the live site goes ahead; anything that changes the live Firestore, its rules, the live matrix, Vercel or Firebase configuration waits until the system has been structured properly (see Part 1, separate environments, in `PLAN.md`). Nothing here has been applied to the live project.

## Live steps written and tested but not applied

Order, when the owner says go: promote `staging` to `main` (PR #25) -> matrix migration (3.3) -> additive rules (3.4d) -> role-by-role check -> restrictive rules (3.5d).

1. **3.3 matrix migration.** The live `settings/permissions` has no `receipts` or `quotations` module for any role (read 2026-09-20, last updated 2026-09-01). Add only those two modules per role from `DEFAULT_PERMISSIONS`; leave every other cell alone. Two ways: an Admin uses the "Add missing modules with defaults" button in Permissions Manager (needs PR #25 live) and clicks Save, or an owner-credentialed Firestore update with an `updateMask` limited to `<Role>.receipts` and `<Role>.quotations` and a precondition on the document's `updateTime`. An attempt by Claude to do the second was blocked by the session's safety classifier as a change to a shared resource; it needs the owner to allow it or to run it. A backup of the read document is a good first step. Saving from the Permissions Manager also forces System Overview to Admin only, so Manager loses it (owner decision).
2. **3.4d additive rules.** Verified 2026-09-20: the deployed ruleset matches `main`'s old `firestore.rules`, and the live `counters` documents (`INV-ADV`, `INV-FIN`) hold only an integer `value`, so the new counters rule accepts them. Deploy the version of the file at the 3.4 commit (`claude/p3-4-rules-additive`), not the current `staging` file, because that one also contains 3.5. Command from a checkout of that version: `firebase deploy --only firestore:rules --project print-to-frame-erp`. `firebase.json` lists three databases (the default and two `ai-studio-*`); the deploy applies to all of them.
3. **3.5d restrictive rules.** Only after the matrix migration and 3.4d, and after deciding role by role which extra live access to keep. The live matrix differs from the defaults in 58 cells (Support, Operations and Logistics hold much more than the defaults; Customer and Business Client have no invoices, projects or logistics view). See `docs/03_security/RBAC_MODEL.md`.
4. The local Firebase MCP session was pointed at `print-to-frame-erp` as its active project while checking the live state. Always pass `--project` explicitly; never run a bare `firebase deploy`.

## Code work deferred

- **Partner limited to its own `partners` record.** Design already drafted and not committed:
  - Rules: a helper `ownsPartner(partnerId)` (document id equals the caller's email, or the `email` field does); read and create/update by staff only when `!hasRole('Partner')`; a Partner may update only `name, contactPerson, phone, address, bankName, accountNumber, accountName, branchName, photoURL, documents`, never `commissionRate`, `status` or balances.
  - Client: `App.jsx` gives a Partner a `where('email', '==', identifier)` query instead of the whole collection; `Partners.jsx` reads referral claims with `where('partnerEmail', '==', identifier)` for a Partner and, on save, sends only the editable fields above.
  - Risks to check first: partner documents whose `email` differs in case from the login email would stop matching (a rule cannot lowercase a query constraint), and today a Partner can save a changed `commissionRate` through the profile form.
- **B6 RBAC E2E journey** (Admin, Sales, Partner and Customer each see only their nav; the seeded deactivated user cannot sign in) and the **money E2E journey** (quotation to Advance to Final, exactly one `INV-FIN`). Needs `tests/fixtures/seed.mjs` extended with Sales, Customer and Manager users.
- **Partners D-5** (public read of Active partners): held, a partner document holds bank details and rules cannot hide fields. Needs a separate public profile document.
- **Counters can still be lowered** by a signed-in user (a strict "must increase" rule rejects legitimate transactions under contention); closing it means server-side numbering.
- **Part 1, separate environments** (staging Firebase/GCP project, Vercel scopes, fail-closed config): `PLAN.md`.
