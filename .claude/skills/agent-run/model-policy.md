# Model policy

Owner-editable defaults. The planner classifies each item into one task type, starts from this row, and may propose a different pick with a reason. The owner confirms the model and effort of every row on every run.

| Task type | Matches | Model | Effort |
|---|---|---|---|
| security | auth, `firestore.rules`, `storage.rules`, `api/*` access checks | Opus | high |
| money | invoices, receipts, commission, pricing, COD | Opus | high |
| design-heavy | L items or 4+ separate decisions | Opus | medium |
| tests | tests-only items, coverage refresh | Sonnet | medium |
| small-ui | one module, UI behaviour, no rules | Sonnet | medium |
| config | one-file config or script edits | Sonnet | low |
| final-docs | the run's final docs step | Sonnet | low |
| review | the post-run review (orchestrator) | session model | n/a |

Confirmation options per row: Opus·high, Opus·medium, Sonnet·medium, Sonnet·low (Other for anything else).

## Learned
<!-- The review adds lines here only after the owner approves a proposed policy change: date, task type, change, evidence. -->
