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

const fill = (template, values) => template.replace(/\{\{(\w+)\}\}/g, (_, key) => String(values[key] ?? ''))

const runLane = async (lane, index) => {
  const phaseTitle = `Lane ${index + 1}`
  const out = []
  for (const item of lane) {
    if (args.guardOutputTokens != null && budget.spent() >= args.guardOutputTokens) {
      log(`${phaseTitle}: usage guard reached before ${item.id}; not starting it.`)
      out.push({ item: item.id, status: 'not-started', merged: false, summary: 'usage guard' })
      break
    }
    const prompt = fill(args.brief, { ...item, mainCheckout: args.mainCheckout })
    const r = await agent(prompt, { label: item.id, phase: phaseTitle, isolation: 'worktree', model: item.model, effort: item.effort, schema: RESULT })
    const res = r || { item: item.id, status: 'failed', merged: false, summary: 'agent returned nothing' }
    out.push(res)
    if (!res.merged) { log(`${phaseTitle}: ${item.id} ${res.status}; stopping this lane.`); break }
    log(`${phaseTitle}: ${item.id} merged ${res.prUrl || ''}`)
  }
  return out
}

const laneResults = await parallel(args.lanes.map((lane, i) => () => runLane(lane, i)))
const results = laneResults.filter(Boolean).flat()
const merged = results.filter((r) => r.merged).map((r) => r.item)
if (!merged.length) return { results, final: null }

phase('Final')
const final = await agent(`Final step of an agent run in this repo. Items merged into staging: ${merged.join(', ')}.
1. git fetch origin && git switch -c claude/run-docs-${merged[0].toLowerCase()} origin/staging --no-track; .claude/skills/agent-run/scripts/link-deps.sh "${args.mainCheckout}".
2. Run npm run test:e2e once on this staging head (slot 0); record the result.
3. Fold every file in docs/04_workflows/changes/ except README.md, following that README: CHANGELOG.md, TESTING.md, the BACKLOG "Status at Milestone 1" line, PLAN.md (strike the items, update the wave bar and "next up"). Delete the folded fragments in the same commit.
4. Commit (message ends with "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"), push, gh pr create --base staging (body ends with "🤖 Generated with [Claude Code](https://claude.com/claude-code)"), call mcp__ccd_pr__set_monitor with auto_fix false for it, and DO NOT merge: the review stage adds the calibration and merges.
Return prUrl, the e2e result and anything a fragment said was blocked.`,
  { label: 'Final docs', phase: 'Final', isolation: 'worktree', model: args.final.model, effort: args.final.effort,
    schema: { type: 'object', properties: { prUrl: { type: 'string' }, e2e: { type: 'string' }, blocked: { type: 'string' } }, required: ['prUrl', 'e2e'] } })
return { results, final }
