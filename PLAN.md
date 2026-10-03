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
Last run: 2026-10-03, Wave B run B3 (MON-4, MON-11, SEC-13, SEC-14 on Opus·medium; FEA-2, FEA-17 Sonnet·medium; final docs Sonnet·medium x2), **two workflows, four lanes** (first use). 8 agents, 1.04M subagent tokens (Opus 551k, Sonnet 493k). Launch 16:02 IST; last docs PR 17:00 (58 min, estimate 45). Run IDs `wf_5d4b2b3d-e63` (A), `wf_36583e25-df0` (B). Meter 22% → 67% (+45%, estimate 40), weekly 48% → 54% (+6). The meter delta includes the orchestrating session (FEA-17 rescue, review); no other app was reported.

| Item | Model·effort | Est. min | Actual min | Est. % | Actual % (21.6k / 54k rates) | Fix rounds / catch-ups | Pick outcome |
|---|---|---|---|---|---|---|---|
| MON-4 | Opus·medium | 27 | 38.9 | ~7.6 | ~7.2 (155k) | 0 / 2 | sufficient: extended `createDocumentIfAbsent` with a guard doc in the same transaction; 3 findings (MON-12, MON-13) |
| MON-11 | Opus·medium | 27 | 26.0 | ~7.6 | ~6.1 (132k) | 0 / 1 | sufficient: per-lead guard doc enforced by rules (`existsAfter` of the payout); 1 finding (MON-14) |
| FEA-2 | Sonnet·medium (owner override of Opus·medium) | 25 | 38.2 | ~4.5 | ~3.2 (174k) | 0 / 1 | sufficient, with a process miss: wrote the rules block before running its rules tests (never saw them fail); 3 findings (FEA-18, FEA-19) |
| FEA-17 | Sonnet·medium | 13 | 9.1 (+~10 review rescue) | ~2.7 | ~2.0 (109k) | 0 / 1 | sufficient; returned pr-open-blocked because `staging` was red (not its fault); the review merged staging in and merged #129 |
| SEC-13 | Opus·medium | 15 | 19.2 | ~6 | ~5.5 (119k) | 0 / 0 | sufficient: no App change needed; 1 finding (SEC-15) |
| SEC-14 | Opus·medium | 15 | 36.8 | ~6 | ~6.7 (145k) | 1 / 2 | sufficient: shared `isReferringPartnerOfLeadId`; its fix round repaired the `staging` break (mock in MON-4's test) |
| Final docs A / B | Sonnet·medium | 3-12 | 2.6 / 1.9 | ~2 each | ~2.0 / 1.9 | n/a | sufficient; both folded every fragment on staging, so A's PR #128 duplicated B's #130 and was closed |
| **Run (to last docs PR)** | | **45** | **58** | **40** | **~35** (rates) / 45 (meter) | | |

Flagged (more than 30% off): MON-4 time (+44%, **scope**: transaction helper extended, 20 new tests, 2 catch-ups), FEA-2 time (+53%, **estimate model**: an L item with three surfaces on Sonnet takes about as long as an Opus M item), SEC-14 time (+145%, **catch-up and CI**: it repaired the staging break). Meter +12% over estimate: **estimate model** (orchestration and the rescue cost about 5%, and Opus may be cheaper per 1% than 21.6k, see below).

**Parallel by function (owner decision, first use):** App.jsx and Partners.jsx edits in different lanes merged with **no textual conflict** (one docs conflict in FIRESTORE_RULES_NOTES, kept both sides). But it produced a **semantic break**: FEA-2 added a `subscribeToQuery` listener to App.jsx, and MON-4's new App test mocked `firestoreSync` without it. Each PR was green on its own branch; MON-4 merged without catching up FEA-2 (GitHub allows a behind branch to merge), so `staging` went red (4 component tests) until SEC-14's fix round. Tuning 9 below.

**Rolling rates (last 3 runs)**
| Rate | B1 (Opus + Sonnet) | B2 (Opus + Sonnet) | B3 (Opus + Sonnet, 4 lanes) | Use next |
|---|---|---|---|---|
| Opus tokens per 1% | about 21.6k (clean) | not measurable | 17-22k (17.3k if Sonnet holds 54k and orchestration was ~4%) | 19k (unconfirmed; recheck in a clean run) |
| Sonnet tokens per 1% | consistent with 54k | not measurable | not separable | 54k |
| Opus M item (medium) | 26-28 min, 163-178k | 13-23 min, 159-168k | 26-39 min, 132-155k | 25-35 min, ~150k (~8%) |
| Opus S item (medium) | 16 min | n/a | 19-37 min, 119-145k (SEC-14 includes a fix round) | 15-20 min, ~120k (~6%) |
| Sonnet L item (medium) | n/a | n/a | 38 min, 174k (FEA-2) | 35-40 min, ~3.5% |
| Sonnet S/M item (medium) | n/a | 12.9 min, 147k | 9 min, 109k | 9-13 min, 2-2.7% |
| Final docs | 5.8 min | 12.3 min (rebuilt a fragment) | 1.9-2.6 min | 2-6 min, ~2% |
| Window % per weekly % | n/a | 8 | 7.5 | 7.5-8 |
| Concurrency | 2 | 2 | 4 (two workflows) | 4 |

**Model overrides:** the owner changed 1 of 7 picks (FEA-2 down from Opus·medium to Sonnet·medium); the six items on the remaining picks were sufficient with 0-1 fix rounds.

**Pick outcomes by task type:** money (M) Opus·medium 3 runs sufficient (FEA-1, MON-4, MON-11); security Opus·medium 6 runs sufficient (SEC-12, SEC-7, SEC-8, FEA-15, SEC-13, SEC-14); design-heavy on Sonnet·medium 1 run sufficient with a tests-first miss (FEA-2); small-ui Sonnet·medium 5 runs sufficient. Security and money have now been sufficient at Opus·medium six and three times against an Opus·high default: proposed policy change P4 below.

**Tuning (adopted = in effect now; not yet = needs the owner or the skill)**
1. Adopted: wall-clock = longest lane + 2-6 (final) + 10-15 (review); with four lanes add about 10 min for cross-lane catch-ups.
2. Adopted: the rolling rates above (Opus 19k per 1% until a clean run confirms it).
3. Process: e2e runs in CI for code PRs into `staging` (ENG-7); CI rounds are 3-11 min.
4. Not yet: merge the `coverage:all` reports (optional).
5. Not yet (skill change): equal Sonnet·low and Sonnet·medium option costs in the cards.
6. Not yet (skill change): a mid-run meter reading for the usage guard.
7. Adopted 2026-10-03: slot run mode and required fragments (#122) worked: no agent sourced files, no fragment was missing.
8. Declined by the owner 2026-10-02: final-step e2e retry and plan notes in the final prompt.
9. Adopted 2026-10-03 (owner approved, P1): before `gh pr merge`, an agent must check `git merge-base --is-ancestor origin/staging HEAD`; if `staging` moved since its last green CI, merge it in, re-run the local checks and wait for CI again. B3's staging break came from merging a behind branch. (The alternative is GitHub branch protection "require branches to be up to date", a repository setting for the owner.)
10. Adopted 2026-10-03 (owner approved, P2): each final step folds only the fragments of its own workflow's merged items, so two workflows never fold the same fragment twice (B3 closed #128 as a duplicate of #130).
11. Adopted 2026-10-03 (owner approved, P3): fix the brief's Docs line from #122 ("it reports them and update your own"), a missing "; then".
12. Adopted 2026-10-03 (owner approved, P4): security and money defaults from Opus·high to Opus·medium (evidence above); Opus·high stays available per row.
13. Watch: the FEA-2 agent (Sonnet) skipped seeing its rules tests fail; the brief already requires it.
14. Not yet (skill change): review fallback when the final docs PR is already merged.
