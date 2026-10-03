# Post-run review

Run in the orchestrating session after the workflow returns. About 10 min, 3–4% of the window.

## 1. Collect
- Per agent: label, model, startedAt, durationMs, tokens, toolCalls from the workflow task output file (the `agents` array).
- Per PR: `gh pr view <n> --json createdAt,mergedAt`; CI rounds from `gh pr checks`; fixRounds and catchUps from the agent results.
- Meter: `mcp__ccd_session_mgmt__get_usage` now; the launch reading from the plan (section 15). If the run crossed the 5-hour reset, the run's total is the weekly delta converted with the "window % per weekly %" rate; each item's share is its token share of the total.

## 2. Compare
Table per item: est. min, actual min, est. %, actual %. Flag > 30% off with one cause: scope, catch-up, CI, environment, estimate model.
Add a **Pick outcome** column per item: the pick used, fix rounds, catch-ups, reviewer findings, rework, and one verdict: `sufficient`, `over-spec'd` (could have been lower with the same result) or `under-spec'd` (needed fix rounds or rework a higher pick likely avoids). Append each item to the "Evidence by task type" table in `model-policy.md`.

## 3. Calibration (overwrite PLAN.md "## Run calibration")
- Last run: date, items, agents, wall-clock, meter start → end, weekly start → end, run ID.
- The comparison table.
- Rolling rates (last 3 runs, one row each plus average): min per S / M / L item; min per CI round; min per catch-up; % per S / M / L item by model; agent startup floor %; output tokens per 1%; window % per weekly %; concurrency. Models share one rate until two runs with different Opus/Sonnet mixes exist; say so in the table.
- Model overrides: "owner changed X of Y picks" and which task types.
- Pick outcomes: one line per task type from the evidence table. A task type with two or more `under-spec'd` or `over-spec'd` verdicts goes on the "proposed skill changes" list; never change the policy without the owner's approval, and one run alone is not enough.
- Tuning: numbered rules, each "adopted" or "not yet" (not-yet lines carry over to the next plan's section 5).

## 4. Findings
- Product or code: a BACKLOG item (next free ID of the right prefix, wave, "found by <item>, <date>", evidence), after searching BACKLOG for an existing item.
- Process: GIT_WORKFLOW.md or TESTING.md if it changes how work runs, else the tuning list.
- Skill or model policy: a "proposed skill changes" list for the owner; never edit the skill or policy without approval.

## 5. Ship and report
- With two workflows there are two final docs PRs, each folding only its own workflow's fragments: merge the first after its CI, then merge `origin/staging` into the second (both edit CHANGELOG, the BACKLOG status line, TESTING and PLAN.md, so keep both sides), and add the review to the second.
- `git fetch origin`, check out the final step's open docs PR branch in a clean worktree, commit the calibration and BACKLOG items, wait for CI, `gh pr merge <n> --merge`. If the workflow returned `final: null` (nothing merged) or `final: { error }` (the final agent failed), branch `claude/run-review-<date>` from `origin/staging`, fold any fragments still in `docs/04_workflows/changes/` as its README says, and open the docs PR yourself. If the final step returned `missingFragments`, write those items' CHANGELOG, TESTING and status lines from their PRs in the same docs PR and note the miss in the evidence table. Items with status `not-started` stay in the comparison table with their reason.
- Chat report: the comparison table, top 3 tuning changes, new BACKLOG items, proposed skill and policy changes, promotion recommendation (owner decides).
