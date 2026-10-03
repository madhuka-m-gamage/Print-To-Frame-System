import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { checkWorkflow } from '../../.claude/skills/agent-run/scripts/check-workflow.mjs';

describe('agent-run workflow template', () => {
  it('parses as a Workflow script', () => {
    expect(() => checkWorkflow(readFileSync('.claude/skills/agent-run/workflow-template.js', 'utf8'))).not.toThrow();
  });

  it('rejects a script with a syntax error', () => {
    expect(() => checkWorkflow('export const meta = { name: "x", description: "y" }\nconst a = ;')).toThrow();
  });

  it('runs every slot command through the run mode of the slot script', () => {
    const brief = readFileSync('.claude/skills/agent-run/agent-brief.md', 'utf8');
    expect(brief).toContain('node tests/tools/testSlot.mjs {{slot}} -- npm run test:rules');
    expect(brief).toContain('node tests/tools/testSlot.mjs {{slot}} -- npm run test:e2e');
    expect(brief).not.toContain('eval');
    expect(brief).not.toContain('.env &&');
  });

  it('falls back to Sonnet low for the final step when args.final is missing', () => {
    expect(readFileSync('.claude/skills/agent-run/workflow-template.js', 'utf8')).toContain("const finalStep = args.final || { model: 'sonnet', effort: 'low' }");
  });

  it('requires a change fragment for every item, one-line fixes included', () => {
    const brief = readFileSync('.claude/skills/agent-run/agent-brief.md', 'utf8');
    expect(brief).toMatch(/every item, even a one-line fix/);
  });

  it('re-checks that the branch contains staging before merging, so a behind branch never lands untested', () => {
    const brief = readFileSync('.claude/skills/agent-run/agent-brief.md', 'utf8');
    expect(brief).toContain('git merge-base --is-ancestor origin/staging HEAD');
    expect(brief).not.toContain('it reports them and update');
  });

  it('security and money default to Opus at medium effort', () => {
    const policy = readFileSync('.claude/skills/agent-run/model-policy.md', 'utf8');
    expect(policy).toMatch(/^\| security \|.*\| Opus \| medium \|$/m);
    expect(policy).toMatch(/^\| money \|.*\| Opus \| medium \|$/m);
  });

  it('every {{placeholder}} in the brief is one the template fills', () => {
    const brief = readFileSync('.claude/skills/agent-run/agent-brief.md', 'utf8');
    const used = new Set([...brief.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]));
    expect([...used].sort()).toEqual(['backlog', 'branch', 'effort', 'files', 'id', 'mainCheckout', 'model', 'notes', 'slot', 'testPlan', 'trailerModel'].sort());
  });
});
