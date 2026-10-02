# `agent-run` Decision Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the model and effort choice in the `agent-run` plan decidable: every row gets a decision card, a selection rubric explains the pick, the question compares the options, and the review records whether the pick was sufficient.

**Architecture:** Documentation changes inside `.claude/skills/agent-run/` (no runtime code), pinned by one unit test file that checks the contract text exists in each file. One branch, one PR into `staging`.

**Tech Stack:** Markdown, Vitest (unit tests in `tests/unit/`, `globals: false`).

**Spec:** [docs/05_decisions/0005-agent-run-skill.md](../05_decisions/0005-agent-run-skill.md) ("Model choice"), extended by the owner's request of 2026-10-02: the descriptions shown when choosing a model were too thin to decide with.

## Global Constraints

- Branch `claude/agent-run-cards` from `origin/staging`, PR into `staging`, merge with `gh pr merge --merge` after green CI. Never touch `main`. No deploys, no live data.
- Tests first and seen failing. No comments in code beyond a *why*.
- Cards cover **every** row, including the final docs step (one line). Question options carry a `preview` panel with the full card (both owner-approved).
- Estimates come from the rates in `SKILL.md` and PLAN.md "Run calibration". The Opus rate is unmeasured: Opus numbers must say "unmeasured, estimate" and give a range, never a single figure.
- Commits end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`; PR bodies end with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- Effort-level wording is the author's characterisation and must be labelled "to be validated by outcomes".

## Review Focus

1. A card for an item whose BACKLOG section is thin (no files, no tests named) must say "unknown" for those fields, not invent them. Pinned in Task 1 (the rubric states it) and Task 3.
2. The question tool allows at most 4 options and 4 questions per call; the recommended pick must stay first. Pinned in Task 4.
3. An item with an unverified claim (like FEA-13) must be flagged as a signal toward a higher model or "verify first", never silently scored as low risk. Pinned in Task 2.
4. The outcome record must not turn one run into policy: policy changes still need owner approval and at least the evidence line. Pinned in Task 5.
5. The final docs row must stay one line so a run of 8 items does not need 9 long cards. Pinned in Task 3.

---

### Task 1: Failing contract test

**Files:**
- Create: `tests/unit/agentRunCards.test.js`

**Interfaces:**
- Produces: the contract strings Tasks 2-5 must write.

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (name) => readFileSync(`.claude/skills/agent-run/${name}`, 'utf8');

describe('agent-run model decision cards', () => {
  it('the policy has a selection rubric, effort levels and an evidence log', () => {
    const policy = read('model-policy.md');
    for (const heading of ['## Selection signals', '## Effort levels', '## Evidence by task type']) expect(policy).toContain(heading);
    expect(policy).toContain('unverified claim');
    expect(policy).toContain('to be validated by outcomes');
  });

  it('plan section 8 defines the card fields, an example and the one-line final-docs card', () => {
    const template = read('plan-template.md');
    for (const field of ['What changes', 'Decisions still open', 'Safety net', 'Blast radius and undo', 'Signals toward Opus', 'Signals toward Sonnet', 'Pick and why', 'Option costs']) {
      expect(template).toContain(field);
    }
    expect(template).toContain('Example card (MON-8)');
    expect(template).toContain('unknown');
    expect(template).toContain('Final docs card is one line');
  });

  it('SKILL.md tells the planner to put facts in the question, costs in the options and the card in the preview', () => {
    const skill = read('SKILL.md');
    expect(skill).toContain('decision card');
    expect(skill).toContain('preview');
    expect(skill).toContain('unmeasured');
  });

  it('the review records the pick outcome and keeps policy changes owner-approved', () => {
    const review = read('review-checklist.md');
    expect(review).toContain('Pick outcome');
    expect(review).toContain('fix rounds');
    expect(review).toContain('never change the policy without the owner');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/unit/agentRunCards.test.js`
Expected: FAIL, 4 tests (missing headings and strings).

- [ ] **Step 3: Commit nothing yet** (the test is committed with Task 5).

### Task 2: Policy rubric, effort levels, evidence log

**Files:**
- Modify: `.claude/skills/agent-run/model-policy.md` (insert before `## Learned`)

**Interfaces:**
- Consumes: Task 1 strings `## Selection signals`, `## Effort levels`, `## Evidence by task type`, `unverified claim`, `to be validated by outcomes`.
- Produces: the signal names the card (Task 3) lists.

- [ ] **Step 1: Insert this text before `## Learned`**

```markdown
## Selection signals
The planner counts these for each item and writes them on the card; the task-type default is where it starts, the signals say whether to move.

Toward **Opus or higher effort**:
- touches money, auth, `firestore.rules` or `storage.rules`
- an **unverified claim** in the BACKLOG item (for example "this write always fails") that the agent must check first
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
One line per task type that has been run: runs, picks used, fix rounds, catch-ups, reviewer findings, rework. The review appends here; the policy defaults above change only with the owner's approval.
| Task type | Runs | Picks used | Fix rounds | Findings / rework |
|---|---|---|---|---|
| money-small | 1 (MON-8) | Sonnet·low | 0 | 1 out-of-scope finding (MON-9), no rework |
| small-ui | 2 (FEA-12, FEA-13) | Sonnet·medium | 0 | FEA-13: claim in BACKLOG proved wrong, fixed by verifying first |
| config | 1 (ENG-7) | Sonnet·low | 0 | none |
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run tests/unit/agentRunCards.test.js`
Expected: the policy test passes; 3 still fail.

### Task 3: Decision card in the plan template

**Files:**
- Modify: `.claude/skills/agent-run/plan-template.md` (replace the body of `## 8. Model and effort per item`)

**Interfaces:**
- Consumes: Task 2 signal names.
- Produces: the card format SKILL.md (Task 4) puts in the `preview` panel.

- [ ] **Step 1: Replace the body line under `## 8.` with**

```markdown
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
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run tests/unit/agentRunCards.test.js`
Expected: policy and template tests pass; 2 fail.

### Task 4: How the planner asks

**Files:**
- Modify: `.claude/skills/agent-run/SKILL.md` (replace Stage 1 step 4)

**Interfaces:**
- Consumes: Task 3 card fields.

- [ ] **Step 1: Replace step 4 with**

```markdown
4. Confirm model and effort for every row with AskUserQuestion, one question per row (final docs included), at most 4 questions per call:
   - **Question text**: the item's decision-card facts in 3-4 short lines (what changes, decisions still open, safety net, blast radius), then the pick and why.
   - **Options**: Sonnet·low, Sonnet·medium, Opus·medium, Opus·high, the pick first with "(Recommended)". Each option description gives that option's minutes and % of the window, and what you risk by choosing it. Opus costs say "unmeasured, estimate" until an Opus-only run is in the calibration.
   - **Preview**: put the full decision card (section 8) in each option's `preview`, so the owner can compare options side by side.
   - The final docs row uses the one-line card and no preview.
   Recompute sections 12-15 with the answers; if any item's minutes change, re-run `lanes.mjs` and update section 6. Write the owner's choice into the section 8 summary table, noting each override of the pick.
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run tests/unit/agentRunCards.test.js`
Expected: policy, template and SKILL.md tests pass; 1 fails.

### Task 5: Outcome record, docs, PR

**Files:**
- Modify: `.claude/skills/agent-run/review-checklist.md` (`## 2. Compare`, `## 3. Calibration`), `CHANGELOG.md`, `docs/05_decisions/0005-agent-run-skill.md` (one "Addendum 2026-10-02" paragraph)

**Interfaces:**
- Consumes: the evidence table in Task 2 (the review appends to it).

- [ ] **Step 1: Add to `## 2. Compare`**

```markdown
Add a **Pick outcome** column per item: the pick used, fix rounds, catch-ups, reviewer findings, rework, and one verdict: `sufficient`, `over-spec'd` (could have been lower with the same result) or `under-spec'd` (needed fix rounds or rework a higher pick likely avoids). Append each item to the "Evidence by task type" table in `model-policy.md`.
```

- [ ] **Step 2: Add to `## 3. Calibration`, under "Model overrides"**

```markdown
- Pick outcomes: one line per task type from the table above. A task type with two or more `under-spec'd` or `over-spec'd` verdicts goes on the "proposed skill changes" list; never change the policy without the owner's approval, and one run alone is not enough.
```

- [ ] **Step 3: Add the ADR addendum and CHANGELOG bullet**

`0005-agent-run-skill.md`, at the end of "Model choice": `Addendum 2026-10-02: each row now has a decision card (what changes, open decisions, safety net, blast radius, signals, option costs) shown in the question and in each option's preview, the policy has a selection rubric and effort definitions, and the review records whether each pick was sufficient. Plan: [AGENT_RUN_CARDS_PLAN.md](../04_workflows/AGENT_RUN_CARDS_PLAN.md).`

CHANGELOG under `## Unreleased`: `- agent-run decision cards (owner request): every model/effort row gets a card with what changes, open decisions, safety net, blast radius, signals and per-option costs; the question carries the facts, the options carry the costs and risks, the preview carries the card; the policy gains selection signals, effort levels and an evidence table; the review records pick outcomes. Unit +4.`

`PROJECT_INDEX.md`, after the `AGENT_RUN_PLAN.md` line: `- [AGENT_RUN_CARDS_PLAN.md](docs/04_workflows/AGENT_RUN_CARDS_PLAN.md): implementation plan for the model decision cards (decision 0005 addendum)`

- [ ] **Step 4: Full checks**

Run: `npx vitest run tests/unit/agentRunCards.test.js && npm run lint && npm test && npm run build`
Expected: 4 new tests pass; lint, unit and build green.

- [ ] **Step 5: Commit, push, PR, merge on green**

```bash
git fetch origin && git switch -c claude/agent-run-cards origin/staging --no-track
git add .claude/skills/agent-run docs/04_workflows/AGENT_RUN_CARDS_PLAN.md docs/05_decisions/0005-agent-run-skill.md CHANGELOG.md PROJECT_INDEX.md tests/unit/agentRunCards.test.js
git commit -m "feat(agent-run): decision cards for the model and effort choice

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
git push -u origin claude/agent-run-cards
gh pr create --base staging --title "agent-run: decision cards for the model and effort choice" --body "<summary of Tasks 2-5, ending with the Claude Code line>"
gh pr checks <n> --watch --interval 20 && gh pr merge <n> --merge
```

Expected: CI green (including e2e, which now runs for code PRs into `staging`), merged.

---

## Self-review

- Spec coverage: card on every row (T3, final-docs one-liner), rubric and effort levels (T2), comparison in the question/options/preview (T4), outcome record (T5), both owner answers (cards for all rows; preview used). The optional helper script is deliberately out.
- Placeholders: none; every inserted text is written out.
- Consistency: contract strings in T1 match the text in T2-T5 (`## Selection signals`, `## Effort levels`, `## Evidence by task type`, `Example card (MON-8)`, `Final docs card is one line`, `Pick outcome`, `never change the policy without the owner`).
- Review Focus: 1 (T2 `unknown` rule, T3 field text), 2 (T4 at most 4 per call, pick first), 3 (T2 unverified claim), 4 (T5 owner approval), 5 (T3 one-line final card).

**Estimate:** about 15 min and 2-3% of the 5-hour window on Sonnet (docs only plus one small test file).
