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
Last run: 2026-10-02, Wave A3 (MON-9, FEA-14 + final docs), 3 agents, all Sonnet, 287k subagent tokens, 9.7 min from launch to the docs PR (estimate 14, 25 with the review). Run ID `wf_fb2b7124-155`. Meter 94% → 100% (estimate +7%; the reading is capped at 100, so the true use is unknown, 5.3% by token share); weekly 24% → 25%. The launch was above the skill's 80% rule on the owner's override; the run did not pause. The final docs PR (#108) was merged before this review, so the calibration came in a separate PR.

| Item | Model·effort | Est. min | Actual min | Est. % | Actual % (token share) | Fix rounds / catch-ups | Pick outcome |
|---|---|---|---|---|---|---|---|
| MON-9 | Sonnet·low (owner override of Sonnet·medium) | 12 | 8.1 | 2.0-2.4 | ~1.9 | 0 / 0 | sufficient |
| FEA-14 | Sonnet·medium | 10 | 7.3 | 2.0 | ~1.9 | 0 / 0 | sufficient |
| Final docs | Sonnet·low | 2 | 1.6 | 1.7 | ~1.6 | n/a | sufficient |
| **Run (to docs PR)** | | **14** | **9.7** | **~6** | **5.3** (tokens) | | |

Flagged (more than 30% off): MON-9 time (-33%) and the run total (-31%). One cause: **estimate model**. I sized the items from the Wave A2 averages; two small Sonnet items in parallel took about 8 min each. Nothing was slower or costlier than estimated.

**Rolling rates (3 runs)**
| Rate | 2026-10-01 (mixed) | 2026-10-02 A2 (Sonnet) | 2026-10-02 A3 (Sonnet) | Use next |
|---|---|---|---|---|
| Minutes, small item | 9-19 | 7-14 | **7-8** | Sonnet S: 7-14 (7-8 when the file list is exact and the test plan names the files) |
| Minutes, final docs | 1.4 | 2.0 | 1.6 | 2 |
| Minutes, CI round | 3-4 | 3-4 | 3-4 (PR create to merge 3-4) | 3-4; up to 5 with e2e |
| Minutes, catch-up | 5-7 | about 4 | none needed | 4-7 |
| Subagent tokens per small item | n/a | 91-109k | **100-102k** (20-23 tool calls) | 100k |
| Floor (final docs, 10 tool calls) | about 75k | 91k | 84k | about 85k = 1.6% |
| Subagent tokens per 1% of the window | about 26k (derived) | about 54k (measured) | not measurable (meter capped at 100%) | 54k |
| Concurrency | 2 | 2 | 2 | 2 |

**Model overrides:** the owner changed 1 of 3 picks (MON-9 Sonnet·medium → Sonnet·low) and answered the open decision for FEA-14 (userId link deferred, FEA-15). Across Wave A2 and A3 the owner moved 3 of 8 picks, all downwards.
**Cost of effort level:** Sonnet·low (MON-9: 101.8k tokens, 8.1 min) and Sonnet·medium (FEA-14: 100.5k tokens, 7.3 min) cost the same within noise on these small items. The cards' option costs (2.0% vs 2.4%) overstated the difference.

**Tuning (adopted = in effect now; not yet = needs the owner or the skill)**
1. Adopted: Sonnet rates above for all-Sonnet runs; the mixed run for any run with Opus until an Opus-only run exists.
2. Adopted: wall-clock for lanes of small Sonnet items is about (longest lane) + 2 (final) + 10 (review); two items in parallel ran 8 + 2 min.
3. Adopted 2026-10-02: projected peak computed from the measured rates (SKILL.md "Rates").
4. Adopted 2026-10-02: the commit trailer follows the item's model (`{{trailerModel}}`).
5. Not yet: `coverage:all` writes separate unit/API and component reports; merging them is optional, not scheduled.
6. Adopted 2026-10-02 (owner approved): `money-small` defaults to Sonnet·medium. Evidence now 2 runs of Sonnet·low with 0 fix rounds, but low and medium cost the same, so medium stays as free insurance.
7. Process: `coverage` and the e2e CI job run for code PRs into `staging` (ENG-7); the final docs step still runs e2e locally on slot 1.
8. Not yet (skill change, needs approval): card option costs for Sonnet·low and Sonnet·medium should be equal (about 1.9% each for a small item) until a larger item shows a difference; keep the risk text.
9. Not yet (skill change): `review-checklist.md` step 5 assumes the final docs PR is still open. It was merged before the review this time. Add: if it is merged, open a new review PR into `staging`; or make the final step leave a marker so a merge is not mistaken for approval of the review.
10. Not yet (skill change): the usage guard needs a mid-run meter reading. The plan said I would read the meter when the first item merges, but the workflow only reports at the end, so I could not. The reading at the end is capped at 100%. Options: poll the meter with a Monitor during the run, or add a meter check between lane items.
11. Watch (no change yet): both items merged with a green CI while `origin/staging` had moved, with no catch-up merge and no problem; the brief's "catch up if staging moved" rule is stricter than needed when GitHub reports no conflict.
12. Watch: the MON-9 agent reported that shell heredocs were blocked in its worktree; it used another way to write files. No cost measured.
