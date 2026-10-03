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
Output of `scripts/lanes.mjs`: lane, slot, items in order, lane minutes, and which workflow runs it (A: lanes 1-2, slots 1-2; B: lanes 3-4, slots 3-4).
## 7. Conflict map
Item, files it touches, why it shares a lane.
## 8. Model and effort per item
One decision card per item, then the summary table. Facts come from the item's BACKLOG section, the files it names, the tests around them, and the calibration rates; a field the sources do not give is `unknown` (and counts toward the higher pick).

Card fields:
- **What changes**: files and call sites, layers touched, rules/data yes or no.
- **Decisions still open**: owner decisions or unverified claims; `none` only if the BACKLOG item records the decision.
- **Safety net**: existing tests around the code, what the tests-first step adds, CI gate.
- **Blast radius and undo**: who or what is affected if it is wrong, and how it is undone.
- **Signals toward Opus**: from `model-policy.md` "Selection signals".
- **Signals toward Sonnet**: same list.
- **Pick and why**: model·effort and one sentence; if it differs from the policy default, say why.
- **Option costs**: for Sonnet·low, Sonnet·medium, Opus·medium, Opus·high: minutes and % of the 5-hour window from the rates, plus what you risk by choosing it. Opus figures are a range marked "unmeasured, estimate" until an Opus-only run has been measured.

**Final docs card is one line:** `Final docs: mechanical fold of the fragments + e2e on slot 1 + docs PR; Sonnet·low; ~2 min, ~1.7%; risk: a missed fragment line.`

Example card (MON-8):

| Field | MON-8 |
|---|---|
| What changes | 1 new pure helper, 3 call sites (QuotationBuilder, Deals, FabricationWorks), 1 characterisation test flipped; no rules, no stored data rewritten |
| Decisions still open | none (rounding rule decided by the owner, 2026-10-02) |
| Safety net | strong: QuotationBuilder, Deals and FabricationWorks component tests exist; CI is the gate |
| Blast radius and undo | every new invoice; a wrong cent shows on all of them; undo = revert the merge |
| Signals toward Opus | money path |
| Signals toward Sonnet | pure function, spec decided, strong tests, easily reverted |
| Pick and why | Sonnet·medium (`money-small`): the risk is a missed edge case and the test plan lists them |
| Option costs | Sonnet·low ~8 min, ~2.0%, may skip the 0.01 and 0 edge cases; Sonnet·medium ~10 min, ~2.4%; Opus·medium ~8-12 min, ~4-6% (unmeasured, estimate); Opus·high ~12-18 min, ~6-9% (unmeasured, estimate) |

Summary table: item, task type, policy default, agent's pick, why it differs, owner's choice (filled after confirmation). Plus one row for the final docs step (task type final-docs). Values passed to agents: model `opus` or `sonnet`, effort `high`, `medium` or `low`.
## 9. Test plan per item
Layer, tests first, characterisation flip, rules test, e2e (none/once/three times: three only for a new e2e spec, once for other browser-visible changes), local checks vs CI.
## 10. Docs impact per item
Module CLAUDE.md, FINDINGS, security docs, fragment.
## 11. Guard rules and guarantees
The hard rules from SKILL.md, verbatim; rollback: revert the item's merge commit (rules items: also note the rules file).
## 12. Time per sub-step and wall-clock
From the rolling rates; range.
## 13. Timeline
Clock times per lane (up to 4 lanes in 2 workflows); window reset marked.
## 14. Usage as % of the 5-hour window
Meter now, per item, curve across the reset, weekly effect, calibration source and accuracy.
## 15. Usage guard
Projected peak = meter now + the sum over agents of (floor + item tokens / tokens-per-1%) + about 1% orchestration, using the rates in SKILL.md or the newer PLAN.md calibration (section 14 lists the per-item values); the launch check stops above 80%. Output-token threshold = (80% − meter now − final and review share) × output tokens per 1% from the calibration; until a review has measured output tokens per 1%, set it to null (guard off) and say so. After launch, append: launch time, meter %, weekly %, run ID, workflow output-file path.
## 16. Risks and fallbacks per item
Risk, fallback, effect on time and usage. Standing risk: both lanes share one linked `node_modules`, so Vite and Vitest caches under `node_modules/.vite` are shared (unverified).
## 17. Security and money watch-list
Items of task type security or money; always Opus (medium by default).
## 18. Definition of done and post-run review
Merged PRs, fragments folded, local e2e on `staging`, review steps; optional: promotion recommendation, notifications.
