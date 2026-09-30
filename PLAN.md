# Plan: Print To Frame ERP

Progress tracker, overwritten in place. Work items and their details live in [docs/04_workflows/BACKLOG.md](docs/04_workflows/BACKLOG.md); the Milestone 1 handoff is [docs/HANDOFF_REPORT.md](docs/HANDOFF_REPORT.md).

## Milestone 1 (tag `v1.0.0`, 2026-09-27): audit to remediation, done
- [x] Investigation phases 1–6: architecture, GCP inventory, 16 module maps, cross-module triggers, per-module `CLAUDE.md`, security and workflow docs, 16 module reviews (`docs/02_modules/*/FINDINGS.md`)
- [x] Test suite: unit, API, component, rules (Firestore + Storage emulators), Playwright; CI on every PR (PR #4 onward)
- [x] Phase 7 remediation steps 1–6, 8.1, 8.2 (PRs #6–#57); 3.3/3.4d/3.5d, 4.1, 4.3, 7 and B6 moved to the backlog by the owner
- [x] Project folder moved to the repo root (#58); follow-up backlog written (#59)
- [x] Owner decisions DEC-1..9 answered and implemented (#61–#64, #66, #69, #70); Storage rules deployed live 2026-09-27
- [x] `staging` and `main` identical (last promotion #71 + milestone PR)

## Standing decisions
Keep the x0.25 invoice print scaling; lead stage advance stays manual; Managers may administer users (not Admins, not their own role); `users` readable by Admin, self, or roles with `agents:view` / `messages:view`; the Final-invoice guard is client-side `getExistingFinalInvoice`; live data is test data and a fresh environment is planned (DEC-5); default permissions everywhere (DEC-7).

## How each item runs
One item per fresh session: branch `claude/<topic>` from `staging` → tests first (seen failing) → change → `npm run lint`, `npm run test:all`, `npm run build` (+ `npm run test:e2e` when visible) → docs, module `CLAUDE.md` and `CHANGELOG.md` in the same PR → PR into `staging` → promote to `main` by PR with a merge commit when the owner says so. Live actions (rules deploys, `settings/permissions`, Vercel/Firebase config) only with the owner's go at that moment. Full detail: [GIT_WORKFLOW.md](docs/04_workflows/GIT_WORKFLOW.md), [TESTING.md](docs/04_workflows/TESTING.md).

## Roadmap to Milestone 2
- [ ] **Wave A, repo only, no live impact:** ~~MON-1~~, ~~MON-3~~, ~~MON-2~~, ~~SEC-1~~, ~~SEC-2~~, ~~SEC-3~~, ~~SEC-9~~, ~~TST-1~~, ~~TST-3~~, ~~FEA-3~~, ~~FEA-8~~, ~~FEA-6~~, ~~FEA-11~~, ~~ENG-4~~, ~~SEC-11~~ (deactivated-user sign-in), ENG-5 (skipped by owner 2026-10-01)
- [ ] **Wave A2, follow-ups found during Wave A (repo only):** MON-8 (owner decision first), FEA-12, FEA-13, ENG-7
- [ ] **Wave B, code + rules built and tested here, live with the next rules deploy:** MON-4, MON-5, MON-7, FEA-1, FEA-2, FEA-4, FEA-5, FEA-7, FEA-9, FEA-10, SEC-6, SEC-7, SEC-8, SEC-12
- [x] **Wave C, before restrictive rules go live:** ~~TST-2~~ (money and RBAC browser journeys)
- [ ] **Wave D, environment and go-live (owner sittings):** LIVE-2 fresh environment (seed `DEFAULT_PERMISSIONS`, deploy Firestore + Storage rules), LIVE-3 move production here and archive the old repos, LIVE-1, LIVE-4, SEC-4, SEC-5, SEC-10, TST-4
- [ ] **Wave E, code health after tests exist:** ENG-1, ENG-2, ENG-6

## Progress snapshot
| Track | Progress | Notes |
|---|---|---|
| Milestone 1 | `[##########]` 100% | Tagged `v1.0.0` |
| Wave A | `[#########-]` 15/16 | MON-1, MON-3, MON-2, SEC-1, SEC-2, SEC-3, SEC-9, TST-1, TST-3, FEA-3, FEA-8, FEA-6, FEA-11, ENG-4, SEC-11 done; next up: ENG-5 (skipped by owner 2026-10-01), so Wave A is otherwise complete |
| Wave A2 | `[----------]` 0/4 | Found in the Wave A run; MON-8 needs the owner |
| Waves B, D, E | `[----------]` 0% | Wave D needs the owner |
| Wave C | `[##########]` 1/1 | TST-2 done |

## Run calibration (overwritten after each agent run)
Last run: 2026-10-01, Wave A finish (SEC-11, FEA-6, FEA-3, FEA-8, ENG-4, FEA-11, TST-3, PLAN), 8 agents, 1.32M subagent tokens, about 90 min wall-clock (estimate was 1 h 25 min).

| Item | Model | Est. min | Actual min | Est. % of 5-h window | Actual % (token share) |
|---|---|---|---|---|---|
| SEC-11 | Opus | 23–27 | 18.3 | 11–13 | ~6.7 |
| FEA-6 | Opus | 48–58 | 26.9 | 18–22 | ~9.1 |
| FEA-3 | Sonnet | 22 | 19.3 | 5–6 | ~6.7 |
| FEA-8 | Opus | 20 | 34.2 (2 rebases) | 9–11 | ~8.4 |
| ENG-4 | Sonnet | 7 | 8.7 | 2 | ~4.1 |
| FEA-11 | Sonnet | 10 | 11.1 | 3–4 | ~4.6 |
| TST-3 | Sonnet | 20–25 | 16.7 | 7–8 | ~8.0 |
| PLAN.md | Sonnet | 2 | 1.4 | <1 | ~2.9 |
| **Run** | | **85 (75–110)** | **90** | **58–70** | **~54** (weekly meter 2% → 10%) |

The actual % is each agent's share of the measured usage, at about 26k subagent tokens per 1% of the window. The meter cannot split Opus from Sonnet, so Opus items are probably understated and Sonnet items overstated.

**Use these numbers for the next plan**
- **Concurrency is 2 agents on this machine** (4 CPUs, and the workflow cap is CPUs − 2). The third lane waited 18 min. Plan for 2 slots: wall-clock ≈ (sum of agent minutes in the parallel part) / 2 + the serial tail.
- **Minutes per item:** small 9–11, medium 17–19, a multi-part medium with rebases up to 34. A large item split into 8 small decisions took 27 (about 3 min per decision), so don't size an L at 5 min per sub-step. CI is 3–4 min from PR to merge. Each rebase onto a moving `staging` adds 5–7 min.
- **Usage per agent:** there's a fixed floor of about 3% of the window, because an agent spends about 75k tokens just loading the repo (the PLAN.md agent used 77k for 4 tool calls). Small items take 4–5%, medium 6.5–8.5%, a large split item about 9%. Fold tiny items (PLAN.md update, one-file config edits) into a neighbouring item's agent instead of giving them their own.
- **Rebase vs merge:** agents rebase and force-push to catch up with `staging`, but the app's Auto-fix merges `staging` in and never force-pushes, so the two collided on #90. Next run: have agents merge `origin/staging` instead of rebasing (no force-push), or leave Auto-fix off for agent-driven PRs.
- **e2e is not in CI for PRs into `staging`** (ENG-7). After a run that changes UI, run `npm run test:e2e` locally on `staging` before promoting.

