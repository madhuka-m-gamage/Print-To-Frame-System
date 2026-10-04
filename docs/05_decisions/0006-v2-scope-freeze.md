# 0006: Milestone 2 ("v2") scope freeze

Status: accepted, 2026-10-04. The list itself is in `PLAN.md` ("Milestone 2 scope") and `docs/04_workflows/BACKLOG.md` ("Milestone 2 scope and After v2").

## Context

Milestone 1 closed on a fixed list (`v1.0.0`, 2026-09-27). Since then every agent run has found follow-ups, and each one was added to the open waves, so the backlog grew about as fast as it shrank (Wave B reached 32 items, many of them follow-ups found by earlier items). Without a fixed list there is no point at which Milestone 2 is done.

The live site (`print2frame.xyz`, `portal.print2frame.xyz`) is a separate, already-built deployment of the original repository and keeps running unchanged. The new system will first go to separate preview subdomains and replace the old site only after it is satisfactory; how that cutover happens is not decided yet. The owner sees risk in setting up those deployments while code items are still open.

## Decisions

1. **Freeze.** Milestone 2 is the list of items open on 2026-10-04, minus the ones moved to "After v2", plus MON-18. Nothing else joins it.
2. **Two groups.** Group A (code, no live impact) runs first. Group B (LIVE-1..4, SEC-4, SEC-5, SEC-10, TST-4, ENG-6, the LIVE-2 code tasks and the LIVE_ROLLOUT rewrite) is parked and done later as one block, once the cutover approach is decided.
3. **After v2:** FEA-9, FEA-10 (new features, not go-live blockers), ENG-1 (large, no user-visible change, conflicts with every other PR), ENG-2 (depends on ENG-1). Closed: MON-6 (moot under DEC-5).
4. **Owner answers recorded with the freeze:** ENG-5 removes the two release scripts; MON-10 shows each invoice line at full price with 75% / 25% only in the totals; MON-18 added; ENG-3 may delete merged `claude/*` branches.
5. **Finding triage.** Every finding raised during a run is put in exactly one bucket:
   - **fixed-in-PR:** small and inside the item's own change; fixed there.
   - **in-scope:** a defect in v2 code or behaviour that v2 must not ship with; gets a backlog ID and joins the freeze list.
   - **after-v2:** everything else (improvements, new features, hardening that can wait); goes to "After v2" in BACKLOG.
   The agent decides the bucket; the owner overrides at review.
6. **Burn-down.** Each run's review adds one line to the burn-down in `PLAN.md`: date, run, items closed, items added in-scope, open count.

## Why

A fixed list gives Milestone 2 an end. The triage rule keeps genuine defects in scope without letting improvements reopen it, and the burn-down line makes any growth visible run by run. Parking the LIVE group keeps the risky environment work out of the way until the code it would deploy is finished.
