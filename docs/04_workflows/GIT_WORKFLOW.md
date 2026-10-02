# Git Workflow

> Branching rules for this repo. Sources: `CLAUDE.md` (project) and the owner's global Git safety preferences. Repo: `madhuka-m-gamage/Print-To-Frame-System` on GitHub.

## Branches

| Branch | Purpose | Deploys to |
|---|---|---|
| `staging` | Integration branch; every item lands here first | Vercel **preview** deployment |
| `main` | Released state | Vercel project `print-to-frame-system` (production of this repo) |
| `claude/<topic>` | One short-lived branch per backlog item, off `staging` | Vercel preview per PR |

The live site `portal.print2frame.xyz` still deploys `main` of the **old** repository `madhukagamage6/Print-To-Frame-ERP-System` until backlog item LIVE-3 reconnects it here. Merging here does not change the live site.

## Rules

- **Never commit directly to `main`**, and never push to `main` (or any production branch) without explicit confirmation.
- Production deploy commands (`firebase deploy`, `vercel --prod`, ...) need explicit confirmation each time.
- Firestore and Storage rules changes need their own deploy step; see [DEPLOY_PROCESS.md](DEPLOY_PROCESS.md).

## One item, one branch, one PR

1. `git switch staging && git pull && git switch -c claude/<topic>` (topic = the backlog item, e.g. `claude/commission-38`).
2. Tests first, then the change, then the full local gate: `npm run lint`, `npm run test:all`, `npm run build`, and `npm run test:e2e` when the change is visible (see [TESTING.md](TESTING.md)).
3. Docs, the module's `CLAUDE.md` and `CHANGELOG.md` in the same PR. In a multi-agent run, write a change fragment instead of editing `CHANGELOG.md`, the BACKLOG status line, the TESTING map or `PLAN.md` ([changes/README.md](changes/README.md)).
4. `gh pr create --base staging`, wait for CI, merge with `gh pr merge --merge`.

## Promotion to `main`

Only when the owner says so: `gh pr create --base main --head staging`, wait for CI, then `gh pr merge <n> --merge`. Use a **merge commit, never a squash**, so `main` stays a descendant of `staging`. Afterwards `git diff origin/main origin/staging` should be empty. Milestones are tagged on `main` (`v1.0.0` = Milestone 1). The user-level `staging-deploy` skill can run a promotion.

### If a squash sneaks in

A squash merge into `main` (as in #65) gives `main` a commit `staging` does not have, and the next promotion conflicts. Check that the squash tree equals a `staging` commit (`git diff <staging-sha> <squash-sha>` is empty); if so, on a branch off `staging` run `git merge -s ours origin/main` (records the squash as merged without changing any file) and PR it into `staging` (done in #68). The promotion then merges cleanly.

## Commit and doc conventions

- Commits end with the required `Co-Authored-By` attribution line when made by Claude; PR descriptions end with the Claude Code line.
- Documentation lives in `docs/` (see [PROJECT_INDEX.md](../../PROJECT_INDEX.md)); update `CHANGELOG.md` and `PROJECT_INDEX.md` with each change.
- Do not commit `.env*`, service-account JSON, `CLAUDE.local.md` or `.claude/settings.local.json` (all in `.gitignore`).

## Open questions

- There is no branch protection on `main`; PR review requirements are not configured.
