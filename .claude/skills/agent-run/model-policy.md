# Model policy

Owner-editable defaults. The planner classifies each item into one task type, starts from this row, and may propose a different pick with a reason. The owner confirms the model and effort of every row on every run.

| Task type | Matches | Model | Effort |
|---|---|---|---|
| security | auth, `firestore.rules`, `storage.rules`, `api/*` access checks | Opus | medium |
| money-small | one pure helper or one rule change on a money path, with a clear test (e.g. a rounding helper and its call sites) | Sonnet | medium |
| money | invoices, receipts, commission, pricing, COD with several decisions or new rules | Opus | medium |
| design-heavy | L items or 4+ separate decisions | Opus | medium |
| tests | tests-only items, coverage refresh | Sonnet | medium |
| small-ui | one module, UI behaviour, no rules | Sonnet | medium |
| config | one-file config or script edits | Sonnet | low |
| final-docs | the run's final docs step | Sonnet | low |
| review | the post-run review (orchestrator) | session model | n/a |

Confirmation options per row: Sonnet·low, Sonnet·medium, Opus·medium, Opus·high, the pick first (Other for anything else).

## Selection signals
The planner counts these for each item and writes them on the card; the task-type default is where it starts, the signals say whether to move.

Toward **Opus or higher effort**:
- touches money, auth, `firestore.rules` or `storage.rules`
- an **unverified claim** in the BACKLOG item (for example "this write always fails") that the agent must check first (plan a verify-first step and say so on the card)
- several decisions still open, or a spec the item does not fully pin down
- weak or no tests around the code it changes
- more than one module or layer, or it changes how CI gates a merge
- hard to undo (stored data rewritten, deploys, anything outside a revert of the merge commit)

Toward **Sonnet or lower effort**:
- a pure helper or a config or docs change
- the spec is fully decided (owner decision already recorded)
- strong existing tests and a clear failing test to write first
- one module, a handful of files
- undone by reverting the merge commit

Fields the BACKLOG section does not give (files, tests, open decisions) are written as `unknown` on the card, and `unknown` counts toward the higher pick.

## Effort levels
Characterisations of what each level changes; to be validated by outcomes (see the evidence log).
- **low**: follows the approved test plan literally; little exploration beyond the named files.
- **medium**: also reads neighbouring code and checks every call site of what it changes.
- **high**: looks for edge cases beyond the test plan and re-verifies its own diff before the PR.

## Evidence by task type
One line per task type that has been run. The review appends here; the policy defaults above change only with the owner's approval.

| Task type | Runs | Picks used | Fix rounds | Findings / rework |
|---|---|---|---|---|
| money-small | 3 (MON-8, MON-9, MON-17) | Sonnet·low (MON-8, MON-9, owner overrides); Sonnet·medium (MON-17) | 0 | MON-8: 1 out-of-scope finding (MON-9); MON-9: per-line rows deliberately untouched (cent drift, MON-10); MON-17: sufficient, 1 catch-up, no rework |
| small-ui | 9 (FEA-12, FEA-13, FEA-14, FEA-16, FEA-17, MON-13, FEA-19, MON-7, FEA-21) | Sonnet·medium (FEA-16 Sonnet·low) | 0 | FEA-13: the claim in BACKLOG proved wrong, fixed by verifying first; FEA-14: the userId link split out as FEA-15 on the owner's decision; FEA-21: sufficient, dropped the phone fallback for invoice fields on its own |
| security | 7 (SEC-12, SEC-7, SEC-8, FEA-15, SEC-13, SEC-14, SEC-15) | Opus·medium (owner overrides of Opus·high; FEA-15 moved up from Sonnet·medium) | 0 (SEC-14: 1, repairing another item's test on staging) | found and fixed gaps the BACKLOG item did not name; SEC-13 found the unverified-email limit (SEC-15) |
| money (M) | 5 (FEA-1, MON-4, MON-11, MON-12, MON-14) | Opus·medium | 0 | MON-4 and MON-11 chose server-enforced guard docs; findings MON-12, MON-13, MON-14, none a defect in scope |
| design-heavy | 1 (FEA-2, L) | Sonnet·medium (owner override of Opus·medium) | 0 | sufficient; skipped seeing its rules tests fail; 38 min, longer than an Opus M item |
| config / docs | 2 (ENG-7, ENG-6) | Sonnet·low | 0 | none |
| feature with rules | 4 (FEA-4, FEA-18, FEA-5, FEA-7) | Sonnet·medium | 0 | none; FEA-18 widened a shared rule first and FEA-5, FEA-7, MON-7 relied on it without conflict |

## Learned
- 2026-10-02: `money-small` added (owner approved). Evidence: MON-8 (rounding helper plus three call sites) ran on Sonnet·low with 0 fix rounds and a correct helper; one data point, so the default is Sonnet·medium, not low. Revisit after another run.
- 2026-10-03: `security` and `money` defaults lowered from Opus·high to Opus·medium (owner approved, B3 proposal P4). Evidence: six security items (SEC-12, SEC-7, SEC-8, FEA-15, SEC-13, SEC-14) and three money items (FEA-1, MON-4, MON-11) ran on Opus·medium, all sufficient with 0 fix rounds of their own. Opus·high stays available per row.
<!-- The review adds lines here only after the owner approves a proposed policy change: date, task type, change, evidence. -->
