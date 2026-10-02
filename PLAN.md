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
- [ ] **Wave A2, follow-ups found during Wave A (repo only):** ~~MON-8~~, ~~FEA-12~~, ~~FEA-13~~, ~~ENG-7~~
- [ ] **Wave A3, follow-ups found in Wave A2 (repo only):** MON-9, FEA-14
- [ ] **Wave B, code + rules built and tested here, live with the next rules deploy:** MON-4, MON-5, MON-7, FEA-1, FEA-2, FEA-4, FEA-5, FEA-7, FEA-9, FEA-10, SEC-6, SEC-7, SEC-8, SEC-12
- [x] **Wave C, before restrictive rules go live:** ~~TST-2~~ (money and RBAC browser journeys)
- [ ] **Wave D, environment and go-live (owner sittings):** LIVE-2 fresh environment (seed `DEFAULT_PERMISSIONS`, deploy Firestore + Storage rules), LIVE-3 move production here and archive the old repos, LIVE-1, LIVE-4, SEC-4, SEC-5, SEC-10, TST-4
- [ ] **Wave E, code health after tests exist:** ENG-1, ENG-2, ENG-6

## Progress snapshot
| Track | Progress | Notes |
|---|---|---|
| Milestone 1 | `[##########]` 100% | Tagged `v1.0.0` |
| Wave A | `[#########-]` 15/16 | MON-1, MON-3, MON-2, SEC-1, SEC-2, SEC-3, SEC-9, TST-1, TST-3, FEA-3, FEA-8, FEA-6, FEA-11, ENG-4, SEC-11 done; next up: ENG-5 (skipped by owner 2026-10-01), so Wave A is otherwise complete |
| Wave A2 | `[##########]` 4/4 | MON-8, ENG-7, FEA-13, FEA-12 done |
| Wave A3 | `[----------]` 0/2 | MON-9, FEA-14 found in Wave A2 |
| Waves B, D, E | `[----------]` 0% | Wave D needs the owner |
| Wave C | `[##########]` 1/1 | TST-2 done |

## Run calibration (overwritten after each agent run)
Last run: 2026-10-02, Wave A2 (MON-8, FEA-13, ENG-7, FEA-12 + final docs), the first run with the `agent-run` skill, 5 agents, all Sonnet, 490k subagent tokens, 22.8 min from launch to the docs PR (estimate 45). Run ID `wf_f7dd43a6-d16`. Meter 73% → 83% (5-hour window, estimate +24%); weekly 21% → 23%. The launch was above the skill's 80% rule on the owner's explicit override.

| Item | Model·effort | Est. min | Actual min | Est. % | Actual % (token share) | Fix rounds / catch-ups |
|---|---|---|---|---|---|---|
| MON-8 | Sonnet·low | 15 | 7.9 | 5 | ~2.0 | 0 / 0 |
| FEA-13 | Sonnet·medium | 15 | 13.9 | 5 | ~2.0 | 0 / 1 |
| ENG-7 | Sonnet·low | 12 | 7.4 | 4 | ~1.7 | 0 / 0 |
| FEA-12 | Sonnet·medium | 10 | 6.8 | 4 | ~1.7 | 0 / 0 |
| Final docs | Sonnet·low | 6 | 2.0 | 3 | ~1.7 | n/a |
| Orchestration | Opus | n/a | n/a | 3–4 | ~1 (rest of the 10%) | n/a |
| **Run** | | **45 (38–60)** | **22.8** | **24 (19–32)** | **~10** (meter) | |

Flagged (more than 30% off, all one cause: **estimate model**, the rates came from a run with Opus and medium-effort items): every item took 5–45% fewer minutes and 50–60% less of the window than estimated. Nothing was slower than planned. Time from PR creation to merge: 3–4 min (one 8 min with a catch-up merge).

**Rolling rates (2 runs; Sonnet is now separable from the mixed run)**
| Rate | Run 2026-10-01 (mixed) | Run 2026-10-02 (Sonnet only) | Use next |
|---|---|---|---|
| Minutes, small item (S) | 9–19 | 7–14 | Sonnet S: 7–14; mixed or Opus S: 9–19 |
| Minutes, final docs step | 1.4 | 2.0 | 2 |
| Minutes, CI round | 3–4 | 3–4 (e2e job 2.8) | 3–4; with e2e in CI up to 5 |
| Minutes, catch-up | 5–7 | about 4 (clean merge) | 4–7 |
| Subagent tokens per 1% of the 5-hour window | about 26k (derived, mixed) | **about 54k (measured, Sonnet)** | Sonnet 54k; the mixed figure is unreliable. The Opus rate is not yet separable (no Opus in this run) |
| Window % per Sonnet agent (floor) | about 3 | **about 1.7** (about 90k tokens even for 14 tool calls) | 1.7 + about 0.1 per extra 10k tokens |
| Weekly % per 1% of window | 8 / 54 | 2 / 10 | about 0.2 |
| Concurrency | 2 | 2 | 2 |

**Model overrides:** the owner changed 2 of 5 picks, both downwards (MON-8 Opus·high → Sonnet·low; ENG-7 Sonnet·medium → Sonnet·low). MON-8 (money path) on Sonnet·low needed 0 fix rounds and a correct helper on review (one data point only).

**Tuning (adopted = in effect now; not yet = needs the owner or the skill)**
1. Adopted: use the Sonnet rates above for all-Sonnet runs; use the mixed run for any run with Opus until an Opus-only run exists.
2. Adopted: wall-clock for lanes of small Sonnet items is about (sum of item minutes) / 2 + 2 (final) + 10 (review).
3. Adopted 2026-10-02 (owner approved; rates are now in SKILL.md and the peak is computed from them): the 80% projected-peak rule uses a flat 3% per agent; with measured rates the same run is about 10%. Compute the projected peak from the rates table, and add the Sonnet and mixed rates to the skill's SKILL.md so the first plan of a run is not calibrated from PLAN.md alone.
4. Adopted 2026-10-02 (the brief takes the model from the item): the agent brief hardcoded the commit trailer; this run overrode it in `args.brief` to match the model. Make the trailer `{{trailerModel}}` in `agent-brief.md`.
5. Not yet: `coverage:all` writes separate unit/API and component reports (13.54% and 43.33% statements); merging them is optional, not scheduled.
6. Adopted 2026-10-02 (owner approved, one data point): new task type `money-small` defaults to Sonnet·medium; `money` with several decisions or new rules stays Opus·high.
7. Process: `coverage` runs and the e2e CI job now run for code PRs into `staging`; PRs that only touch docs skip them. The final docs step still runs e2e locally on slot 1 before the review.
