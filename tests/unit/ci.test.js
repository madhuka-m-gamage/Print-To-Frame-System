import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const workflow = readFileSync('.github/workflows/test.yml', 'utf8');

describe('coverage and CI configuration', () => {
  it('coverage:all covers unit, API and component tests', () => {
    const script = pkg.scripts['coverage:all'];
    expect(script).toBeTruthy();
    expect(script).toContain('tests/unit');
    expect(script).toContain('tests/api');
    expect(script).toContain('vitest.component.config.js');
  });

  it('e2e job runs for pull requests into staging as well as main', () => {
    const job = workflow.slice(workflow.indexOf('\n  e2e:'));
    const cond = job.split('\n').find((l) => l.trim().startsWith('if:'));
    expect(cond).toContain("needs.changes.outputs.code == 'true'");
    expect(cond).toContain("github.base_ref == 'staging'");
    expect(cond).toContain("github.base_ref == 'main'");
  });
});
