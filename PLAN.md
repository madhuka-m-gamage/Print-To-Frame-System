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
Keep the x0.25 invoice print scaling; lead stage advance stays manual; Managers may administer users (not Admins, not their own role); `users` readable by Admin, self, or roles with `agents:view` / `messages:view`; the Final-invoice guard is `getExistingFinalInvoice` plus the server-side `invoice_guards` document (MON-4, rules not deployed); live data is test data and a fresh environment is planned (DEC-5); default permissions everywhere (DEC-7).

## How each item runs
One item per fresh session: branch `claude/<topic>` from `staging` → tests first (seen failing) → change → `npm run lint`, `npm run test:all`, `npm run build` (+ `npm run test:e2e` when visible) → docs, module `CLAUDE.md` and `CHANGELOG.md` in the same PR → PR into `staging` → promote to `main` by PR with a merge commit when the owner says so. Live actions (rules deploys, `settings/permissions`, Vercel/Firebase config) only with the owner's go at that moment. Full detail: [GIT_WORKFLOW.md](docs/04_workflows/GIT_WORKFLOW.md), [TESTING.md](docs/04_workflows/TESTING.md).

## Roadmap to Milestone 2
- [ ] **Wave A, repo only, no live impact:** ~~MON-1~~, ~~MON-3~~, ~~MON-2~~, ~~SEC-1~~, ~~SEC-2~~, ~~SEC-3~~, ~~SEC-9~~, ~~TST-1~~, ~~TST-3~~, ~~FEA-3~~, ~~FEA-8~~, ~~FEA-6~~, ~~FEA-11~~, ~~ENG-4~~, ~~SEC-11~~ (deactivated-user sign-in), ENG-5 (skipped by owner 2026-10-01)
- [ ] **Wave A2, follow-ups found during Wave A (repo only):** ~~MON-8~~, ~~FEA-12~~, ~~FEA-13~~, ~~ENG-7~~
- [x] **Wave A3, follow-ups found in Wave A2 (repo only):** ~~MON-9~~, ~~FEA-14~~
- [ ] **Wave A4, follow-up found in Wave A3 (repo only):** MON-10 (owner decision first)
- **Wave B promotion guard:** SEC-12, SEC-7, SEC-8, FEA-4, FEA-15 and FEA-1 (and every later Wave B item) change or rely on `firestore.rules` that are not deployed. Do not promote `staging` to `main` before the LIVE-1 rules deploy, and deploy the app before or together with the rules: an old client's whole-collection `typing_indicators` listener is refused by the SEC-12 rule, and the FEA-1 payout batch is refused by the deployed rules until they are updated.
- [ ] **Wave B, code + rules built and tested here, live with the next rules deploy:** ~~MON-4~~, MON-5, MON-7, ~~FEA-1~~, ~~FEA-2~~, ~~FEA-4~~, FEA-5, FEA-7, FEA-9, FEA-10, SEC-6, ~~SEC-7~~, ~~SEC-8~~, ~~SEC-12~~, ~~FEA-15~~, ~~FEA-16~~, ~~MON-11~~, ~~SEC-13~~
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
| Wave B | `[######----]` 11/18 | FEA-1, SEC-7, SEC-12, SEC-8, FEA-4, FEA-15, FEA-16, MON-4, MON-11, FEA-2, SEC-13 done (rules not deployed, owner step); next up: MON-5, MON-7, FEA-5 and the rest of Wave B |
| Waves D, E | `[----------]` 0% | Wave D needs the owner; ENG-6 re-checked, open until LIVE-3 |
| Wave C | `[##########]` 1/1 | TST-2 done |

## Run calibration (overwritten after each agent run)
Last run: 2026-10-02, Wave B run B2 (SEC-8, FEA-15 on Opus·medium; FEA-4 Sonnet·medium, FEA-16 Sonnet·low; final docs Sonnet·medium), one workflow, 2 lanes. 5 agents, 677k subagent tokens (Opus 327k, Sonnet 351k), 48.5 min from launch to the docs PR (estimate 50). Run ID `wf_1576bff8-844`. Meter 57% → 89% (+32%, estimate 23-25%); weekly 38% → 42%. **The meter delta is not a clean measurement this time:** the owner was running another agent in a different application during the run, so the window also counts that usage. Per-item % below use the B1 rates (Opus 21.6k, Sonnet 54k tokens per 1%).

| Item | Model·effort | Est. min | Actual min | Est. % | Actual % (rates) | Fix rounds / catch-ups | Pick outcome |
|---|---|---|---|---|---|---|---|
| SEC-8 | Opus·medium | 27 | 23.2 | ~8 | ~7.8 | 0 / 1 | sufficient: found invoices have no partner field and scoped them through the lead (rules get()); kept the leads read under Firestore's expression limit |
| FEA-15 | Opus·medium (owner override of Sonnet·medium) | 20 | 12.9 | 6-8 | ~7.4 | 0 / 0 | sufficient, likely over-spec'd on time (13 min) but it found a pendingUsers uid gap (SEC-13) |
| FEA-4 | Sonnet·medium | 15 | 12.9 | ~3 | ~2.7 | 0 / 0 | sufficient |
| FEA-16 | Sonnet·low | 8 | 7.0 | ~1.9 | ~1.8 | 0 / 0 | sufficient, but wrote no change fragment (the final step reconstructed it from the commit) |
| Final docs | Sonnet·medium | 3 | 12.3 | ~1.9 | ~2.0 | n/a | sufficient; slower because it rebuilt FEA-16's fragment and ran e2e |
| **Run (to docs PR)** | | **50** | **48.5** | **23-25** | **~22** (rates) / 32 (meter, includes other usage) | | |

Flagged (more than 30% off): FEA-15 time (-36%) and the final step (+310%). Causes: **scope** (final step rebuilt a missing fragment) and **estimate model** (FEA-15 was smaller than SEC-8). Wall-clock was on estimate.

**Parallel rules by block (owner decision, first use):** lane 1 changed the leads, invoices and customers blocks while lane 2 added `settings/fleet`; SEC-8's catch-up merged FEA-4's rules **with no conflict**, and the `EXPECTED_RULE_CHANGES` list needed no entries. The policy worked.

**Rolling rates (last 3 runs)**
| Rate | A3 (Sonnet) | B1 (Opus + Sonnet) | B2 (Opus + Sonnet) | Use next |
|---|---|---|---|---|
| Opus tokens per 1% | n/a | about 21.6k (clean) | not measurable (other usage in the window) | 21.6k |
| Sonnet tokens per 1% | capped | consistent with 54k | not measurable | 54k |
| Opus M item (medium) | n/a | 26-28 min, 163-178k tokens | 13-23 min, 159-168k tokens | 13-28 min, ~165k tokens (~7.6%) |
| Sonnet M item (medium) | n/a | n/a | 12.9 min, 147k tokens (~2.7%) | 13 min, 2.7% |
| Sonnet S item | 7-8 min | docs 2 min | 7 min, 97k | 7-8 min, 1.8% |
| Final docs | 1.6 min | 5.8 min | 12.3 min (rebuilt a fragment) | 3-12 min, ~2% |
| Concurrency | 2 | 2 | 2 | 2 per workflow; 4 with two workflows |

**Model overrides:** the owner moved FEA-15 up (Sonnet·medium → Opus·medium) and final docs to Sonnet·medium. All picks were sufficient with 0 fix rounds.

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
15. Adopted 2026-10-03 (owner approved): the worktree guard also refused sourcing the slot file (`. /tmp/p2f-slotN.env`); both lane-1 agents passed the slot values inline instead. Give `tests/tools/testSlot.mjs` a run mode, `node tests/tools/testSlot.mjs N -- npm run test:rules`, that starts the command with the slot environment itself (no shell sourcing, no command substitution), and use it in the brief.
16. Adopted 2026-10-03 (owner approved): FEA-16's agent skipped its change fragment. The brief should state that the fragment is required even for a one-line fix, and the final step should list items with no fragment instead of reconstructing them silently.
17. Watch (from B2): SEC-8 merged after `staging` moved (FEA-16 had merged); no CI ran on the exact combined tree. The review ran the full suite on the staging head instead. CI does not run on pushes to `staging`, only on PRs.
