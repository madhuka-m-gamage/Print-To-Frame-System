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

Confirmation options per row: Opus·high, Opus·medium, Sonnet·medium, Sonnet·low (Other for anything else).

## Learned
- 2026-10-02: `money-small` added (owner approved). Evidence: MON-8 (rounding helper plus three call sites) ran on Sonnet·low with 0 fix rounds and a correct helper; one data point, so the default is Sonnet·medium, not low. Revisit after another run.
<!-- The review adds lines here only after the owner approves a proposed policy change: date, task type, change, evidence. -->
