import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { slotPorts, slotConfigPath, slotFirebaseConfig, slotEnv, MAX_SLOT } from '../tools/testSlot.mjs';

const base = JSON.parse(readFileSync('firebase.json', 'utf8'));

describe('test slots', () => {
  it('slot 0 is exactly today: firebase.json and the default ports', () => {
    expect(slotConfigPath(0)).toBe('firebase.json');
    expect(slotFirebaseConfig(base, 0)).toEqual(base);
    expect(slotPorts(0)).toMatchObject({ firestore: 8080, auth: 9099, storage: 9199, dev: 3000 });
  });

  it('no port is shared between any two services of any slots', () => {
    const all = [];
    for (let slot = 0; slot <= MAX_SLOT; slot += 1) all.push(...Object.values(slotPorts(slot)));
    expect(new Set(all).size).toBe(all.length);
  });

  it('a slot config moves every emulator port and turns the UI off', () => {
    const config = slotFirebaseConfig(base, 1);
    const p = slotPorts(1);
    expect(config.emulators.firestore).toMatchObject({ port: p.firestore, websocketPort: p.firestoreWebsocket });
    expect(config.emulators.auth.port).toBe(p.auth);
    expect(config.emulators.storage.port).toBe(p.storage);
    expect(config.emulators.hub.port).toBe(p.hub);
    expect(config.emulators.logging.port).toBe(p.logging);
    expect(config.emulators.ui.enabled).toBe(false);
    expect(config.firestore).toEqual(base.firestore);
    expect(config.storage).toEqual(base.storage);
  });

  it('slotEnv gives the app, Playwright and the CLI the slot ports', () => {
    expect(slotEnv(2)).toEqual({
      P2F_FIREBASE_CONFIG: 'firebase.slot2.json',
      P2F_DEV_PORT: '3020',
      P2F_FIRESTORE_PORT: '8100',
      P2F_AUTH_PORT: '9119',
      P2F_STORAGE_PORT: '9219',
      VITE_EMULATOR_FIRESTORE_PORT: '8100',
      VITE_EMULATOR_AUTH_PORT: '9119',
      VITE_EMULATOR_STORAGE_PORT: '9219',
      TMPDIR: join(tmpdir(), 'p2f-slot2'),
      P2F_VITE_CACHE_DIR: join(tmpdir(), 'p2f-slot2', 'vite-cache'),
    });
    expect(Object.keys(slotEnv(1))).not.toContain('FIREBASE_CONFIG');
  });

  it('gives each extra slot its own temp dir, because the Storage emulator deletes a shared blob dir on stop', () => {
    expect(slotEnv(0)).not.toHaveProperty('TMPDIR');
    expect(slotEnv(0)).not.toHaveProperty('P2F_VITE_CACHE_DIR');
    expect(slotEnv(1).TMPDIR).not.toBe(slotEnv(2).TMPDIR);
  });

  it('refuses slots outside 0..4 and non-integers', () => {
    for (const bad of [-1, 5, 1.5, NaN, '1a']) expect(() => slotPorts(bad)).toThrow(/slot must be an integer from 0 to 4/);
  });

  it('the CLI refuses a missing, blank or out-of-range slot with a non-zero exit and no exports', () => {
    for (const argv of [[], [''], ['5'], ['abc']]) {
      const r = spawnSync(process.execPath, ['tests/tools/testSlot.mjs', ...argv], { encoding: 'utf8' });
      expect(r.status).not.toBe(0);
      expect(r.stdout).not.toContain('export ');
    }
  });

  it('slots 3 and 4 exist for a second workflow and their ports do not collide', () => {
    expect(MAX_SLOT).toBe(4);
    expect(slotEnv(4)).toMatchObject({ P2F_DEV_PORT: '3040', P2F_FIRESTORE_PORT: '8120', P2F_AUTH_PORT: '9139', P2F_STORAGE_PORT: '9239' });
  });

  it('vite takes its dependency cache dir from the slot, so linked worktrees do not share it', () => {
    expect(readFileSync('vite.config.js', 'utf8')).toContain('process.env.P2F_VITE_CACHE_DIR');
  });
});
