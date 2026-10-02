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
- [x] **Wave A3, follow-ups found in Wave A2 (repo only):** ~~MON-9~~, ~~FEA-14~~
- [ ] **Wave A4, follow-up found in Wave A3 (repo only):** MON-10 (owner decision first)
- **Wave B promotion guard:** SEC-12, SEC-7 and FEA-1 (and every later Wave B item) change or rely on `firestore.rules` that are not deployed. Do not promote `staging` to `main` before the LIVE-1 rules deploy, and deploy the app before or together with the rules: an old client's whole-collection `typing_indicators` listener is refused by the SEC-12 rule, and the FEA-1 payout batch is refused by the deployed rules until they are updated.
- [ ] **Wave B, code + rules built and tested here, live with the next rules deploy:** MON-4, MON-5, MON-7, ~~FEA-1~~, FEA-2, FEA-4, FEA-5, FEA-7, FEA-9, FEA-10, SEC-6, ~~SEC-7~~, SEC-8, ~~SEC-12~~
- [x] **Wave C, before restrictive rules go live:** ~~TST-2~~ (money and RBAC browser journeys)
- [ ] **Wave D, environment and go-live (owner sittings):** LIVE-2 fresh environment (seed `DEFAULT_PERMISSIONS`, deploy Firestore + Storage rules), LIVE-3 move production here and archive the old repos, LIVE-1, LIVE-4, SEC-4, SEC-5, SEC-10, TST-4
- [ ] **Wave E, code health after tests exist:** ENG-1, ENG-2, ENG-6

## Progress snapshot
| Track | Progress | Notes |
|---|---|---|
| Milestone 1 | `[##########]` 100% | Tagged `v1.0.0` |
| Wave A | `[#########-]` 15/16 | MON-1, MON-3, MON-2, SEC-1, SEC-2, SEC-3, SEC-9, TST-1, TST-3, FEA-3, FEA-8, FEA-6, FEA-11, ENG-4, SEC-11 done; next up: ENG-5 (skipped by owner 2026-10-01), so Wave A is otherwise complete |
| Wave A2 | `[##########]` 4/4 | MON-8, ENG-7, FEA-13, FEA-12 done |
| Wave A4 | `[----------]` 0/1 | MON-10 found in Wave A3; needs the owner |
| Wave A3 | `[##########]` 2/2 | MON-9, FEA-14 done; FEA-15 split out to Wave B; next up: Wave B (needs the rules deploy), Wave D with the owner |
| Wave B | `[##--------]` 3/14 | FEA-1, SEC-7, SEC-12 done (rules not deployed, owner step); next up: MON-4, MON-5, MON-7, FEA-2, FEA-4 and the rest of Wave B |
| Waves D, E | `[----------]` 0% | Wave D needs the owner; ENG-6 re-checked, open until LIVE-3 |
| Wave C | `[##########]` 1/1 | TST-2 done |

## Run calibration (overwritten after each agent run)
Last run: 2026-10-02, Wave B run B1 (SEC-12, SEC-7, FEA-1 on Opus·medium; ENG-6 on Sonnet·low; final docs on Sonnet·medium), the **first Opus measurement**. 5 agents, 669k subagent tokens (Opus 471k, Sonnet 198k), 50.5 min from launch to the docs PR (estimate 32). Run ID `wf_afe59f7b-6c7`. Meter **2% → 29%** in one window (estimate 19-26% + 1%); weekly 31% → 34%. The machine's load average reached about 30 on 4 CPUs during the run, which slowed the e2e runs.

| Item | Model·effort | Est. min | Actual min | Est. % | Actual % | Fix rounds / catch-ups | Pick outcome |
|---|---|---|---|---|---|---|---|
| SEC-12 | Opus·medium (owner override of Opus·high) | 10 | 16.5 | 3-5 | ~6.0 | 0 / 0 | sufficient: found that indicator documents had no participants field and fixed the app side too |
| SEC-7 | Opus·medium (owner override of Opus·high) | 20 | 27.9 | 5-8 | ~8.3 | 0 / 1 | sufficient: found the Register Partner form stored mixed-case emails; extended the editable fields with `company`, `updatedAt` |
| FEA-1 | Opus·medium | 20 | 26.1 | 5-8 | ~7.5 | 0 / 1 | sufficient (diff read by me: eligible-only, cents, one batch, no local change on failure) |
| ENG-6 | Sonnet·low | 8 | 2.1 | 1.7 | ~1.7 | 0 / 0 | sufficient |
| Final docs | Sonnet·medium (owner override of low) | 2 | 5.8 | 1.6 | ~1.9 | n/a | sufficient; 1 e2e timeout under load, rerun clean; did not record the promotion guard (not in its prompt) |
| **Run (to docs PR)** | | **32 (26-42)** | **50.5** | **19-26** | **27** (meter, incl. ~1.5 orchestration) | | |

Flagged (more than 30% off): SEC-12 +65%, SEC-7 +40%, FEA-1 +30%, ENG-6 -74%, final docs +190%, run +58%. Causes: **estimate model** (Opus minutes were taken from the mixed run and are too low; Opus items ran 16-28 min) and **environment** (load average about 30: the final step's e2e timed out once, and my own first rerun failed 2 tests in 9.5 min; a rerun on a quiet machine passed 10/10 in 1.1 min). Usage landed just above the top of the range.

**Opus rates (first measurement, 3 agents at medium effort):** the meter moved 27%; Sonnet agents account for about 3.7% (198k / 54k) and orchestration about 1.5%, leaving about 21.8% for 471k Opus tokens: **about 21.6k Opus subagent tokens per 1% of the 5-hour window** (Sonnet: 54k, so Opus costs about 2.5× per token). S item about 16 min and 6%; M item about 26-28 min and 7.5-8.5%. Opus tool calls: 33 (S), 62-70 (M).

**Rolling rates (last 3 runs)**
| Rate | A2 (Sonnet) | A3 (Sonnet) | B1 (Opus + Sonnet) | Use next |
|---|---|---|---|---|
| Sonnet tokens per 1% | about 54k | not measurable (cap) | consistent with 54k | 54k |
| **Opus tokens per 1%** | n/a | n/a | **about 21.6k** | 21.6k (one run, medium effort) |
| Sonnet small item | 7-14 min, ~1.9% | 7-8 min, ~1.9% | docs 2 min, 1.7% | 7-14 min, 1.9% |
| **Opus S item (medium)** | n/a | n/a | **16.5 min, ~6%** | 14-18 min, 6% |
| **Opus M item (medium)** | n/a | n/a | **26-28 min, 7.5-8.5%** | 25-30 min, 8% |
| Final docs | 2.0 min | 1.6 min | 5.8 min (e2e retry) | 2-6 min, 1.9% |
| CI round (PR to merge) | 3-4 | 3-4 | 3-11 (e2e now in CI) | 4-6 |
| Catch-up | about 4 | none | 2 (both clean merges) | 4-7 |
| Concurrency | 2 | 2 | 2 | 2 |

**Model overrides:** the owner changed 3 of 5 picks (SEC-12 and SEC-7 Opus·high → Opus·medium; final docs Sonnet·low → Sonnet·medium). All three Opus·medium security and money items were sufficient with 0 fix rounds.
**Same-file lane (test goal 2):** SEC-12 and SEC-7 both edited `firestore.rules` in order; SEC-7 started from the merged SEC-12 and had one clean catch-up (for FEA-1 and ENG-6). No conflicts.

**Tuning (adopted = in effect now; not yet = needs the owner or the skill)**
1. Adopted: Sonnet rates for all-Sonnet runs; for Opus use the B1 Opus figures above.
2. Adopted: wall-clock = longest lane + 2-6 (final) + 10 (review).
3-4, 6. Adopted 2026-10-02: peak from measured rates; per-model trailer; `money-small` = Sonnet·medium.
5. Not yet: merge the `coverage:all` reports (optional).
7. Process: e2e runs in CI for code PRs into `staging` (ENG-7); CI rounds are now 3-11 min.
8. Not yet (skill change): equal Sonnet·low and Sonnet·medium option costs in the cards.
9. Not yet (skill change): review fallback when the final docs PR is already merged.
10. Not yet (skill change): a mid-run meter reading for the usage guard.
11. Watch: catch-up when `staging` moved but GitHub shows no conflict.
12. Adopted 2026-10-02 (owner approved): the worktree guard refused `env="$(node tests/tools/testSlot.mjs N)" && eval "$env"`; both lane-1 agents fell back to literal exports. Make the brief write the slot exports to a file and source it (`node tests/tools/testSlot.mjs N > <tmp>/slotN.env && . <tmp>/slotN.env && npm run ...`).
13. Adopted 2026-10-02 (owner approved): put the Opus rates above into SKILL.md "Rates" (replacing the unreliable mixed-run figure).
14. Declined by the owner 2026-10-02: the final step should retry a failing e2e spec once and report the load average, and the workflow template's final prompt should carry plan-specific notes (here: the Wave B promotion guard).
