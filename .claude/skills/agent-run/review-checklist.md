# Post-run review

Run in the orchestrating session after the workflow returns. About 10 min, 3–4% of the window.

## 1. Collect
- Per agent: label, model, startedAt, durationMs, tokens, toolCalls from the workflow task output file (the `agents` array).
- Per PR: `gh pr view <n> --json createdAt,mergedAt`; CI rounds from `gh pr checks`; fixRounds and catchUps from the agent results.
- Meter: `mcp__ccd_session_mgmt__get_usage` now; the launch reading from the plan (section 15). If the run crossed the 5-hour reset, the run's total is the weekly delta converted with the "window % per weekly %" rate; each item's share is its token share of the total.

## 2. Compare
Table per item: est. min, actual min, est. %, actual %. Flag > 30% off with one cause: scope, catch-up, CI, environment, estimate model.

## 3. Calibration (overwrite PLAN.md "## Run calibration")
- Last run: date, items, agents, wall-clock, meter start → end, weekly start → end, run ID.
- The comparison table.
- Rolling rates (last 3 runs, one row each plus average): min per S / M / L item; min per CI round; min per catch-up; % per S / M / L item by model; agent startup floor %; output tokens per 1%; window % per weekly %; concurrency. Models share one rate until two runs with different Opus/Sonnet mixes exist; say so in the table.
- Model overrides: "owner changed X of Y picks" and which task types.
- Tuning: numbered rules, each "adopted" or "not yet" (not-yet lines carry over to the next plan's section 5).

## 4. Findings
- Product or code: a BACKLOG item (next free ID of the right prefix, wave, "found by <item>, <date>", evidence), after searching BACKLOG for an existing item.
- Process: GIT_WORKFLOW.md or TESTING.md if it changes how work runs, else the tuning list.
- Skill or model policy: a "proposed skill changes" list for the owner; never edit the skill or policy without approval.

## 5. Ship and report
- Commit the calibration and BACKLOG items to the final step's open docs PR branch, wait for CI, `gh pr merge <n> --merge`.
- Chat report: the comparison table, top 3 tuning changes, new BACKLOG items, proposed skill and policy changes, promotion recommendation (owner decides).
