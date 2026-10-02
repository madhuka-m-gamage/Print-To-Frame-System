import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const source = readFileSync('.claude/skills/agent-run/workflow-template.js', 'utf8').replace(/^export const meta/m, 'const meta');
const brief = readFileSync('.claude/skills/agent-run/agent-brief.md', 'utf8');

// Runs the Workflow script with stub runtime globals, the way the Workflow tool provides them.
async function runTemplate(args, agentImpl) {
  const run = new AsyncFunction('args', 'budget', 'agent', 'parallel', 'phase', 'log', source);
  const parallel = (thunks) => Promise.all(thunks.map((t) => t().catch(() => null)));
  return run({ brief, mainCheckout: '/main', final: { model: 'sonnet', effort: 'low' }, guardOutputTokens: null, ...args },
    { spent: () => 0 }, agentImpl, parallel, () => {}, () => {});
}

const it2 = (id, extra = {}) => ({ id, branch: `claude/${id.toLowerCase()}`, model: 'sonnet', effort: 'low', backlog: '', files: '', notes: '', testPlan: '', ...extra });
const merged = (id) => ({ item: id, status: 'merged', merged: true, summary: 'ok', prUrl: `https://x/${id}` });

describe('agent-run workflow template at run time', () => {
  it('names the item\'s own model in the commit trailer, not a fixed one', async () => {
    const prompts = {};
    await runTemplate({ lanes: [[it2('A', { model: 'opus' })], [it2('B', { model: 'sonnet' })]], final: { model: 'sonnet', effort: 'low' } }, async (prompt, opts) => {
      prompts[opts.label] = prompt;
      return opts.label === 'Final docs' ? { prUrl: 'p', e2e: 'ok' } : merged(opts.label);
    });
    expect(prompts.A).toContain('Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>');
    expect(prompts.A).not.toContain('Claude Sonnet 5.5');
    expect(prompts.B).toContain('Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>');
    expect(prompts['Final docs']).toContain('Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>');
  });

  it('takes each item slot from its lane, whatever args say', async () => {
    const prompts = [];
    await runTemplate({ lanes: [[it2('A', { slot: 7 })], [it2('B')]] }, async (prompt, opts) => {
      prompts.push(prompt);
      return opts.label === 'Final docs' ? { prUrl: 'p', e2e: 'ok' } : merged(opts.label);
    });
    expect(prompts[0]).toContain('testSlot.mjs 1)');
    expect(prompts[1]).toContain('testSlot.mjs 2)');
  });

  it('records items after a stopped item as not-started', async () => {
    const out = await runTemplate({ lanes: [[it2('A'), it2('B'), it2('C')], []] }, async (prompt, opts) =>
      opts.label === 'A' ? { item: 'A', status: 'pr-open-blocked', merged: false, summary: 'owner' } : merged(opts.label));
    expect(out.results.map((r) => [r.item, r.status])).toEqual([['A', 'pr-open-blocked'], ['B', 'not-started'], ['C', 'not-started']]);
  });

  it('keeps merged items when a later agent call throws, and names items by their id', async () => {
    const out = await runTemplate({ lanes: [[it2('A'), it2('B')], []] }, async (prompt, opts) => {
      if (opts.label === 'B') throw new Error('budget ceiling');
      if (opts.label === 'Final docs') return { prUrl: 'p', e2e: 'ok' };
      return { ...merged('A'), item: 'WRONG' };
    });
    expect(out.results.map((r) => [r.item, r.status])).toEqual([['A', 'merged'], ['B', 'failed']]);
  });

  it('reports a failed final step instead of returning final: null', async () => {
    const out = await runTemplate({ lanes: [[it2('A')], []] }, async (prompt, opts) => {
      if (opts.label === 'Final docs') throw new Error('died');
      return merged('A');
    });
    expect(out.final).toEqual({ error: 'died' });
  });

  it('runs the final e2e on slot 1, not on slot 0 where the owner may run npm run dev', async () => {
    let finalPrompt = '';
    await runTemplate({ lanes: [[it2('A')], []] }, async (prompt, opts) => {
      if (opts.label === 'Final docs') { finalPrompt = prompt; return { prUrl: 'p', e2e: 'ok' }; }
      return merged('A');
    });
    expect(finalPrompt).toContain('env="$(node tests/tools/testSlot.mjs 1)" && eval "$env" && npm run test:e2e');
  });
});
