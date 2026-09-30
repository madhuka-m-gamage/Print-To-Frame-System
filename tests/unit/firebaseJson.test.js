import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

const config = JSON.parse(readFileSync(new URL('../../firebase.json', import.meta.url), 'utf8'));

describe('firebase.json', () => {
  it('deploys Firestore rules to the (default) database only', () => {
    const targets = [].concat(config.firestore);
    expect(targets.map((t) => t.database)).toEqual(['(default)']);
    expect(targets[0].rules).toBe('firestore.rules');
  });

  it('keeps the Firestore, Auth and Storage emulators', () => {
    expect(config.emulators.firestore.port).toBe(8080);
    expect(config.emulators.auth.port).toBe(9099);
    expect(config.emulators.storage.port).toBe(9199);
  });
});
