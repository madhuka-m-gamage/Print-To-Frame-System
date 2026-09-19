# Git Workflow

> Branching rules for this repo. Sources: `CLAUDE.md` (project) and the owner's global Git safety preferences. Repo: `Print-To-Frame-Pvt-Ltd/Print-To-Frame-System` on GitHub.

## Branches

| Branch | Purpose | Deploys to |
|---|---|---|
| `staging` | Day-to-day work | Vercel **preview** deployment |
| `main` | Production | Vercel **production** (`portal.print2frame.xyz`) |

At last check `origin/main` and `origin/staging` point to the same single commit ("Manual File Upload"). A separate older local project (`Print-To-Frame-ERP-System`, 144 commits, remote `madhukagamage6/Print-To-Frame-ERP-System`) holds the original history; it is not the remote of this repo.

## Rules

- **Never commit directly to `main`**, and never push to `main` (or any production branch) without explicit confirmation.
- Work and commit on `staging` (or a feature branch off it).
- Promotion is a straight merge: `staging` to `main`, push, then switch back to `staging`.
- Production deploy commands (`firebase deploy`, `vercel --prod`, ...) need explicit confirmation each time.
- Firestore rules changes need their own deploy step; see [DEPLOY_PROCESS.md](DEPLOY_PROCESS.md).

## Branch naming

Not defined in the repo. Convention to follow until one is agreed: `staging` for routine work; short-lived feature branches off `staging` named `feature/<topic>` or `fix/<topic>`, merged back into `staging`.

## Pull requests

Open a PR from `staging` into `main` for production releases. The user-level `staging-deploy` skill automates commit, push to `staging`, wait for the preview, open the PR and pause to ask before merging. `CLAUDE.md` mentions project skills under `.agents/skills/`; that folder does **not** exist in this repo.

## Commit and doc conventions

- Commits end with the required `Co-Authored-By` attribution line when made by Claude.
- Documentation lives in `docs/` (see [PROJECT_INDEX.md](../../PROJECT_INDEX.md)); update `CHANGELOG.md` and `PROJECT_INDEX.md` with each change.
- Do not commit `.env*`, service-account JSON, `CLAUDE.local.md` or `.claude/settings.local.json` (all in `.gitignore`).

## Open questions

- Branch-naming convention and PR review requirements are not defined.
- Branch protection on `main` is not visible from the repo.
