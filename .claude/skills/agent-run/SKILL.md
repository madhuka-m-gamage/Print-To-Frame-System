---
name: agent-run
description: Plan, run and review a batch of backlog items in this repo as parallel worktree agents, each item tests-first and merged into staging on green CI. Use when the owner asks to "run the next wave", "start Wave A2", "plan and run items X, Y", "run items X, Y in parallel", "chain the remaining items", to continue a Wave in PLAN.md with agents, or to "review the last agent run".
---

# agent-run

Three stages. Never skip the approval between Plan and Run.

## Hard rules (every run)
No deploys, nothing to main, no live data, no console or config changes. Tests first and seen failing. CI green to merge. e2e coverage never weakened. Merge staging in, never rebase or force-push. One owner per PR (agents switch Auto-fix off on their own PRs; the orchestrator never pushes to a branch whose agent is running). Skill and model-policy changes only with the owner's approval. At most 2 lanes on this machine.

## Rates (seed values; PLAN.md "Run calibration" wins when it has newer ones)
- Sonnet agent: about 54k subagent tokens per 1% of the 5-hour window (measured 2026-10-02), floor about 1.7% per agent (about 90k tokens just to start), small item 7-14 min and 1.7-2.0% of the window.
- Opus agent (medium effort): about 21.6k subagent tokens per 1% of the 5-hour window (measured 2026-10-02, run B1, 3 agents), about 2.5× Sonnet per token; small item 14-18 min and about 6%, medium item 25-30 min and about 8%. Opus at high effort is not yet measured: estimate it from these figures and mark it unmeasured.
- Projected peak = meter now + sum over agents of (floor + item tokens / tokens-per-1%) + about 1% for orchestration. The launch check stops above 80%.

## Stage 1: Plan (in plan mode)
1. `git fetch origin`. Read PLAN.md (roadmap, "Run calibration", carry-overs), each item's BACKLOG section and dependencies, TESTING.md "Planning a change" for each item, `gh pr list`, `gh run list --branch staging --limit 1`, `git log origin/main..origin/staging`, `java -version`, and the meter (`mcp__ccd_session_mgmt__get_usage`).
2. Classify each item with `model-policy.md`; estimate minutes and window % per item from the rates above; write `<scratchpad>/items.json` (`id, minutes, files, deps`; `files` and `deps` always arrays, `[]` when empty) and run `node .claude/skills/agent-run/scripts/lanes.mjs <scratchpad>/items.json`.
3. Fill every section of `plan-template.md` into the plan file.
4. Confirm model and effort for every row with AskUserQuestion, one question per row (final docs included), at most 4 questions per call:
   - **Question text**: the item's decision-card facts in 3-4 short lines (what changes, decisions still open, safety net, blast radius), then the pick and why.
   - **Options**: Sonnet·low, Sonnet·medium, Opus·medium, Opus·high (at most 4), the pick first with "(Recommended)". Each option description gives that option's minutes and % of the window, and what you risk by choosing it. Opus costs say "unmeasured, estimate" until an Opus-only run is in the calibration.
   - **Preview**: put the full decision card (section 8) in each option's `preview`, so the owner can compare options side by side.
   - The final docs row uses the one-line card and no preview.
   Recompute sections 12-15 with the answers; if any item's minutes change, re-run `lanes.mjs` and update section 6. Write the owner's choice into the section 8 summary table, noting each override of the pick.
5. ExitPlanMode.

## Stage 2: Run (after approval)
1. Read the meter again; if the projected peak (section 15) exceeds 80%, stop and report.
2. Confirm the keep-awake preference is on (ccd_settings) or call `mcp__ccd_host__request_keep_awake` with `until: "session_idle"`.
3. Build `args`: `brief` = the text of `agent-brief.md`; `lanes` from section 6 with each item's `branch` (`claude/<id-lowercase>-<topic>`), `slot` (lane number, 1 or 2), `model`, `effort`, `backlog` (its BACKLOG section text), `files`, `notes` (module CLAUDE.md "Before you edit" bullets), `testPlan` (section 9 row); `final` = `{ model, effort }` from the final-docs row of section 8; `guardOutputTokens` from section 15 (may be null); `mainCheckout` = the primary checkout, the first path in `git worktree list` (it is only linked when its `package-lock.json` matches). Model values `opus` or `sonnet`; effort `high`, `medium` or `low`.
4. `node .claude/skills/agent-run/scripts/check-workflow.mjs .claude/skills/agent-run/workflow-template.js`, then launch Workflow with `scriptPath` = the template and `args`. Post the run ID, and append launch time, meter %, weekly %, run ID and the workflow output-file path to section 15 of the plan file so the review can run after a restart.
5. While it runs, leave agent PRs alone. Auto-fix events about an agent's PR get a one-line reply only.

## Stage 3: Review (when the workflow returns)
Follow `review-checklist.md` end to end, then report.
