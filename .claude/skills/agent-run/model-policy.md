# Model policy

Owner-editable defaults. The planner classifies each item into one task type, starts from this row, and may propose a different pick with a reason. The owner confirms the model and effort of every row on every run.

| Task type | Matches | Model | Effort |
|---|---|---|---|
| security | auth, `firestore.rules`, `storage.rules`, `api/*` access checks | Opus | high |
| money-small | one pure helper or one rule change on a money path, with a clear test (e.g. a rounding helper and its call sites) | Sonnet | medium |
| money | invoices, receipts, commission, pricing, COD with several decisions or new rules | Opus | high |
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
| money-small | 2 (MON-8, MON-9) | Sonnet·low both (owner overrides of the Sonnet·medium default) | 0 | MON-8: 1 out-of-scope finding (MON-9); MON-9: per-line rows deliberately untouched (cent drift, MON-10), no rework |
| small-ui | 3 (FEA-12, FEA-13, FEA-14) | Sonnet·medium | 0 | FEA-13: the claim in BACKLOG proved wrong, fixed by verifying first; FEA-14: the userId link split out as FEA-15 on the owner's decision |
| config | 1 (ENG-7) | Sonnet·low | 0 | none |

## Learned
- 2026-10-02: `money-small` added (owner approved). Evidence: MON-8 (rounding helper plus three call sites) ran on Sonnet·low with 0 fix rounds and a correct helper; one data point, so the default is Sonnet·medium, not low. Revisit after another run.
<!-- The review adds lines here only after the owner approves a proposed policy change: date, task type, change, evidence. -->
