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

## Milestone 2 scope (frozen 2026-10-04)
Decision [0006](docs/05_decisions/0006-v2-scope-freeze.md). Milestone 2 is this list; nothing joins it except a finding triaged **in-scope** (a v2 defect). Every run's findings are triaged fixed-in-PR / in-scope / after-v2; the agent decides, the owner overrides at review. Details and the After v2 list: [BACKLOG.md, Milestone 2 scope and After v2](docs/04_workflows/BACKLOG.md#milestone-2-scope-and-after-v2).

- [ ] **Group A, code, no live impact (do now):** ENG-5 (remove the release scripts), MON-10 (lines at full price, split in totals only), MON-18 (`totalSqFt` by increment), ENG-3 (hygiene; merged-branch deletion approved), MON-5 (server-side numbering; rules go live with group B)
- [ ] **Group B, live work (parked, one block later):** LIVE-1, LIVE-2 (with the E2/E4 tasks the cutover needs), LIVE-3, LIVE-4, SEC-4, SEC-5, SEC-10, TST-4, ENG-6, LIVE_ROLLOUT rewrite. The live site (`print2frame.xyz`, `portal.print2frame.xyz`) stays on the original repository; the new system goes to preview subdomains first and replaces it later (approach not decided). Pre-flight: find what the owner already changed on the old live site.
- **After v2:** FEA-9, FEA-10, ENG-1, ENG-2. **Closed:** MON-6 (moot, DEC-5).
- **Wave B promotion guard:** SEC-12, SEC-7, SEC-8, FEA-4, FEA-15, FEA-1, MON-4, MON-11, FEA-2, SEC-13, SEC-14, FEA-17, the B4 items (MON-12, MON-14, FEA-18, SEC-15) and every later Wave B item change or rely on `firestore.rules` that are not deployed. Do not promote `staging` to `main` before the LIVE-1 rules deploy, and deploy the app before or together with the rules: an old client's whole-collection `typing_indicators` listener is refused by the SEC-12 rule, and the FEA-1 payout batch is refused by the deployed rules until they are updated. `main` therefore stays behind `staging` while group B is parked.

### Burn-down (one line per run)
v2: 14 open · after-v2: 0

| Date | Run | Closed | Added in-scope | Open A | Open B |
|---|---|---|---|---|---|
| 2026-10-04 | scope freeze | n/a | MON-18 | 5 | 9 |

## Waves (history up to the freeze)
- [x] **Wave A:** MON-1, MON-3, MON-2, SEC-1, SEC-2, SEC-3, SEC-9, TST-1, TST-3, FEA-3, FEA-8, FEA-6, FEA-11, ENG-4, SEC-11 (ENG-5 moved to group A)
- [x] **Wave A2:** MON-8, FEA-12, FEA-13, ENG-7
- [x] **Wave A3:** MON-9, FEA-14
- [x] **Wave A4:** MON-10 moved to group A after the owner's decision
- [x] **Wave B, code + rules built and tested here, live with the next rules deploy:** MON-4, MON-7, FEA-1, FEA-2, FEA-4, FEA-5, FEA-7, SEC-6, SEC-7, SEC-8, SEC-12, FEA-15, FEA-16, MON-11, SEC-13, SEC-14, FEA-17, MON-12, MON-13, MON-14, FEA-18, FEA-19, SEC-15, SEC-16, and the follow-ups MON-15, MON-16, MON-17, FEA-20, FEA-21; TST-5, DOC-LIVE1. MON-5 moved to group A, FEA-9 and FEA-10 to After v2
- [x] **Wave C:** TST-2 (money and RBAC browser journeys)
- **Wave D** became group B; **Wave E** (ENG-1, ENG-2, ENG-6) split between After v2 and group B

## Progress snapshot
| Track | Progress | Notes |
|---|---|---|
| Milestone 1 | `[##########]` 100% | Tagged `v1.0.0` |
| Waves A to C | `[##########]` done | 53 items closed (A 15, A2 4, A3 2, B 31, C 1); rules from Wave B not deployed (group B) |
| Milestone 2 group A | `[----------]` 0/5 | ENG-5, MON-10, MON-18, ENG-3, MON-5 |
| Milestone 2 group B | `[----------]` 0/9 | Parked until group A is done and the cutover approach is decided |

## Run calibration (overwritten after each agent run)
Last run: 2026-10-04, Wave B run B6 (FEA-21, MON-17 on Sonnet·medium; final docs Sonnet·low), one workflow, two lanes, run `wf_8db12555-122`. 3 agents, 324k subagent tokens, launch 13:32, docs PR 13:46 (14 min, estimate 25). Launched over the 80% guard on the owner's override (projected peak 90%). Meter 69% → 77% (+8%, estimate 21%); weekly 91% → 92%. usage-estimate `cost`: $3.71 API-priced (main $2.00, agents $1.71, orchestrator ratio 1.08), which its $0.305/1% rate reads as 12%, against the meter's +8%.

| Item | Model·effort | Est. min | Actual min | Tokens | Fix rounds / catch-ups | Pick outcome |
|---|---|---|---|---|---|---|
| FEA-21 | Sonnet·medium | 14 | 6.6 | 118k | 0 / 0 | sufficient: `resolveQaRecipient` at 3 sites; Final invoice lookup drops the phone fallback (NIC, customerId, leadId only) |
| MON-17 | Sonnet·medium | 10 | 12.6 | 107k | 0 / 1 | sufficient: verified the modal edits no balance field, then dropped `pending`/`settled`/`totalSqFt` |
| Final docs | Sonnet·low | 2 | 1.5 | 98k | n/a | sufficient; no missing fragments; e2e 10/10 |
| **Run** | | **25** | **14** | **324k** | | meter +8% vs 21% |

Flagged (more than 30% off): FEA-21 (−53%), run wall-clock (−44%), usage (−62%). Causes: **estimate model** (S items on Sonnet with an existing helper run nearer 7 min; `estimate --items` prices each item at the B-wave mixed Opus/Sonnet average, so an all-Sonnet S run is over-projected about 2.5×).

**Rolling rates (last 3 runs)**
| Rate | B4 relaunch | B5 | B6 | Use next |
|---|---|---|---|---|
| Mixed subagent tokens per 1% | ~21k | ~26k | ~40k (324k / 8%, Sonnet only) | 23k mixed; ~40k Sonnet-only (one run) |
| API $ per 1% (usage-estimate) | ~$0.305 fit | ~$0.53 | ~$0.46 ($3.71 / 8%) | keep $0.305 until `calibrate` re-checks; B5 and B6 both read higher |
| Agent floor | ~100k | ~103-113k | ~98-118k | 100k |
| S item | 5.6-17 min | 7-24 | 6.6-12.6 | 7-20 min (Sonnet S with a ready helper: ~7-13) |
| M item | 16-54 | 16 | n/a | 16-40 |
| Window % per weekly % | 7.3 | ~8.7 | ~8 (8 / 1) | 7.5 |

Models now differ: B6 was Sonnet-only, B5 mostly Opus; two runs with different mixes exist, but `estimate` still uses one rate.

**Model overrides:** owner changed 0 of 3 picks; overrode the 80% launch guard. All sufficient, 0 fix rounds.

**Tuning**
1. Adopted: P1-P6 (see git history of this section).
2. Adopted 2026-10-04: two-lane runs need no time uplift (B5); not yet: +30% for four emulator lanes (no time model).
3. In progress: statusLine now runs the usage-estimate logger (2026-10-04, chains the previous statusline); `usage.py calibrate` next session once `~/.claude/usage-estimate/meter.jsonl` has readings. B5 cost $0.53 per meter-1% vs the $0.305 fit; B5 follow-up (SEC-16, DOC-LIVE1, final) moved the meter 47% → 62%. B6: meter.jsonl still empty (0 lines) at 13:47, so the desktop statusline passes no `rate_limits`; calibrate cannot run from it.
4. Adopted 2026-10-04: agent-run launches the workflow from a copy of the template in the working directory and the review deletes it (madhuka-m-gamage/Claude#6, global-skills 1.0.1; reaches the installed plugin after that repo's staging → main promotion).
5. Not yet: a per-model rate in `usage.py estimate` (B6 all-Sonnet cost 8% against 21% projected); merging `coverage:all` reports; equal Sonnet·low/medium option costs; review fallback when the final docs PR is already merged.
