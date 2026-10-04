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
- **Wave B promotion guard:** SEC-12, SEC-7, SEC-8, FEA-4, FEA-15, FEA-1, MON-4, MON-11, FEA-2, SEC-13, SEC-14, FEA-17 and the B4 items (MON-12, MON-14, FEA-18, SEC-15) (and every later Wave B item) change or rely on `firestore.rules` that are not deployed. Do not promote `staging` to `main` before the LIVE-1 rules deploy, and deploy the app before or together with the rules: an old client's whole-collection `typing_indicators` listener is refused by the SEC-12 rule, and the FEA-1 payout batch is refused by the deployed rules until they are updated.
- [ ] **Wave B, code + rules built and tested here, live with the next rules deploy:** ~~MON-4~~, MON-5, ~~MON-7~~, ~~FEA-1~~, ~~FEA-2~~, ~~FEA-4~~, ~~FEA-5~~, ~~FEA-7~~, FEA-9, FEA-10, ~~SEC-6~~, ~~SEC-7~~, ~~SEC-8~~, ~~SEC-12~~, ~~FEA-15~~, ~~FEA-16~~, ~~MON-11~~, ~~SEC-13~~, ~~SEC-14~~, ~~FEA-17~~, ~~MON-12~~, ~~MON-13~~, ~~MON-14~~, ~~FEA-18~~, ~~FEA-19~~, ~~SEC-15~~
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
| Wave A3 | `[##########]` 2/2 | MON-9, FEA-14 done; FEA-15 split out to Wave B and now done; next up: Wave B (needs the rules deploy), Wave D with the owner |
| Wave B | `[#########-]` 23/26 | FEA-1, SEC-7, SEC-12, SEC-8, FEA-4, FEA-15, FEA-16, MON-4, MON-11, FEA-2, SEC-13, SEC-14, FEA-17, MON-12, MON-13, FEA-5, MON-14, FEA-19, FEA-18, FEA-7, MON-7, SEC-15, SEC-6 done, plus the B5 follow-ups MON-15, MON-16, FEA-20 (rules not deployed, owner step); next up: MON-5, FEA-9, FEA-10 |
| Waves D, E | `[----------]` 0% | Wave D needs the owner; ENG-6 re-checked, open until LIVE-3 |
| Wave C | `[##########]` 1/1 | TST-2 done |

## Run calibration (overwritten after each agent run)
Last run: 2026-10-04, Wave B run B5 (MON-15, SEC-6, FEA-20 on Opus·medium; MON-16 Sonnet·medium; final docs Sonnet·medium), one workflow, two lanes, run `wf_ce3ddd03-5bd`. 5 agents, 671k subagent tokens, launch 11:58, docs PR 12:38 (42 min, estimate 65). Meter 21% → 47% (+26%, estimate 48%); weekly 85% → 88%. usage-estimate `cost`: $13.7 API-priced (main $4.05, agents $9.66, orchestrator ratio 0.42), which its $0.305/1% rate reads as 45%, against the meter's +26%.

| Item | Model·effort | Est. min | Actual min | Tokens | Fix rounds / catch-ups | Pick outcome |
|---|---|---|---|---|---|---|
| MON-15 | Opus·medium | 22 | 24.3 | 147k | 0 / 2 | sufficient: rules `pending >= 0` only when pending changes; accrual by `increment(roundCents)`; found MON-17 |
| SEC-6 | Opus·medium | 40 | 16.0 | 184k | 0 / 0 | sufficient: one helper in all 6 write paths; get allowed, list refused; noted a Partner cannot create its own mirror (staff save first) |
| FEA-20 | Opus·medium (owner override of Sonnet·medium) | 15 | 10.4 | 124k | 0 / 0 | sufficient, possibly over-spec'd; found F-12 (other NIC-only lookups) |
| MON-16 | Sonnet·medium | 12 | 7.2 | 103k | 0 / 0 | sufficient |
| Final docs | Sonnet·medium | 3 | 1.6 | 113k | n/a | sufficient; no missing fragments; e2e 10/10 |
| **Run** | | **65** | **42** | **671k** | | meter +26% vs 48% |

Flagged (more than 30% off): SEC-6 (−60%), FEA-20 (−31%), MON-16 (−40%), run wall-clock (−35%), usage (−46%). Causes: **environment** (two lanes, no emulator contention; P6 timeout raised) and **estimate model** (S/M minute rates from four-lane runs; dollar rate disagrees with the meter this run).

**Rolling rates (last 3 runs)**
| Rate | B3 | B4 relaunch | B5 | Use next |
|---|---|---|---|---|
| Mixed subagent tokens per 1% | ~23k | ~21k | ~26k (671k / 26%) | 23k |
| API $ per 1% (usage-estimate) | n/a | ~$0.305 fit | ~$0.53 ($13.7 / 26%) | keep $0.305 until `calibrate` re-checks; B5 is one outlier |
| Agent floor | ~100k | ~100k | ~103-113k | 100k |
| S item | 9-19 min | 5.6-17 | 7-24 | 7-20 min |
| M item | 26-39 | 16-54 | 16 (SEC-6) | 16-40; +30% with four emulator lanes |
| Window % per weekly % | 7.5 | 7.3 | ~8.7 (26 / 3) | 7.5 |

**Model overrides:** owner changed 2 of 5 picks (FEA-20 small-ui → Opus·medium; final docs Sonnet·low → Sonnet·medium). All sufficient, 0 fix rounds.

**Tuning**
1. Adopted: P1-P6 (see git history of this section).
2. Not yet: +30% for four emulator lanes; two-lane runs need no uplift (B5).
3. Not yet: re-run `usage.py calibrate`; B5 cost $0.53 per meter-1% vs the $0.305 fit.
4. Not yet: the workflow tool refuses a `scriptPath` in the plugin cache; the orchestrator copied the template into the working tree. Skill fix proposed.
5. Not yet: merging `coverage:all` reports; equal Sonnet·low/medium option costs; review fallback when the final docs PR is already merged.
