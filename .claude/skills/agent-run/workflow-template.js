export const meta = {
  name: 'agent-run',
  description: 'Run approved backlog items in two lanes, each PR merged to staging on green CI, then fold the change fragments',
  phases: [{ title: 'Lane 1' }, { title: 'Lane 2' }, { title: 'Final' }],
}

const RESULT = {
  type: 'object',
  properties: {
    item: { type: 'string' },
    status: { type: 'string', enum: ['merged', 'pr-open-blocked', 'failed', 'not-started'] },
    prUrl: { type: 'string' },
    merged: { type: 'boolean' },
    testCounts: { type: 'string' },
    summary: { type: 'string' },
    findings: { type: 'string' },
    fixRounds: { type: 'number' },
    catchUps: { type: 'number' },
    notes: { type: 'string' },
  },
  required: ['item', 'status', 'merged', 'summary'],
}

const trailerName = (model) => (model === 'opus' ? 'Opus 5.5' : 'Sonnet 5.5')
const fill = (template, values) => template.replace(/\{\{(\w+)\}\}/g, (_, key) => String(values[key] ?? ''))

const runLane = async (lane, index) => {
  const phaseTitle = `Lane ${index + 1}`
  const out = []
  let stopped = ''
  for (const item of lane) {
    if (stopped) { out.push({ item: item.id, status: 'not-started', merged: false, summary: stopped }); continue }
    if (args.guardOutputTokens != null && budget.spent() >= args.guardOutputTokens) {
      stopped = 'usage guard'
      log(`${phaseTitle}: usage guard reached before ${item.id}; not starting it.`)
      out.push({ item: item.id, status: 'not-started', merged: false, summary: stopped })
      continue
    }
    // The slot always follows the lane, so a missing or wrong value in args cannot fall back to slot 0.
    const prompt = fill(args.brief, { ...item, slot: index + 1, mainCheckout: args.mainCheckout, trailerModel: trailerName(item.model) })
    let r = null
    try {
      r = await agent(prompt, { label: item.id, phase: phaseTitle, isolation: 'worktree', model: item.model, effort: item.effort, schema: RESULT })
    } catch (e) {
      r = { status: 'failed', merged: false, summary: `agent error: ${e && e.message}` }
    }
    const res = { ...(r || { status: 'failed', merged: false, summary: 'agent returned nothing' }), item: item.id }
    out.push(res)
    if (!res.merged) { stopped = `${item.id} ${res.status}`; log(`${phaseTitle}: ${stopped}; stopping this lane.`); continue }
    log(`${phaseTitle}: ${item.id} merged ${res.prUrl || ''}`)
  }
  return out
}

const laneResults = await parallel(args.lanes.map((lane, i) => () => runLane(lane, i)))
const results = laneResults.filter(Boolean).flat()
const merged = results.filter((r) => r.merged).map((r) => r.item)
if (!merged.length) return { results, final: null }

phase('Final')
const finalStep = args.final || { model: 'sonnet', effort: 'low' }
let final
try {
  final = await agent(`Final step of an agent run in this repo. Items merged into staging: ${merged.join(', ')}.
1. git fetch origin && git switch -c claude/run-docs-${merged[0].toLowerCase()} origin/staging --no-track; .claude/skills/agent-run/scripts/link-deps.sh "${args.mainCheckout}".
2. Run e2e once on this staging head on slot 1 (free now that the lanes are done; slot 0 may be the owner's own dev server): env="$(node tests/tools/testSlot.mjs 1)" && eval "$env" && npm run test:e2e. Record the result.
3. Fold every file in docs/04_workflows/changes/ except README.md, following that README: CHANGELOG.md, TESTING.md, the BACKLOG "Status at Milestone 1" line, PLAN.md (strike the items, update the wave bar and "next up"). Delete the folded fragments in the same commit.
4. Commit (message ends with "Co-Authored-By: Claude ${trailerName(finalStep.model)} <noreply@anthropic.com>"), push, gh pr create --base staging (body ends with "🤖 Generated with [Claude Code](https://claude.com/claude-code)"), call mcp__ccd_pr__set_monitor with auto_fix false for it, and DO NOT merge: the review stage adds the calibration and merges.
Return prUrl, the e2e result and anything a fragment said was blocked.`,
  { label: 'Final docs', phase: 'Final', isolation: 'worktree', model: finalStep.model, effort: finalStep.effort,
    schema: { type: 'object', properties: { prUrl: { type: 'string' }, e2e: { type: 'string' }, blocked: { type: 'string' } }, required: ['prUrl', 'e2e'] } })
} catch (e) {
  final = { error: e && e.message }
}
return { results, final: final || { error: 'final agent returned nothing' } }
