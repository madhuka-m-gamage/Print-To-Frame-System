import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (name) => readFileSync(`.claude/skills/agent-run/${name}`, 'utf8');

describe('agent-run model decision cards', () => {
  it('the policy has a selection rubric, effort levels and an evidence log', () => {
    const policy = read('model-policy.md');
    for (const heading of ['## Selection signals', '## Effort levels', '## Evidence by task type']) expect(policy).toContain(heading);
    expect(policy).toMatch(/unverified claim.*verify-first/s);
    expect(policy).toContain('to be validated by outcomes');
  });

  it('plan section 8 defines the card fields, an example and the one-line final-docs card', () => {
    const template = read('plan-template.md');
    for (const field of ['What changes', 'Decisions still open', 'Safety net', 'Blast radius and undo', 'Signals toward Opus', 'Signals toward Sonnet', 'Pick and why', 'Option costs']) {
      expect(template).toContain(field);
    }
    expect(template).toContain('Example card (MON-8)');
    expect(template).toContain('unknown');
    expect(template).toContain('Final docs card is one line');
  });

  it('SKILL.md tells the planner to put facts in the question, costs in the options and the card in the preview', () => {
    const skill = read('SKILL.md');
    expect(skill).toContain('decision card');
    expect(skill).toContain('preview');
    expect(skill).toContain('unmeasured');
  });

  it('the review records the pick outcome and keeps policy changes owner-approved', () => {
    const review = read('review-checklist.md');
    expect(review).toContain('Pick outcome');
    expect(review).toContain('fix rounds');
    expect(review).toContain('never change the policy without the owner');
  });
});
