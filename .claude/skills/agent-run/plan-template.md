# Agent run plan: <items>, <date>

## 1. Context and scope
Goal, items, wave. Source: PLAN.md roadmap.
## 2. Readiness check
Table: `staging` CI, open PRs for the items, `staging` vs `main`, changes since last run, Java and emulators, keep-awake preference, Auto-fix plan, meter now. Any ✗ is a blocker.
## 3. Scope and exclusions
Items left out: id, reason (dependency, owner, live, other wave).
## 4. Owner decisions needed
Per decision: question, recommended default, effect of "no".
## 5. Carry-overs
From PLAN.md Run calibration "Tuning" (not yet adopted) and the last review's findings.
## 6. Lanes and order
Output of `scripts/lanes.mjs`: lane, slot, items in order, lane minutes.
## 7. Conflict map
Item, files it touches, why it shares a lane.
## 8. Model and effort per item
Item, task type, policy default, agent's pick, why it differs, owner's choice (filled after confirmation). Plus one row for the final docs step (task type final-docs). Values passed to agents: model `opus` or `sonnet`, effort `high`, `medium` or `low`.
## 9. Test plan per item
Layer, tests first, characterisation flip, rules test, e2e (none/once/three times: three only for a new e2e spec, once for other browser-visible changes), local checks vs CI.
## 10. Docs impact per item
Module CLAUDE.md, FINDINGS, security docs, fragment.
## 11. Guard rules and guarantees
The hard rules from SKILL.md, verbatim; rollback: revert the item's merge commit (rules items: also note the rules file).
## 12. Time per sub-step and wall-clock
From the rolling rates; range.
## 13. Timeline
Clock times per lane; window reset marked.
## 14. Usage as % of the 5-hour window
Meter now, per item, curve across the reset, weekly effect, calibration source and accuracy.
## 15. Usage guard
Projected peak = meter now + the sum over agents of (floor + item tokens / tokens-per-1%) + about 1% orchestration, using the rates in SKILL.md or the newer PLAN.md calibration (section 14 lists the per-item values); the launch check stops above 80%. Output-token threshold = (80% − meter now − final and review share) × output tokens per 1% from the calibration; until a review has measured output tokens per 1%, set it to null (guard off) and say so. After launch, append: launch time, meter %, weekly %, run ID, workflow output-file path.
## 16. Risks and fallbacks per item
Risk, fallback, effect on time and usage. Standing risk: both lanes share one linked `node_modules`, so Vite and Vitest caches under `node_modules/.vite` are shared (unverified).
## 17. Security and money watch-list
Items of task type security or money; always Opus.
## 18. Definition of done and post-run review
Merged PRs, fragments folded, local e2e on `staging`, review steps; optional: promotion recommendation, notifications.
