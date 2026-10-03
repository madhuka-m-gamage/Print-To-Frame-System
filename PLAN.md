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
- [ ] **Wave B, code + rules built and tested here, live with the next rules deploy:** ~~MON-4~~, MON-5, ~~MON-7~~, ~~FEA-1~~, ~~FEA-2~~, ~~FEA-4~~, ~~FEA-5~~, ~~FEA-7~~, FEA-9, FEA-10, SEC-6, ~~SEC-7~~, ~~SEC-8~~, ~~SEC-12~~, ~~FEA-15~~, ~~FEA-16~~, ~~MON-11~~, ~~SEC-13~~, ~~SEC-14~~, ~~FEA-17~~, ~~MON-12~~, ~~MON-13~~, ~~MON-14~~, ~~FEA-18~~, ~~FEA-19~~, ~~SEC-15~~
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
| Wave B | `[########--]` 22/26 | FEA-1, SEC-7, SEC-12, SEC-8, FEA-4, FEA-15, FEA-16, MON-4, MON-11, FEA-2, SEC-13, SEC-14, FEA-17, MON-12, MON-13, FEA-5, MON-14, FEA-19, FEA-18, FEA-7, MON-7, SEC-15 done (rules not deployed, owner step); next up: MON-5, SEC-6, FEA-9, FEA-10 |
| Waves D, E | `[----------]` 0% | Wave D needs the owner; ENG-6 re-checked, open until LIVE-3 |
| Wave C | `[##########]` 1/1 | TST-2 done |

## Run calibration (overwritten after each agent run)
Last run: 2026-10-03, Wave B run B4 (MON-12, MON-14, SEC-15 on Opus·medium; MON-13, FEA-5, FEA-19, FEA-18, FEA-7, MON-7 Sonnet·medium; final docs Sonnet·medium x2), two workflows, four lanes. First launch 20:30 (runs `wf_590e0d48-25f`, `wf_76323422-c3c`) lost to a power-off at about 21:00 with nothing committed (meter 0% → 31%); the four first-in-lane diffs were saved as patches and the relaunch (21:09, `wf_87a485a1-6bf`, `wf_471c46ed-fcf`) resumed from them. Relaunch: 11 agents, 1.37M subagent tokens (Opus 394k, Sonnet 980k), last docs PR 22:29 (80 min, estimate 60). Meter 31% → 97% (+66%, estimate 47%); weekly 62% → 71%. Whole B4 including the lost launch: about 97% of one window.

| Item | Model·effort | Est. min | Actual min | Tokens | Fix rounds / catch-ups | Pick outcome |
|---|---|---|---|---|---|---|
| MON-12 | Opus·medium | 18 | 27.4 | 132k | 0 / 1 | sufficient: guard hand-over checked in the transaction and the rules (get/exists before, existsAfter for the new invoice) |
| MON-13 | Sonnet·medium | 10 | 15.6 | 114k | 0 / 1 | sufficient |
| FEA-5 | Sonnet·medium | 20 | 25.3 | 156k | 0 / 2 | sufficient: added `salesOwnerEmail` at lead conversion (no owner field existed) |
| MON-14 | Opus·medium | 18 | 16.6 | 108k | 0 / 0 | sufficient: no rules change needed; did not switch Auto-fix off (judged the tool owner-only) |
| FEA-19 | Sonnet·medium | 10 | 5.6 | 101k | 0 / 0 | sufficient |
| FEA-18 | Sonnet·medium | 12 | 37.6 | 109k | 0 / 1 | sufficient; reused the patch, fixed its toast mock; time includes waiting on load |
| FEA-7 | Sonnet·medium | 20 | 24.0 | 161k | 0 / 1 | sufficient: only commission-cleared and deal-fully-settled stay notifications |
| MON-7 | Sonnet·medium | 18 | 16.8 | 133k | 0 / 1 | sufficient: the default is applied in `LeadCardDetails.jsx`, not QuotationBuilder |
| SEC-15 | Opus·medium | 30 | 54.2 | 154k | 0 / 2 | sufficient: `registrationDrafts/{uid}` holds the form until verification |
| Final docs A / B | Sonnet·medium | 2-6 | 2.0 / 1.7 | 102k / 104k | n/a | sufficient; P2 worked (disjoint fragments) |
| **Run (relaunch)** | | **60** | **80** | **1.37M** | | meter +66% vs 47% |

Flagged (more than 30% off): MON-12 (+52%), MON-13 (+56%), FEA-18 (+213%), SEC-15 (+81%), run wall-clock (+33%) and usage (+40%). Causes: **environment** (load average 9-11 with four lanes of emulators: rules setup hooks timed out at 10 s and were re-run, FEA-18 and SEC-15 waited on reruns) and **estimate model** (the per-model token rates below).

**P1 (catch up before merge) worked:** 9 items, 13 catch-ups, no `staging` break; the combined `staging` passes the full suite. **P2 worked:** the two docs PRs folded disjoint fragments; only the shared summary lines conflicted, resolved in the review.

**Rolling rates (last 3 runs)**
| Rate | B2 | B3 | B4 relaunch | Use next |
|---|---|---|---|---|
| Mixed subagent tokens per 1% of the window | not measurable | about 23k (1.04M / 45%) | about 21k (1.37M / 66%) | **21k for every model** (the per-model split below no longer fits) |
| Opus vs Sonnet per token | 2.5x (B1) | not separable | not separable (Sonnet at 54k would leave Opus at 9k, implausible) | treat as equal until a single-model run measures them |
| Agent floor | ~90k tokens | ~100k | ~100k (final docs 102-104k) | 100k = ~5% per agent |
| S item | 7-9 min | 9-19 min | 5.6-17 min | 10-17 min |
| M item | 13-39 min | 26-39 min | 16-54 min | 20-40 min; add 30% with four emulator lanes |
| Window % per weekly % | 8 | 7.5 | 7.3 | 7.5 |

**Model overrides:** none (all 10 picks taken); all sufficient with 0 fix rounds.

**Tuning (adopted = in effect now; not yet = needs the owner or the skill)**
1. Adopted: P1-P4 (#131); they worked as intended.
2. Adopted: plan usage with the mixed rate, about 21k subagent tokens per 1% and about 5% floor per agent; a 9-item, 11-agent run is about 65% of a window.
3. Adopted (P5, replaced by the user-level `usage-estimate` skill, 2026-10-04): `agent-run` Rates now call it: one rate of $0.305 per 1% in API-priced dollars (±10%, 18 meter gaps), no per-model split. Check: its 9-item estimate is 94% against B4's measured 97% (including the lost launch). Not yet: the +30% for four emulator lanes (no time model yet).
4. Not yet (skill change, P6): raise the rules test `hookTimeout` (vitest config for `test:rules`) to 60 s, since `setupRulesEnv` times out at 10 s under four-lane load (MON-12, SEC-15).
5. Not yet (skill change, P7): the brief should say `mcp__ccd_pr__set_monitor` is authorised by the owner for the agent's own PR (MON-14 skipped it as not user-requested).
6. Watch: a power-off loses only uncommitted agent work; saving each interrupted diff and pointing the relaunch at it worked (MON-12, MON-14, FEA-18, SEC-15 all reused theirs).
7. Not yet: merge the `coverage:all` reports (optional); equal Sonnet·low/medium option costs; a mid-run meter reading; review fallback when the final docs PR is already merged.
