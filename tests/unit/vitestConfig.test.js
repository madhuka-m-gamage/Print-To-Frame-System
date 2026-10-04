import { describe, it, expect } from 'vitest';
import config from '../../vitest.config.js';

describe('vitest config', () => {
  it('gives rules test setup hooks 60 s, since setupRulesEnv times out at 10 s under parallel emulator lanes (TST-5)', () => {
    expect(config.test.hookTimeout).toBeGreaterThanOrEqual(60000);
  });
});
