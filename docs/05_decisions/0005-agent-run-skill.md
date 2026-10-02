# 0005: The `agent-run` skill for batched agent runs

Status: accepted, 2026-10-02 (owner approved); implemented by PR #97 (prerequisites) and the agent-run skill PR. Implementation plan: [AGENT_RUN_PLAN.md](../04_workflows/AGENT_RUN_PLAN.md).

## Context

Milestone 2 Wave A ran as three batches of parallel agents (one agent per backlog item, one PR each, merged into `staging` on green CI). The process worked, but its rules lived only in chat, two memory notes and PLAN.md's "Run calibration" section, and each plan was reshaped by hand (time estimates, then usage as a percentage of the 5-hour window, then a post-run review). The 2026-10-01 run (8 agents, PRs #86 to #93, review #94) also showed where time was lost:

- Every item edited the same lines (the top of `CHANGELOG.md`, the BACKLOG "Milestone 2 done" line, `TESTING.md`), so almost every PR after the first conflicted. FEA-8 caught up twice and still conflicted (#90).
- After a docs-only catch-up, agents re-ran the full local gate and waited for CI again.
- Agents ran `test:all` locally and then CI ran the same suites.
- Only one lane could use the Firebase emulators, because their ports are fixed, which left the lanes unbalanced.
- The app's Auto-fix acted on PRs the agents were still driving; one push collided on #90.
- Every agent re-read PLAN.md, BACKLOG.md, TESTING.md and the module notes before starting.
- The machine runs at most 2 agents at once (4 CPUs, workflow cap CPUs − 2), so the third lane waited 18 minutes.
- Each agent costs about 3% of the 5-hour window just to load the repo, so tiny steps given their own agent are expensive.

## Decision

Add a repo skill, `.claude/skills/agent-run/`, that plans, runs and reviews a batch of backlog items. It comes with one prerequisite PR of repo changes it depends on. It is refined on real runs here first; a global version comes later (see "Going global").

### Files

```
.claude/skills/agent-run/
├── SKILL.md               triggers, the three stages, the hard rules
├── plan-template.md       the 18-section plan template
├── agent-brief.md         the per-item agent prompt
├── model-policy.md        default model and effort per task type (owner-editable)
├── workflow-template.js   the Workflow script skeleton
├── review-checklist.md    the post-run steps and the calibration format
└── scripts/
    ├── lanes.mjs          lane balancing and the usage guard (unit-tested with node --test)
    └── link-deps.sh       shared node_modules when package-lock.json matches
```

SKILL.md stays short and is always loaded; each other file is read only at the stage that needs it. Triggers: "run the next wave", "plan and run items X, Y", "chain the remaining items".

### Stage 1: Plan

1. Read PLAN.md (waves, Run calibration, carry-overs), each item's BACKLOG section and dependencies, git and PR state, and the live usage meter (`mcp__ccd_session_mgmt__get_usage`).
2. Fill `plan-template.md` in plan mode. The 18 sections:

| # | Section | Holds |
|---|---|---|
| 1 | Context and scope | goal, items, place in the waves |
| 2 | Readiness check | `staging` CI green, no open PRs for the items, `staging` vs `main` gap, changes since the last run, Java and emulators, keep-awake, Auto-fix state, meter headroom |
| 3 | Scope and exclusions | items left out and why (dependency, owner, live, other wave) |
| 4 | Owner decisions needed | each with a recommended default and what a "no" means |
| 5 | Carry-overs | tuning and findings from the last review, adopted or not |
| 6 | Lanes and order | 2 lanes, the test slot and environment of each |
| 7 | Conflict map | files per item and why items share a lane |
| 8 | Model and effort per item | the editable table (see "Model choice") |
| 9 | Test plan per item | TESTING.md "Planning a change" answers; e2e once, three times or not; local vs CI checks |
| 10 | Docs impact per item | module CLAUDE.md, FINDINGS, security docs, the fragment |
| 11 | Guard rules and guarantees | the hard rules below, plus a standard rollback line (revert the item's merge commit) |
| 12 | Time per sub-step and wall-clock | from the calibration rates, with a range |
| 13 | Timeline | clock times per lane, the window reset marked |
| 14 | Usage as % of the 5-hour window | meter now, the curve across the reset, weekly effect, which run it is calibrated from and how accurate |
| 15 | Usage guard | stop threshold and the run ID for resuming |
| 16 | Risks and fallbacks per item | with their effect on time and usage |
| 17 | Security and money watch-list | items touching auth, rules, invoices or commission; always Opus |
| 18 | Definition of done and post-run review | merged PRs, fragments folded, local e2e on `staging`, the review task, plus optional promotion recommendation and notifications |

3. Confirm the model and effort for **every row, every run** (see "Model choice"), recalculate time and usage with the chosen models, then call ExitPlanMode. Nothing launches before approval.

### Model choice

- `model-policy.md` holds the standing defaults the owner can edit at any time:

| Task type | Model | Effort |
|---|---|---|
| Security, rules, auth | Opus | high |
| Money paths (invoices, commission) | Opus | high |
| Many decisions, design-heavy | Opus | medium |
| Tests only, coverage | Sonnet | medium |
| Small UI feature in one module | Sonnet | medium |
| Config or one-file edits | Sonnet | low |
| Final docs step | Sonnet | low |
| Review stage | the session model | n/a |

- The plan table has one row per item and per separate stage: item, task type, policy default, agent's pick, why it differs, owner's choice.
- Before ExitPlanMode, one question per row with four options (Opus·high, Opus·medium, Sonnet·medium, Sonnet·low), the agent's pick first and marked, "Other" for anything else. Up to 4 rows per prompt.
- The model is set per agent, so an item's implementation, catch-up and docs share one model. A step gets its own model only when it is its own agent (final docs step, review, plan).

### Stage 2: Run

1. **Launch:** re-read the meter and stop if the projected peak exceeds 80% of the window; request keep-awake (`mcp__ccd_host__request_keep_awake`); record the run ID; check the filled workflow script's syntax; launch.
2. **Two balanced lanes** built by `lanes.mjs`: items sharing files, and items that depend on each other, stay in one lane in dependency order; lane minutes within about 20% of each other. A dependency outside the batch is assumed already merged. Lane *N* uses test slot *N*.
3. **Agent brief** (`agent-brief.md`): the item's BACKLOG section pasted in, expected files, module notes, slot environment, linked `node_modules`, and the approved test plan. Agents open the full docs only when needed.
4. **Local checks vs CI:** locally lint, the item's tests and the affected module's suites, plus rules and e2e when the plan says so. CI (`lint-unit`: lint, unit, API, component, build; `rules`) is the gate and must be green to merge. e2e three times only for a new e2e spec, otherwise once.
5. **Docs per item:** its fragment `docs/04_workflows/changes/<ID>.md` and its own `### <ID>` BACKLOG section only.
6. **Catch-up:** `git merge origin/staging`, never rebase or force-push. If only docs files conflicted, check the conflict markers are gone and skip the local checks (CI re-runs); if code conflicted, re-run the local checks.
7. **One owner per PR:** the agent switches Auto-fix off for its own PR (`mcp__ccd_pr__set_monitor`, `auto_fix: false`; confirmed available by the owner). The orchestrator never pushes to a branch whose agent is running.
8. **Stop rules:** at most 2 fix rounds; an item needing an owner decision or a live action leaves its PR open as blocked and stops its lane; the other lane continues.
9. **Usage guard:** before each item the script compares the run's output-token count (`budget.spent()`) with the plan's threshold and starts no new item past it; running items finish and merge. The owner accepted output tokens as the guard measure; each review calibrates output tokens per 1% of the window.
10. **Final step** (one agent, Sonnet·low by default): run `npm run test:e2e` locally on the merged `staging`; fold every fragment into CHANGELOG.md, the BACKLOG status line and the TESTING map; update PLAN.md; delete the fragments; open one docs PR into `staging` and leave it unmerged for the review.

### Stage 3: Review

1. **Collect:** per agent model, start, duration, tokens, tool calls (the workflow's run record); per PR created and merged times, CI rounds, fix rounds, catch-ups; the meter at launch and end and the weekly percentage before and after. A run that crosses the window reset takes its total from the weekly delta; each item's share is its token share of that total.
2. **Compare:** estimated vs actual minutes and % per item; anything more than 30% off gets one cause: scope, catch-up, CI, environment, or estimate model.
3. **Run calibration in PLAN.md** (overwritten each run): the last run's summary and table; rolling rates over the last 3 runs (minutes per S, M, L item, per CI round, per catch-up; % per S, M, L item by model; the agent startup floor; output tokens per 1%; concurrency); Opus and Sonnet rates separated once two runs with different mixes exist, shared until then and labelled so; the tuning list, each entry adopted or not yet (not-yet entries carry over).
4. **Findings:** product and code findings become BACKLOG items (ID, wave, "found by <item>, <date>", evidence) after checking for an existing item; process findings go to GIT_WORKFLOW.md or TESTING.md when they change how work runs; skill and model-policy findings become a "proposed skill changes" list. Model overrides are tracked ("you changed 2 of 9 picks") to improve the policy.
5. **Ship and report:** add the calibration and new BACKLOG items to the final step's open docs PR, merge it on green CI. Report in chat: the estimate-vs-actual table, the top 3 tuning changes, new BACKLOG items, proposed skill and policy changes for approval, and a promotion recommendation (the owner decides; the skill never merges to `main`).

### Hard rules (every run)

No deploys of rules or anything else, nothing to `main`, no live data, no console or config changes. Tests first and seen failing. CI green to merge. e2e coverage never weakened. Merge `staging` in, never rebase or force-push. One owner per PR. Skill and policy changes only with the owner's approval.

### Prerequisite PR (built in a normal session, before the skill)

**A. Change fragments (docs).** `docs/04_workflows/changes/README.md` defines `<ID>.md` with three headings: `## Changelog` (the exact bullet), `## Testing map` (lines to add or change), `## Status` (done, blocked or open, plus test counts), and how the final step folds and deletes them. Rule: inside a multi-agent run items write fragments and their own BACKLOG section; the shared CHANGELOG, BACKLOG status line, TESTING map and PLAN.md are written once by the final step. A single manual session may still edit CHANGELOG.md directly. Updates root `CLAUDE.md` (the CHANGELOG rule), `GIT_WORKFLOW.md`, `TESTING.md` ("Adding a test"), `PROJECT_INDEX.md`.

**B. Per-slot test ports (code and tests).** Slot 0 keeps today's ports, so CI, `npm run dev` and manual habits are unchanged. `tests/tools/testSlot.mjs <slot>` writes a gitignored `firebase.slot<N>.json` (one `.gitignore` line, for the owner's OK) with every emulator port (Firestore and its websocket, Auth, Storage, UI, hub, logging) shifted by N × 10 and prints the slot's environment variables. The offset is 10, not the 100 first discussed: Auth 9099 + 100 would land on Storage 9199. Variables use a `P2F_` prefix; `FIREBASE_CONFIG` is avoided because firebase-admin reads it. The seven hard-coded places read the environment and default to today's values:

| File | Today | Change |
|---|---|---|
| `firebase.json` | fixed ports | unchanged; slots use the generated copy via `--config` |
| `package.json` `test:rules`, `dev:emulated` | default config, `--port 3000` | `P2F_FIREBASE_CONFIG`, `P2F_DEV_PORT` with today's defaults |
| `tests/helpers/emulator.js`, `tests/integration/effectiveAccess.test.js` | 8080, 9199 | the `*_EMULATOR_HOST` variables `emulators:exec` sets |
| `playwright.config.js` | `baseURL` and wait URLs on 3000 and 9099 | from the environment |
| `tests/e2e/global-setup.js` | 3000 in the safety check | from the environment |
| `src/services/firebase.js` | 8080, 9099, 9199 (test-mode branch only) | `VITE_EMULATOR_*_PORT`, today's defaults |

Tests: unit tests that slot 0 equals today's ports and slots 1 and 2 never collide; a unit test that the app's emulator ports come from the environment with the right defaults; a manual check recorded in the PR (`test:rules` on slots 1 and 2 at once, one e2e run on slot 1). At most 2 slots on this machine (4 CPUs, 6 GB RAM).

**C. Shared `node_modules`.** `link-deps.sh` (in the skill folder) links the main checkout's `node_modules` when the worktree's `package-lock.json` matches, otherwise runs `npm ci`. Verified in the PR by running the gate in a linked worktree.

ENG-7 (component coverage, e2e on PRs into `staging`) stays its own Wave A2 item.

## Testing the skill and rollout

1. Build order, each PR into `staging` with the owner's go: the prerequisite PR (about 35 to 45 min, 9 to 11% of the window); the skill PR (about 30 to 40 min, 8 to 10%), which also links the skill from root `CLAUDE.md`, `GIT_WORKFLOW.md` and `PROJECT_INDEX.md`; then the pilot run.
2. Before the pilot: `node --test` for `lanes.mjs` (conflict groups stay together, lanes balanced within 20%, dependencies ordered, the guard stops above its threshold); a syntax check of the filled workflow script; one skill-reviewer pass over SKILL.md. No dry run with stub agents (each agent costs about 3% of the window to start).
3. Pilot: Wave A2 (MON-8 tests the owner-decision section; FEA-12; FEA-13 tests scope and exclusions because it may touch rules; ENG-7 tests risks because it changes CI). Success criteria, measured by the review against the 2026-10-01 baseline:
   - no conflicts on shared lines; catch-ups docs-only;
   - both lanes ran the emulators locally on their own ports;
   - no Auto-fix collisions; one docs PR for the run;
   - at least 70% of items within 30% of their time and usage estimates;
   - every item tests-first and merged on green CI.
4. A failed criterion becomes a proposed skill change, applied before the next run.

## Going global

After 2 to 3 pilot runs with stable calibration and no proposed skill changes in the last review: move the repo-specific facts (PLAN, BACKLOG and fragment paths, wave names, ports, test commands, CI layout) into `.claude/agent-run.config.md`, move the skill body to `~/.claude/skills/agent-run/`, and keep only the config here. That gets its own design.

## Consequences

- Plans arrive with every section the owner asked for, and the owner confirms every model and effort choice on every run.
- Runs stop conflicting on shared doc lines, skip redundant local gates, and balance work across two fully tested lanes.
- Each run ends with one docs PR carrying the folded changelog, calibration and new backlog items.
- Estimates improve run over run from measured rates, and the skill itself changes only through approved review proposals.
- Cost: one prerequisite PR touching test configuration and the emulator branch of `src/services/firebase.js`, plus the skill PR, before the first pilot.
