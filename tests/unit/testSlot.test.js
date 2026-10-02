import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
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
    });
    expect(Object.keys(slotEnv(1))).not.toContain('FIREBASE_CONFIG');
  });

  it('refuses slots outside 0..2 and non-integers', () => {
    for (const bad of [-1, 3, 1.5, NaN, '1a']) expect(() => slotPorts(bad)).toThrow(/slot must be an integer from 0 to 2/);
  });
});
