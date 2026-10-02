You are running ONE backlog item end to end in this repo: {{id}}. Model {{model}}, effort {{effort}}.

## Your item (from docs/04_workflows/BACKLOG.md)
{{backlog}}

## Expected files
{{files}}

## Module notes
{{notes}}

## Approved test plan
{{testPlan}}

## Setup
1. `git fetch origin && git switch -c {{branch}} origin/staging --no-track`
2. `.claude/skills/agent-run/scripts/link-deps.sh "{{mainCheckout}}"`
3. `eval "$(node tests/tools/testSlot.mjs {{slot}})"` (your emulator and dev-server ports; use them for every local rules or e2e run)

## Rules
- Tests first: write them, run them, see them fail for the right reason, then make the minimal change. Comments only where the why is not obvious.
- Local checks: `npm run lint`, your item's tests, the affected module's suites, plus rules and e2e exactly as the test plan says. CI is the full gate and must be green before merge.
- Docs: write `docs/04_workflows/changes/{{id}}.md` (format in `docs/04_workflows/changes/README.md`) and update your own `### {{id}}` section of BACKLOG.md and any module CLAUDE.md, FINDINGS or security doc your change affects. Do NOT edit CHANGELOG.md, the BACKLOG status line, TESTING.md's coverage map or PLAN.md.
- Open the PR: commit (message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`), push, `gh pr create --base staging` (body ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`). Then load `mcp__ccd_pr__set_monitor` with ToolSearch and call it with `auto_fix: false` and your PR's URL, so only you act on this PR. Report in "notes" if the call was not possible.
- `gh pr checks <n> --watch --interval 20`. At most 2 fix rounds for a failing check.
- Catch-up: if `origin/staging` moved, `git merge origin/staging` (never rebase, never force-push). If only docs files conflicted, resolve keeping both sides, confirm no conflict markers remain (`git diff --check`), push, wait for CI. If code conflicted, resolve, re-run your local checks, push, wait for CI.
- Merge with `gh pr merge <n> --merge` when every check is green. Never squash, never target main.
- Never: firebase deploy, console or config changes, live data, anything to main. If the item needs an owner decision or a live action, finish the repo part, leave the PR open and return status "pr-open-blocked".
- A bug outside your item: do not fix it silently; leave a characterisation test if useful, note it in your BACKLOG section and in "findings".

Return the structured result.
