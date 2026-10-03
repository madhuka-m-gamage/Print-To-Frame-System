import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const BASE_PORTS = { firestore: 8080, firestoreWebsocket: 9150, auth: 9099, storage: 9199, ui: 4000, hub: 4400, logging: 4500, dev: 3000 };
// 10, not 100: Auth 9099 + 100 would land on Storage 9199.
export const SLOT_OFFSET = 10;
export const MAX_SLOT = 4;

export function slotPorts(slot) {
  if (!Number.isInteger(slot) || slot < 0 || slot > MAX_SLOT) {
    throw new Error(`slot must be an integer from 0 to ${MAX_SLOT}, got ${slot}`);
  }
  return Object.fromEntries(Object.entries(BASE_PORTS).map(([name, port]) => [name, port + slot * SLOT_OFFSET]));
}

export function slotConfigPath(slot) {
  slotPorts(slot);
  return slot === 0 ? 'firebase.json' : `firebase.slot${slot}.json`;
}

export function slotFirebaseConfig(base, slot) {
  const p = slotPorts(slot);
  if (slot === 0) return base;
  const emulators = base.emulators || {};
  return {
    ...base,
    emulators: {
      ...emulators,
      auth: { ...emulators.auth, port: p.auth },
      firestore: { ...emulators.firestore, port: p.firestore, websocketPort: p.firestoreWebsocket },
      storage: { ...emulators.storage, port: p.storage },
      ui: { ...emulators.ui, enabled: false, port: p.ui },
      hub: { port: p.hub },
      logging: { port: p.logging },
    },
  };
}

export function slotEnv(slot) {
  const p = slotPorts(slot);
  return {
    P2F_FIREBASE_CONFIG: slotConfigPath(slot),
    P2F_DEV_PORT: String(p.dev),
    P2F_FIRESTORE_PORT: String(p.firestore),
    P2F_AUTH_PORT: String(p.auth),
    P2F_STORAGE_PORT: String(p.storage),
    VITE_EMULATOR_FIRESTORE_PORT: String(p.firestore),
    VITE_EMULATOR_AUTH_PORT: String(p.auth),
    VITE_EMULATOR_STORAGE_PORT: String(p.storage),
    // The Storage emulator keeps blobs in <tmp>/firebase/storage/blobs and deletes that dir on
    // stop, so two slots sharing a tmp dir break each other's shutdown.
    ...(slot === 0 ? {} : { TMPDIR: join(tmpdir(), `p2f-slot${slot}`), P2F_VITE_CACHE_DIR: join(tmpdir(), `p2f-slot${slot}`, 'vite-cache') }),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.argv[2]?.trim()) throw new Error('usage: node tests/tools/testSlot.mjs <slot 0..4> [-- <command>]');
  const slot = Number(process.argv[2]);
  const env = slotEnv(slot);
  if (slot > 0) {
    const base = JSON.parse(readFileSync('firebase.json', 'utf8'));
    writeFileSync(slotConfigPath(slot), `${JSON.stringify(slotFirebaseConfig(base, slot), null, 2)}\n`);
    mkdirSync(env.TMPDIR, { recursive: true });
  }
  // Run mode starts the command itself, so agents need no eval or sourcing, which the worktree guard refuses.
  const [sep, cmd, ...cmdArgs] = process.argv.slice(3);
  if (sep === '--' && cmd) {
    const r = spawnSync(cmd, cmdArgs, { stdio: 'inherit', env: { ...process.env, ...env } });
    if (r.error) throw r.error;
    process.exit(r.status ?? 1);
  }
  for (const [name, value] of Object.entries(env)) console.log(`export ${name}=${value}`);
}
