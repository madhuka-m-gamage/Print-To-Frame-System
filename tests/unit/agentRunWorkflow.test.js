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

  it('every {{placeholder}} in the brief is one the template fills', () => {
    const brief = readFileSync('.claude/skills/agent-run/agent-brief.md', 'utf8');
    const used = new Set([...brief.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]));
    expect([...used].sort()).toEqual(['backlog', 'branch', 'effort', 'files', 'id', 'mainCheckout', 'model', 'notes', 'slot', 'testPlan'].sort());
  });
});
