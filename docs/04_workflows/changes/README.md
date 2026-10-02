# Change fragments

Used inside a multi-agent run (the `agent-run` skill). Each item writes one fragment instead of editing the shared lines of `CHANGELOG.md`, the BACKLOG status line, `TESTING.md`'s coverage map and `PLAN.md`, so parallel PRs never conflict on them. A single manual session may still edit those files directly.

## File

`docs/04_workflows/changes/<ID>.md`, one per backlog item, for example `FEA-12.md`. Exactly three headings:

    ## Changelog
    - <the bullet exactly as it should appear under "## Unreleased" in CHANGELOG.md, with test counts>

    ## Testing map
    - <each line to add to or change in TESTING.md's coverage map or characterisation register, naming the row>
    - none (if nothing changes)

    ## Status
    done | blocked: <reason> | open: <reason>; tests: unit N, API N, component N, rules N, e2e N

The item still edits its own `### <ID>` section of `BACKLOG.md` directly (separate lines, no conflict).

## Folding

The run's final step, after every item has merged: adds each `## Changelog` bullet under `## Unreleased` in `CHANGELOG.md`, applies each `## Testing map` line to `TESTING.md`, updates the BACKLOG "Status at Milestone 1" line and `PLAN.md` from each `## Status`, then deletes the folded fragments in the same commit. Git history keeps them.
