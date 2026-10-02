# `agent-run` Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the repo skill `.claude/skills/agent-run/` (plan, run and review batched agent runs) and the prerequisite repo changes it depends on (change fragments, per-slot test ports, shared `node_modules`).

**Architecture:** Two PRs into `staging`. PR 1 (`claude/agent-run-prereq`, Tasks 1–5) makes the repo safe for two fully tested parallel lanes: per-item change fragments instead of shared doc lines, and emulator and dev-server ports that come from the environment with today's values as defaults. PR 2 (`claude/agent-run-skill`, Tasks 6–10) adds the skill: Markdown instructions read stage by stage, a fixed Workflow script fed by `args`, and a small tested helper for lane balancing and the usage guard.

**Tech Stack:** Node 22 ESM (`"type": "module"`), Vitest (unit tests in `tests/unit/`, `globals: false`), Playwright, firebase-tools 15 emulators, the Claude Code Workflow tool, Bash.

**Spec:** [docs/05_decisions/0005-agent-run-skill.md](../05_decisions/0005-agent-run-skill.md)

## Global Constraints

- Branch from `origin/staging`, PR into `staging`, merge with `gh pr merge <n> --merge`. Never push to or PR into `main`. No `firebase deploy`, no console or config changes, no live data.
- Tests first, run and seen failing before the implementation.
- Slot 0 keeps today's ports exactly (Firestore 8080, Auth 9099, Storage 9199, UI 4000, dev server 3000). CI and `npm run dev` must behave exactly as before.
- Port offset per slot is **10**, maximum slot **2** (this machine has 4 CPUs and 6 GB RAM).
- Environment variable names: `P2F_FIREBASE_CONFIG`, `P2F_DEV_PORT`, `P2F_FIRESTORE_PORT`, `P2F_AUTH_PORT`, `P2F_STORAGE_PORT`, `VITE_EMULATOR_FIRESTORE_PORT`, `VITE_EMULATOR_AUTH_PORT`, `VITE_EMULATOR_STORAGE_PORT`. Never use `FIREBASE_CONFIG` (firebase-admin reads it as its own config).
- Fragments live in `docs/04_workflows/changes/<ID>.md` with exactly three headings: `## Changelog`, `## Testing map`, `## Status`.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; PR bodies end with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- No comments unless the why is not obvious; reuse existing patterns.

## Review Focus

1. A port variable set to an empty or non-numeric string (`VITE_EMULATOR_AUTH_PORT=""`) must fall back to the default port, not connect to port 0 or `NaN`. Pinned in Task 2.
2. Slot ports of different slots, including slot 0, must never overlap across any emulator service (Auth 9099 + 100 would equal Storage 9199, which is why the offset is 10). Pinned in Task 3.
3. Slot numbers outside 0..2, or not integers (`"1a"`, `-1`, `3`), must be refused with a clear error, never produce a config. Pinned in Task 3.
4. Lane building must keep every item: no item dropped or duplicated when conflict groups or dependencies chain across several items. Pinned in Task 6.
5. An item whose dependency is not in the batch must still be scheduled (the dependency is assumed already merged), not loop or vanish. Pinned in Task 6.

---

## PR 1: prerequisites (branch `claude/agent-run-prereq`)

### Task 1: Change-fragment convention (docs)

**Files:**
- Create: `docs/04_workflows/changes/README.md`
- Modify: `CLAUDE.md` (the "Update `PROJECT_INDEX.md` when a doc is added..." bullet), `docs/04_workflows/GIT_WORKFLOW.md` ("One item, one branch, one PR", step 3), `docs/04_workflows/TESTING.md` ("Adding a test", new last bullet), `PROJECT_INDEX.md` (04_workflows list)

**Interfaces:**
- Produces: the fragment format the skill's agent brief (Task 8) and final step (Task 8) rely on.

- [ ] **Step 1: Branch**

```bash
git fetch origin && git switch -c claude/agent-run-prereq origin/staging --no-track
```

- [ ] **Step 2: Write `docs/04_workflows/changes/README.md`**

```markdown
# Change fragments

Used inside a multi-agent run (the `agent-run` skill). Each item writes one fragment instead of editing the shared lines of `CHANGELOG.md`, the BACKLOG status line, `TESTING.md`'s coverage map and `PLAN.md`, so parallel PRs never conflict on them. A single manual session may still edit those files directly.

## File

`docs/04_workflows/changes/<ID>.md`, one per backlog item, for example `FEA-12.md`. Exactly three headings:

    ## Changelog
    - <the bullet exactly as it should appear under "## Unreleased" in CHANGELOG.md, with test counts>

    ## Testing map
    - <each line to add to or change in TESTING.md's coverage map or characterisation register, naming the row>
    - none (if nothing changes)

    ## Status
    done | blocked: <reason> | open: <reason>; tests: unit N, API N, component N, rules N, e2e N

The item still edits its own `### <ID>` section of `BACKLOG.md` directly (separate lines, no conflict).

## Folding

The run's final step, after every item has merged: adds each `## Changelog` bullet under `## Unreleased` in `CHANGELOG.md`, applies each `## Testing map` line to `TESTING.md`, updates the BACKLOG "Status at Milestone 1" line and `PLAN.md` from each `## Status`, then deletes the folded fragments in the same commit. Git history keeps them.
```

- [ ] **Step 3: Edit the rule in `CLAUDE.md`**

Replace

```
- Update `PROJECT_INDEX.md` when a doc is added or moved, and `CHANGELOG.md` with each change. Design "why" notes go in `docs/05_decisions/` as numbered files.
```

with

```
- Update `PROJECT_INDEX.md` when a doc is added or moved, and `CHANGELOG.md` with each change. Inside a multi-agent run, items write a change fragment in `docs/04_workflows/changes/` instead and the run's final step folds them into `CHANGELOG.md` (see its README). Design "why" notes go in `docs/05_decisions/` as numbered files.
```

- [ ] **Step 4: Edit `GIT_WORKFLOW.md` step 3**

Replace `3. Docs, the module's \`CLAUDE.md\` and \`CHANGELOG.md\` in the same PR.` with:

```
3. Docs, the module's `CLAUDE.md` and `CHANGELOG.md` in the same PR. In a multi-agent run, write a change fragment instead of editing `CHANGELOG.md`, the BACKLOG status line, the TESTING map or `PLAN.md` ([changes/README.md](changes/README.md)).
```

- [ ] **Step 5: Add to TESTING.md "Adding a test" (new last bullet)**

```
- Docs: in a multi-agent run, put coverage-map and register changes in the item's change fragment (`docs/04_workflows/changes/<ID>.md`, `## Testing map`); the run's final step applies them.
```

- [ ] **Step 6: Index it** — in `PROJECT_INDEX.md` after the `TESTING.md` line add:

```
- [changes/README.md](docs/04_workflows/changes/README.md): change fragments written by items in a multi-agent run
```

- [ ] **Step 7: Commit**

```bash
git add docs/04_workflows/changes/README.md CLAUDE.md docs/04_workflows/GIT_WORKFLOW.md docs/04_workflows/TESTING.md PROJECT_INDEX.md
git commit -m "docs: change fragments for multi-agent runs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 2: App emulator ports from the environment

**Files:**
- Create: `src/services/emulatorPorts.js`
- Modify: `src/services/firebase.js:49-58` (the emulator block)
- Test: `tests/unit/emulatorPorts.test.js`

**Interfaces:**
- Produces: `emulatorPorts(env) -> { firestore: number, auth: number, storage: number }`, reading `VITE_EMULATOR_FIRESTORE_PORT`, `VITE_EMULATOR_AUTH_PORT`, `VITE_EMULATOR_STORAGE_PORT`, defaults 8080, 9099, 9199.

- [ ] **Step 1: Write the failing test** `tests/unit/emulatorPorts.test.js`

```js
import { describe, it, expect } from 'vitest';
import { emulatorPorts } from '@/services/emulatorPorts';

describe('emulatorPorts', () => {
  it('defaults to the ports in firebase.json', () => {
    expect(emulatorPorts({})).toEqual({ firestore: 8080, auth: 9099, storage: 9199 });
    expect(emulatorPorts(undefined)).toEqual({ firestore: 8080, auth: 9099, storage: 9199 });
  });

  it('reads slot ports from the VITE_EMULATOR_* variables', () => {
    expect(
      emulatorPorts({ VITE_EMULATOR_FIRESTORE_PORT: '8090', VITE_EMULATOR_AUTH_PORT: '9109', VITE_EMULATOR_STORAGE_PORT: '9209' })
    ).toEqual({ firestore: 8090, auth: 9109, storage: 9209 });
  });

  it('falls back to the default for empty, non-numeric or out-of-range values', () => {
    expect(
      emulatorPorts({ VITE_EMULATOR_FIRESTORE_PORT: '', VITE_EMULATOR_AUTH_PORT: 'abc', VITE_EMULATOR_STORAGE_PORT: '70000' })
    ).toEqual({ firestore: 8080, auth: 9099, storage: 9199 });
    expect(emulatorPorts({ VITE_EMULATOR_AUTH_PORT: '0' }).auth).toBe(9099);
    expect(emulatorPorts({ VITE_EMULATOR_AUTH_PORT: '91.5' }).auth).toBe(9099);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/unit/emulatorPorts.test.js`
Expected: FAIL, cannot resolve `@/services/emulatorPorts`.

- [ ] **Step 3: Implement** `src/services/emulatorPorts.js`

```js
const DEFAULT_PORTS = { firestore: 8080, auth: 9099, storage: 9199 };

const toPort = (value, fallback) => {
  const port = Number(value);
  return Number.isInteger(port) && port > 0 && port < 65536 ? port : fallback;
};

export function emulatorPorts(env = {}) {
  const source = env || {};
  return {
    firestore: toPort(source.VITE_EMULATOR_FIRESTORE_PORT, DEFAULT_PORTS.firestore),
    auth: toPort(source.VITE_EMULATOR_AUTH_PORT, DEFAULT_PORTS.auth),
    storage: toPort(source.VITE_EMULATOR_STORAGE_PORT, DEFAULT_PORTS.storage),
  };
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run tests/unit/emulatorPorts.test.js`
Expected: PASS, 3 tests.

- [ ] **Step 5: Use it in `src/services/firebase.js`**

Add `import { emulatorPorts } from './emulatorPorts';` with the other imports, and replace the body of the emulator `if` block with:

```js
  const ports = emulatorPorts(import.meta.env);
  connectFirestoreEmulator(db, '127.0.0.1', ports.firestore);
  connectAuthEmulator(auth, `http://127.0.0.1:${ports.auth}`, { disableWarnings: true });
  connectStorageEmulator(storage, '127.0.0.1', ports.storage);
  console.warn(
    `[firebase] USING EMULATORS for project "${firebaseConfig.projectId}": firestore 127.0.0.1:${ports.firestore}, auth 127.0.0.1:${ports.auth}, storage 127.0.0.1:${ports.storage}. Production Firebase is NOT in use.`
  );
```

The guard condition (`VITE_USE_FIREBASE_EMULATOR === 'true'` and dev or a `demo-` project) is unchanged.

- [ ] **Step 6: Run lint, unit and component tests**

Run: `npm run lint && npm test && npm run test:component`
Expected: all pass (unit count +3).

- [ ] **Step 7: Commit**

```bash
git add src/services/emulatorPorts.js src/services/firebase.js tests/unit/emulatorPorts.test.js
git commit -m "test(env): emulator ports from VITE_EMULATOR_* with today's defaults

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 3: Slot generator `tests/tools/testSlot.mjs`

**Files:**
- Create: `tests/tools/testSlot.mjs`
- Modify: `.gitignore` (one line: `firebase.slot*.json`, under the Firebase debug-log lines)
- Test: `tests/unit/testSlot.test.js`

**Interfaces:**
- Produces: `BASE_PORTS`, `SLOT_OFFSET = 10`, `MAX_SLOT = 2`, `slotPorts(slot) -> { firestore, firestoreWebsocket, auth, storage, ui, hub, logging, dev }`, `slotConfigPath(slot) -> string`, `slotFirebaseConfig(baseConfig, slot) -> object`, `slotEnv(slot) -> Record<string,string>`. CLI: `node tests/tools/testSlot.mjs <slot>` writes `firebase.slot<N>.json` for N ≥ 1 and prints `export NAME=value` lines; used as `eval "$(node tests/tools/testSlot.mjs 1)"`.

- [ ] **Step 1: Write the failing test** `tests/unit/testSlot.test.js`

```js
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/unit/testSlot.test.js`
Expected: FAIL, cannot find `../tools/testSlot.mjs`.

- [ ] **Step 3: Implement** `tests/tools/testSlot.mjs`

```js
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const BASE_PORTS = { firestore: 8080, firestoreWebsocket: 9150, auth: 9099, storage: 9199, ui: 4000, hub: 4400, logging: 4500, dev: 3000 };
// 10, not 100: Auth 9099 + 100 would land on Storage 9199.
export const SLOT_OFFSET = 10;
export const MAX_SLOT = 2;

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
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const slot = Number(process.argv[2] ?? 0);
  if (slot > 0) {
    const base = JSON.parse(readFileSync('firebase.json', 'utf8'));
    writeFileSync(slotConfigPath(slot), `${JSON.stringify(slotFirebaseConfig(base, slot), null, 2)}\n`);
  }
  for (const [name, value] of Object.entries(slotEnv(slot))) console.log(`export ${name}=${value}`);
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run tests/unit/testSlot.test.js`
Expected: PASS, 5 tests.

- [ ] **Step 5: Ignore generated configs** — add to `.gitignore` after `ui-debug.log`:

```
firebase.slot*.json
```

(This is the owner's `.gitignore`; the one-line addition is called out in the PR body for the owner's OK.)

- [ ] **Step 6: Check the CLI**

Run: `node tests/tools/testSlot.mjs 1 && ls firebase.slot1.json && git status --short firebase.slot1.json`
Expected: eight `export` lines, the file exists, `git status` prints nothing (ignored).

- [ ] **Step 7: Commit**

```bash
git add tests/tools/testSlot.mjs tests/unit/testSlot.test.js .gitignore
git commit -m "test(env): per-slot emulator and dev-server ports (offset 10, max slot 2)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 4: Wire the slot environment into scripts and test config

**Files:**
- Modify: `package.json` (`dev:emulated`, `test:rules`), `tests/helpers/emulator.js` (both `initializeTestEnvironment` calls), `tests/integration/effectiveAccess.test.js:37`, `playwright.config.js` (env defaults, `baseURL`, both `webServer` entries), `tests/e2e/global-setup.js:19`
- Test: covered by the existing rules and e2e suites on slot 0, plus the two-slot check in Step 6

**Interfaces:**
- Consumes: `slotEnv(slot)` variable names from Task 3; `emulatorPorts` from Task 2 (through Vite env).
- Produces: `firestoreEmulator()` and `storageEmulator()` in `tests/helpers/emulator.js`, each `-> { host: string, port: number }`.

- [ ] **Step 1: Check the CLI flag position**

Run: `firebase emulators:exec --help | grep -- "--config" ; firebase --help | grep -- "--config"`
Expected: `-c, --config <path>` listed (global). If it is only global, write it before the subcommand in Steps 2 and 4: `firebase --config <path> emulators:exec ...`.

- [ ] **Step 2: `package.json` scripts**

```json
"dev:emulated": "vite --mode test --port ${P2F_DEV_PORT:-3000}",
"test:rules": "firebase emulators:exec --config ${P2F_FIREBASE_CONFIG:-firebase.json} --project demo-print2frame-test --only firestore,auth,storage \"vitest run tests/integration\"",
```

- [ ] **Step 3: `tests/helpers/emulator.js`** — add after `PROJECT_ID`:

```js
// emulators:exec sets these hosts for the slot it started; the fallbacks match firebase.json.
function hostAndPort(value, fallbackPort) {
  const [host, port] = String(value || '').split(':');
  return { host: host || 'localhost', port: Number(port) || fallbackPort };
}

export const firestoreEmulator = () => hostAndPort(process.env.FIRESTORE_EMULATOR_HOST, 8080);
export const storageEmulator = () => hostAndPort(process.env.FIREBASE_STORAGE_EMULATOR_HOST, 9199);
```

Then use `{ rules: readFileSync('firestore.rules', 'utf8'), ...firestoreEmulator() }` and `{ rules: readFileSync('storage.rules', 'utf8'), ...storageEmulator() }` in place of the fixed `host`/`port` pairs in `setupRulesEnv` and `setupStorageRulesEnv`, and remove the "Ports match firebase.json." line from the header comment. In `tests/integration/effectiveAccess.test.js:37` replace `host: 'localhost', port: 8080` with `...firestoreEmulator()` and import it from `../helpers/emulator.js`.

- [ ] **Step 4: `playwright.config.js`** — replace the three env lines and the hard-coded URLs:

```js
const DEV_PORT = process.env.P2F_DEV_PORT || '3000';
const AUTH_PORT = process.env.P2F_AUTH_PORT || '9099';
const FIRESTORE_PORT = process.env.P2F_FIRESTORE_PORT || '8080';
const FIREBASE_CONFIG_FILE = process.env.P2F_FIREBASE_CONFIG || 'firebase.json';

process.env.GCLOUD_PROJECT ||= 'demo-print2frame-test';
process.env.FIRESTORE_EMULATOR_HOST ||= `127.0.0.1:${FIRESTORE_PORT}`;
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= `127.0.0.1:${AUTH_PORT}`;
```

`baseURL: \`http://127.0.0.1:${DEV_PORT}\``; emulator `command: \`firebase emulators:start --config ${FIREBASE_CONFIG_FILE} --project demo-print2frame-test --only firestore,auth\`` and `url: \`http://127.0.0.1:${AUTH_PORT}\``; dev server `url: \`http://127.0.0.1:${DEV_PORT}\``. Keep every other option and comment.

- [ ] **Step 5: `tests/e2e/global-setup.js:19`**

```js
    resources: [`tcp:${firestoreHost}`, `tcp:${authHost}`, `tcp:127.0.0.1:${process.env.P2F_DEV_PORT || 3000}`],
```

- [ ] **Step 6: Verify slot 0 is unchanged, then two slots at once**

Run (slot 0, no variables set): `npm run lint && npm run test:all && npm run test:e2e`
Expected: all green with the same counts as before this PR plus Tasks 2–3's new unit tests.

Run in two terminals at the same time:

```bash
eval "$(node tests/tools/testSlot.mjs 1)" && npm run test:rules
eval "$(node tests/tools/testSlot.mjs 2)" && npm run test:rules
```

Expected: both green, no "port taken" error. Then on slot 1 alone: `eval "$(node tests/tools/testSlot.mjs 1)" && npm run test:e2e`, expected green, and the browser console line in a failing trace (if any) shows `firestore 127.0.0.1:8090`. Record the three results in the PR body.

- [ ] **Step 7: Commit**

```bash
git add package.json tests/helpers/emulator.js tests/integration/effectiveAccess.test.js playwright.config.js tests/e2e/global-setup.js
git commit -m "test(env): rules, e2e and dev:emulated follow the slot environment

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 5: Shared `node_modules`, prerequisite docs and PR 1

**Files:**
- Create: `.claude/skills/agent-run/scripts/link-deps.sh`
- Modify: `docs/04_workflows/TESTING.md` (new subsection "Test slots" at the end of "Running the app against the emulators"), `CHANGELOG.md`, `PROJECT_INDEX.md` (nothing new to index beyond Task 1)

**Interfaces:**
- Produces: `link-deps.sh <main-checkout-path>`: links `node_modules` when lockfiles match, else `npm ci`; exit 0 on success.

- [ ] **Step 1: Write `link-deps.sh`**

```bash
#!/usr/bin/env bash
# Usage: link-deps.sh <main-checkout-path>   (run from the worktree root)
set -euo pipefail
main="${1:?main checkout path required}"
if [ -e node_modules ]; then
  echo "node_modules already present"; exit 0
fi
if [ -d "$main/node_modules" ] && cmp -s package-lock.json "$main/package-lock.json"; then
  ln -s "$main/node_modules" node_modules
  echo "linked node_modules from $main"
else
  npm ci --silent
  echo "installed node_modules (lockfile differs from $main)"
fi
```

`chmod +x .claude/skills/agent-run/scripts/link-deps.sh`

- [ ] **Step 2: Verify it**

```bash
git worktree add /tmp/claude-1000/p2f-linkcheck origin/staging
cd /tmp/claude-1000/p2f-linkcheck && "/home/madhuka/Claude Projects/Print-To-Frame-System/.claude/worktrees/<this worktree>/.claude/skills/agent-run/scripts/link-deps.sh" "/home/madhuka/Claude Projects/Print-To-Frame-System"
npm run lint && npm test && npm run test:component && npm run build
cd - && git worktree remove --force /tmp/claude-1000/p2f-linkcheck
```

Expected: "linked node_modules from …", then all green. If Vite or ESLint fails only because `node_modules` is a symlink, record it and change the script to copy with `cp -al` (hard links) instead of `ln -s`, then re-run.

- [ ] **Step 3: TESTING.md "Test slots" subsection**

```markdown
### Test slots (two suites at once)
Slot 0 is the default and uses the ports in `firebase.json` and dev port 3000. Agent runs use slots 1 and 2 (offset 10 per slot, at most 2 on this machine): `eval "$(node tests/tools/testSlot.mjs 1)"` writes `firebase.slot1.json` (gitignored) and exports `P2F_*` and `VITE_EMULATOR_*_PORT`, after which `npm run test:rules`, `npm run test:e2e` and `npm run dev:emulated` use that slot's ports.
```

- [ ] **Step 4: CHANGELOG bullet** under `## Unreleased`:

```
- Agent-run prerequisites: change fragments (`docs/04_workflows/changes/`) for multi-agent runs; emulator and dev-server ports from the environment with today's defaults (`src/services/emulatorPorts.js`, `tests/tools/testSlot.mjs`, offset 10, at most 2 slots) so two lanes can run rules and e2e at once; `link-deps.sh` shares `node_modules` across worktrees when lockfiles match. Slot 0, CI and `npm run dev` unchanged. Tests: unit +8.
```

- [ ] **Step 5: Commit, push, PR, merge on green**

```bash
git add .claude/skills/agent-run/scripts/link-deps.sh docs/04_workflows/TESTING.md CHANGELOG.md
git commit -m "chore: link-deps for worktrees; docs for test slots

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push -u origin claude/agent-run-prereq
gh pr create --base staging --title "Agent-run prerequisites: change fragments, test slots, shared node_modules" --body "<summary of Tasks 1-5, the three Step-6 results from Task 4, the .gitignore line for the owner's OK, ending with the Claude Code line>"
gh pr checks <n> --watch --interval 20 && gh pr merge <n> --merge
```

Expected: CI `lint-unit` and `rules` green, merged into `staging`.

---

## PR 2: the skill (branch `claude/agent-run-skill`, from `staging` after PR 1)

### Task 6: Lane builder and usage guard `lanes.mjs`

**Files:**
- Create: `.claude/skills/agent-run/scripts/lanes.mjs`
- Test: `tests/unit/agentRunLanes.test.js`

**Interfaces:**
- Produces: `buildLanes(items, slots = 2) -> Array<Array<Item>>` where `Item = { id: string, minutes: number, files: string[], deps: string[] }`; `laneMinutes(lane) -> number`; `shouldStartNext(spentOutputTokens, thresholdOutputTokens) -> boolean`; CLI `node lanes.mjs <items.json>` prints the lanes as JSON.

- [ ] **Step 1: Branch** — `git fetch origin && git switch -c claude/agent-run-skill origin/staging --no-track`

- [ ] **Step 2: Write the failing test** `tests/unit/agentRunLanes.test.js`

```js
import { describe, it, expect } from 'vitest';
import { buildLanes, laneMinutes, shouldStartNext } from '../../.claude/skills/agent-run/scripts/lanes.mjs';

const item = (id, minutes, files = [], deps = []) => ({ id, minutes, files, deps });
const ids = (lanes) => lanes.map((lane) => lane.map((i) => i.id));

describe('agent-run lanes', () => {
  it('keeps items that share a file in one lane, in input order', () => {
    const lanes = buildLanes([item('A', 20, ['src/App.jsx']), item('B', 10, ['x.js']), item('C', 15, ['src/App.jsx'])]);
    const withA = lanes.find((lane) => lane.some((i) => i.id === 'A'));
    expect(withA.map((i) => i.id)).toEqual(['A', 'C']);
  });

  it('puts a dependent item after its dependency in the same lane', () => {
    const lanes = buildLanes([item('B', 10, ['b.js'], ['A']), item('A', 10, ['a.js'])]);
    const lane = lanes.find((l) => l.some((i) => i.id === 'B'));
    expect(lane.map((i) => i.id)).toEqual(['A', 'B']);
  });

  it('schedules an item whose dependency is outside the batch', () => {
    expect(ids(buildLanes([item('A', 10, [], ['MON-1'])])).flat()).toEqual(['A']);
  });

  it('balances groups so lane minutes stay within 20 percent', () => {
    const lanes = buildLanes([item('A', 30), item('B', 25), item('C', 20), item('D', 15), item('E', 10)]);
    const [a, b] = lanes.map(laneMinutes).sort((x, y) => y - x);
    expect((a - b) / a).toBeLessThanOrEqual(0.2);
  });

  it('never drops or duplicates an item when groups chain', () => {
    const input = [item('A', 5, ['1']), item('B', 5, ['1', '2']), item('C', 5, ['2', '3']), item('D', 5, ['4'], ['C']), item('E', 5)];
    const out = ids(buildLanes(input)).flat().sort();
    expect(out).toEqual(['A', 'B', 'C', 'D', 'E']);
  });

  it('returns exactly `slots` lanes, empty ones included', () => {
    expect(buildLanes([item('A', 5)], 2)).toHaveLength(2);
  });

  it('stops starting new items once the output-token threshold is reached', () => {
    expect(shouldStartNext(99_999, 100_000)).toBe(true);
    expect(shouldStartNext(100_000, 100_000)).toBe(false);
    expect(shouldStartNext(5, null)).toBe(true);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run tests/unit/agentRunLanes.test.js`
Expected: FAIL, cannot find `lanes.mjs`.

- [ ] **Step 4: Implement** `lanes.mjs`

```js
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const laneMinutes = (lane) => lane.reduce((sum, i) => sum + i.minutes, 0);

export function shouldStartNext(spentOutputTokens, thresholdOutputTokens) {
  return thresholdOutputTokens == null || spentOutputTokens < thresholdOutputTokens;
}

function groupItems(items) {
  const parent = new Map(items.map((i) => [i.id, i.id]));
  const find = (id) => (parent.get(id) === id ? id : find(parent.get(id)));
  const join = (a, b) => parent.set(find(a), find(b));
  const owner = new Map();
  for (const i of items) {
    for (const file of i.files) {
      if (owner.has(file)) join(i.id, owner.get(file));
      else owner.set(file, i.id);
    }
    for (const dep of i.deps) if (parent.has(dep)) join(i.id, dep);
  }
  const groups = new Map();
  for (const i of items) {
    const root = find(i.id);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(i);
  }
  return [...groups.values()];
}

function orderByDeps(group) {
  const ids = new Set(group.map((i) => i.id));
  const done = new Set();
  const ordered = [];
  while (ordered.length < group.length) {
    const next = group.find((i) => !done.has(i.id) && i.deps.every((d) => !ids.has(d) || done.has(d)));
    if (!next) throw new Error(`dependency cycle among ${[...ids].filter((id) => !done.has(id)).join(', ')}`);
    done.add(next.id);
    ordered.push(next);
  }
  return ordered;
}

export function buildLanes(items, slots = 2) {
  const lanes = Array.from({ length: slots }, () => []);
  const groups = groupItems(items).map(orderByDeps).sort((a, b) => laneMinutes(b) - laneMinutes(a));
  for (const group of groups) {
    const target = lanes.reduce((best, lane) => (laneMinutes(lane) < laneMinutes(best) ? lane : best));
    target.push(...group);
  }
  return lanes;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const items = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  console.log(JSON.stringify(buildLanes(items, Number(process.argv[3] || 2)), null, 2));
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `npx vitest run tests/unit/agentRunLanes.test.js && npm run lint`
Expected: PASS, 7 tests; lint clean.

- [ ] **Step 6: Commit**

```bash
git add .claude/skills/agent-run/scripts/lanes.mjs tests/unit/agentRunLanes.test.js
git commit -m "feat(agent-run): lane builder and usage guard

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 7: Model policy and the plan template

**Files:**
- Create: `.claude/skills/agent-run/model-policy.md`, `.claude/skills/agent-run/plan-template.md`

**Interfaces:**
- Produces: the task-type names the planner uses (`security`, `money`, `design-heavy`, `tests`, `small-ui`, `config`, `final-docs`, `review`) and the 18 section headings Task 10's SKILL.md refers to.

- [ ] **Step 1: Write `model-policy.md`**

```markdown
# Model policy

Owner-editable defaults. The planner classifies each item into one task type, starts from this row, and may propose a different pick with a reason. The owner confirms the model and effort of every row on every run.

| Task type | Matches | Model | Effort |
|---|---|---|---|
| security | auth, `firestore.rules`, `storage.rules`, `api/*` access checks | Opus | high |
| money | invoices, receipts, commission, pricing, COD | Opus | high |
| design-heavy | L items or 4+ separate decisions | Opus | medium |
| tests | tests-only items, coverage refresh | Sonnet | medium |
| small-ui | one module, UI behaviour, no rules | Sonnet | medium |
| config | one-file config or script edits | Sonnet | low |
| final-docs | the run's final docs step | Sonnet | low |
| review | the post-run review (orchestrator) | session model | n/a |

Confirmation options per row: Opus·high, Opus·medium, Sonnet·medium, Sonnet·low (Other for anything else).

## Learned
<!-- The review adds lines here only after the owner approves a proposed policy change: date, task type, change, evidence. -->
```

- [ ] **Step 2: Write `plan-template.md`** with the 18 headings from the spec, each followed by one line saying where its data comes from:

```markdown
# Agent run plan: <items>, <date>

## 1. Context and scope
Goal, items, wave. Source: PLAN.md roadmap.
## 2. Readiness check
Table: `staging` CI, open PRs for the items, `staging` vs `main`, changes since last run, Java and emulators, keep-awake preference, Auto-fix plan, meter now. Any ✗ is a blocker.
## 3. Scope and exclusions
Items left out: id, reason (dependency, owner, live, other wave).
## 4. Owner decisions needed
Per decision: question, recommended default, effect of "no".
## 5. Carry-overs
From PLAN.md Run calibration "Tuning" (not yet adopted) and the last review's findings.
## 6. Lanes and order
Output of `scripts/lanes.mjs`: lane, slot, items in order, lane minutes.
## 7. Conflict map
Item, files it touches, why it shares a lane.
## 8. Model and effort per item
Item, task type, policy default, agent's pick, why it differs, owner's choice (filled after confirmation).
## 9. Test plan per item
Layer, tests first, characterisation flip, rules test, e2e (none/once/three times), local checks vs CI.
## 10. Docs impact per item
Module CLAUDE.md, FINDINGS, security docs, fragment.
## 11. Guard rules and guarantees
The hard rules from SKILL.md, verbatim; rollback: revert the item's merge commit (rules items: also note the rules file).
## 12. Time per sub-step and wall-clock
From the rolling rates; range.
## 13. Timeline
Clock times per lane; window reset marked.
## 14. Usage as % of the 5-hour window
Meter now, per item, curve across the reset, weekly effect, calibration source and accuracy.
## 15. Usage guard
Output-token threshold, projected peak, run ID (after launch).
## 16. Risks and fallbacks per item
Risk, fallback, effect on time and usage.
## 17. Security and money watch-list
Items of task type security or money; always Opus.
## 18. Definition of done and post-run review
Merged PRs, fragments folded, local e2e on `staging`, review steps; optional: promotion recommendation, notifications.
```

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/agent-run/model-policy.md .claude/skills/agent-run/plan-template.md
git commit -m "feat(agent-run): model policy and plan template

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 8: Agent brief, workflow template and its syntax check

**Files:**
- Create: `.claude/skills/agent-run/agent-brief.md`, `.claude/skills/agent-run/workflow-template.js`, `.claude/skills/agent-run/scripts/check-workflow.mjs`
- Modify: `eslint.config.js` (ignore `workflow-template.js`: it uses Workflow globals and a top-level `return`)
- Test: `tests/unit/agentRunWorkflow.test.js`

**Interfaces:**
- Consumes: the fragment format (Task 1), `slotEnv` variable names (Task 3), `link-deps.sh` (Task 5).
- Produces: Workflow `args` shape: `{ brief: string, lanes: Array<Array<{ id, branch, slot, model, effort, backlog, files, notes, testPlan }>>, final: { model, effort }, guardOutputTokens: number|null, mainCheckout: string }`; `checkWorkflow(source) -> void` (throws on a syntax error).

- [ ] **Step 1: Write the failing test** `tests/unit/agentRunWorkflow.test.js`

```js
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/unit/agentRunWorkflow.test.js`
Expected: FAIL, cannot find `check-workflow.mjs`.

- [ ] **Step 3: Write `check-workflow.mjs`**

```js
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// Workflow scripts start with `export const meta` and may `return` at top level, so parse the
// body as an async function after dropping the `export` keyword.
export function checkWorkflow(source) {
  if (!/^export const meta = \{/m.test(source)) throw new Error('script must start with export const meta = {...}');
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  new AsyncFunction(source.replace(/^export const meta/m, 'const meta'));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  checkWorkflow(readFileSync(process.argv[2], 'utf8'));
  console.log('workflow script parses');
}
```

- [ ] **Step 4: Write `agent-brief.md`** (the text below, verbatim; `{{name}}` is filled per item)

```markdown
You are running ONE backlog item end to end in this repo: {{id}}. Model {{model}}, effort {{effort}}.

## Your item (from docs/04_workflows/BACKLOG.md)
{{backlog}}

## Expected files
{{files}}

## Module notes
{{notes}}

## Approved test plan
{{testPlan}}

## Setup
1. `git fetch origin && git switch -c {{branch}} origin/staging --no-track`
2. `.claude/skills/agent-run/scripts/link-deps.sh "{{mainCheckout}}"`
3. `eval "$(node tests/tools/testSlot.mjs {{slot}})"` (your emulator and dev-server ports; use them for every local rules or e2e run)

## Rules
- Tests first: write them, run them, see them fail for the right reason, then make the minimal change. Comments only where the why is not obvious.
- Local checks: `npm run lint`, your item's tests, the affected module's suites, plus rules and e2e exactly as the test plan says. CI is the full gate and must be green before merge.
- Docs: write `docs/04_workflows/changes/{{id}}.md` (format in `docs/04_workflows/changes/README.md`) and update your own `### {{id}}` section of BACKLOG.md and any module CLAUDE.md, FINDINGS or security doc your change affects. Do NOT edit CHANGELOG.md, the BACKLOG status line, TESTING.md's coverage map or PLAN.md.
- Open the PR: commit (message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`), push, `gh pr create --base staging` (body ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`). Then load `mcp__ccd_pr__set_monitor` with ToolSearch and call it with `auto_fix: false` and your PR's URL, so only you act on this PR. Report in "notes" if the call was not possible.
- `gh pr checks <n> --watch --interval 20`. At most 2 fix rounds for a failing check.
- Catch-up: if `origin/staging` moved, `git merge origin/staging` (never rebase, never force-push). If only docs files conflicted, resolve keeping both sides, confirm no conflict markers remain (`git diff --check`), push, wait for CI. If code conflicted, resolve, re-run your local checks, push, wait for CI.
- Merge with `gh pr merge <n> --merge` when every check is green. Never squash, never target main.
- Never: firebase deploy, console or config changes, live data, anything to main. If the item needs an owner decision or a live action, finish the repo part, leave the PR open and return status "pr-open-blocked".
- A bug outside your item: do not fix it silently; leave a characterisation test if useful, note it in your BACKLOG section and in "findings".

Return the structured result.
```

- [ ] **Step 5: Write `workflow-template.js`**

```js
export const meta = {
  name: 'agent-run',
  description: 'Run approved backlog items in two lanes, each PR merged to staging on green CI, then fold the change fragments',
  phases: [{ title: 'Lane 1' }, { title: 'Lane 2' }, { title: 'Final' }],
}

const RESULT = {
  type: 'object',
  properties: {
    item: { type: 'string' },
    status: { type: 'string', enum: ['merged', 'pr-open-blocked', 'failed', 'not-started'] },
    prUrl: { type: 'string' },
    merged: { type: 'boolean' },
    testCounts: { type: 'string' },
    summary: { type: 'string' },
    findings: { type: 'string' },
    fixRounds: { type: 'number' },
    catchUps: { type: 'number' },
    notes: { type: 'string' },
  },
  required: ['item', 'status', 'merged', 'summary'],
}

const fill = (template, values) => template.replace(/\{\{(\w+)\}\}/g, (_, key) => String(values[key] ?? ''))

const runLane = async (lane, index) => {
  const phaseTitle = `Lane ${index + 1}`
  const out = []
  for (const item of lane) {
    if (args.guardOutputTokens != null && budget.spent() >= args.guardOutputTokens) {
      log(`${phaseTitle}: usage guard reached before ${item.id}; not starting it.`)
      out.push({ item: item.id, status: 'not-started', merged: false, summary: 'usage guard' })
      break
    }
    const prompt = fill(args.brief, { ...item, mainCheckout: args.mainCheckout })
    const r = await agent(prompt, { label: item.id, phase: phaseTitle, isolation: 'worktree', model: item.model, effort: item.effort, schema: RESULT })
    const res = r || { item: item.id, status: 'failed', merged: false, summary: 'agent returned nothing' }
    out.push(res)
    if (!res.merged) { log(`${phaseTitle}: ${item.id} ${res.status}; stopping this lane.`); break }
    log(`${phaseTitle}: ${item.id} merged ${res.prUrl || ''}`)
  }
  return out
}

const laneResults = await parallel(args.lanes.map((lane, i) => () => runLane(lane, i)))
const results = laneResults.filter(Boolean).flat()
const merged = results.filter((r) => r.merged).map((r) => r.item)
if (!merged.length) return { results, final: null }

phase('Final')
const final = await agent(`Final step of an agent run in this repo. Items merged into staging: ${merged.join(', ')}.
1. git fetch origin && git switch -c claude/run-docs-${merged[0].toLowerCase()} origin/staging --no-track; .claude/skills/agent-run/scripts/link-deps.sh "${args.mainCheckout}".
2. Run npm run test:e2e once on this staging head (slot 0); record the result.
3. Fold every file in docs/04_workflows/changes/ except README.md, following that README: CHANGELOG.md, TESTING.md, the BACKLOG "Status at Milestone 1" line, PLAN.md (strike the items, update the wave bar and "next up"). Delete the folded fragments in the same commit.
4. Commit (message ends with "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"), push, gh pr create --base staging (body ends with "🤖 Generated with [Claude Code](https://claude.com/claude-code)"), call mcp__ccd_pr__set_monitor with auto_fix false for it, and DO NOT merge: the review stage adds the calibration and merges.
Return prUrl, the e2e result and anything a fragment said was blocked.`,
  { label: 'Final docs', phase: 'Final', isolation: 'worktree', model: args.final.model, effort: args.final.effort,
    schema: { type: 'object', properties: { prUrl: { type: 'string' }, e2e: { type: 'string' }, blocked: { type: 'string' } }, required: ['prUrl', 'e2e'] } })
return { results, final }
```

- [ ] **Step 6: Ignore it in ESLint** — in `eslint.config.js` change `{ ignores: ['dist', 'node_modules', 'coverage'] }` to `{ ignores: ['dist', 'node_modules', 'coverage', '.claude/skills/agent-run/workflow-template.js'] }`.

- [ ] **Step 7: Run the tests**

Run: `npx vitest run tests/unit/agentRunWorkflow.test.js && npm run lint && node .claude/skills/agent-run/scripts/check-workflow.mjs .claude/skills/agent-run/workflow-template.js`
Expected: PASS, 3 tests; lint clean; "workflow script parses".

- [ ] **Step 8: Commit**

```bash
git add .claude/skills/agent-run/agent-brief.md .claude/skills/agent-run/workflow-template.js .claude/skills/agent-run/scripts/check-workflow.mjs eslint.config.js tests/unit/agentRunWorkflow.test.js
git commit -m "feat(agent-run): agent brief, workflow template and syntax check

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 9: Review checklist

**Files:**
- Create: `.claude/skills/agent-run/review-checklist.md`

**Interfaces:**
- Consumes: the workflow result shape (`RESULT` in Task 8), the final step's open docs PR.
- Produces: the "Run calibration" section format in PLAN.md.

- [ ] **Step 1: Write `review-checklist.md`**

```markdown
# Post-run review

Run in the orchestrating session after the workflow returns. About 10 min, 3–4% of the window.

## 1. Collect
- Per agent: label, model, startedAt, durationMs, tokens, toolCalls from the workflow task output file (the `agents` array).
- Per PR: `gh pr view <n> --json createdAt,mergedAt`; CI rounds from `gh pr checks`; fixRounds and catchUps from the agent results.
- Meter: `mcp__ccd_session_mgmt__get_usage` now; the launch reading from the plan (section 15). If the run crossed the 5-hour reset, the run's total is the weekly delta converted with the "window % per weekly %" rate; each item's share is its token share of the total.

## 2. Compare
Table per item: est. min, actual min, est. %, actual %. Flag > 30% off with one cause: scope, catch-up, CI, environment, estimate model.

## 3. Calibration (overwrite PLAN.md "## Run calibration")
- Last run: date, items, agents, wall-clock, meter start → end, weekly start → end, run ID.
- The comparison table.
- Rolling rates (last 3 runs, one row each plus average): min per S / M / L item; min per CI round; min per catch-up; % per S / M / L item by model; agent startup floor %; output tokens per 1%; window % per weekly %; concurrency. Models share one rate until two runs with different Opus/Sonnet mixes exist; say so in the table.
- Model overrides: "owner changed X of Y picks" and which task types.
- Tuning: numbered rules, each "adopted" or "not yet" (not-yet lines carry over to the next plan's section 5).

## 4. Findings
- Product or code: a BACKLOG item (next free ID of the right prefix, wave, "found by <item>, <date>", evidence), after searching BACKLOG for an existing item.
- Process: GIT_WORKFLOW.md or TESTING.md if it changes how work runs, else the tuning list.
- Skill or model policy: a "proposed skill changes" list for the owner; never edit the skill or policy without approval.

## 5. Ship and report
- Commit the calibration and BACKLOG items to the final step's open docs PR branch, wait for CI, `gh pr merge <n> --merge`.
- Chat report: the comparison table, top 3 tuning changes, new BACKLOG items, proposed skill and policy changes, promotion recommendation (owner decides).
```

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/agent-run/review-checklist.md
git commit -m "feat(agent-run): post-run review checklist

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 10: SKILL.md, links, review pass and PR 2

**Files:**
- Create: `.claude/skills/agent-run/SKILL.md`
- Modify: `CLAUDE.md` ("Branching & deployment workflow": one line), `docs/04_workflows/GIT_WORKFLOW.md` (new section "Batched agent runs"), `PROJECT_INDEX.md`, `CHANGELOG.md`, `docs/05_decisions/0005-agent-run-skill.md` (status to "accepted, implemented")

**Interfaces:**
- Consumes: every file from Tasks 5–9.

- [ ] **Step 1: Write `SKILL.md`**

```markdown
---
name: agent-run
description: Plan, run and review a batch of backlog items in this repo as parallel worktree agents, each item tests-first and merged into staging on green CI. Use when the owner asks to "run the next wave", "plan and run items X, Y", "chain the remaining items", or to continue a Wave in PLAN.md with agents.
---

# agent-run

Three stages. Never skip the approval between Plan and Run.

## Hard rules (every run)
No deploys, nothing to main, no live data, no console or config changes. Tests first and seen failing. CI green to merge. e2e coverage never weakened. Merge staging in, never rebase or force-push. One owner per PR (agents switch Auto-fix off on their own PRs; the orchestrator never pushes to a branch whose agent is running). Skill and model-policy changes only with the owner's approval. At most 2 lanes on this machine.

## Stage 1: Plan (in plan mode)
1. Read PLAN.md (roadmap, "Run calibration", carry-overs), each item's BACKLOG section and dependencies, `gh pr list`, `git log origin/main..origin/staging`, and the meter (`mcp__ccd_session_mgmt__get_usage`).
2. Classify each item with `model-policy.md`; estimate minutes per item from the calibration rates; write `items.json` (`id, minutes, files, deps`) to the scratchpad and run `node .claude/skills/agent-run/scripts/lanes.mjs items.json`.
3. Fill every section of `plan-template.md` into the plan file.
4. Confirm model and effort for every row with AskUserQuestion: one question per row, options Opus·high, Opus·medium, Sonnet·medium, Sonnet·low, the pick first with "(Recommended)". Up to 4 rows per call. Recompute sections 12–15 with the answers.
5. ExitPlanMode.

## Stage 2: Run (after approval)
1. Read the meter again; if the projected peak (now + section 14) exceeds 80%, stop and report.
2. Confirm the keep-awake preference is on (ccd_settings) or call `mcp__ccd_host__request_keep_awake` with `until: "session_idle"`.
3. Build `args`: `brief` = the text of `agent-brief.md`; `lanes` from section 6 with each item's `branch` (`claude/<id-lowercase>-<topic>`), `slot` (lane number, 1 or 2), `model`, `effort`, `backlog` (its BACKLOG section text), `files`, `notes` (module CLAUDE.md "Before you edit" bullets), `testPlan` (section 9 row); `final` from section 8; `guardOutputTokens` from section 15; `mainCheckout` = the main repository path.
4. `node .claude/skills/agent-run/scripts/check-workflow.mjs .claude/skills/agent-run/workflow-template.js`, then launch Workflow with `scriptPath` = the template and `args`. Post the run ID.
5. While it runs, leave agent PRs alone. Auto-fix events about an agent's PR get a one-line reply only.

## Stage 3: Review (when the workflow returns)
Follow `review-checklist.md` end to end, then report.
```

- [ ] **Step 2: Links**

`CLAUDE.md`, after the "Work happens on one `claude/<topic>` branch per item..." bullet:

```
- Batched agent runs (several backlog items in parallel worktrees) use the repo skill `.claude/skills/agent-run/` (decision 0005).
```

`GIT_WORKFLOW.md`, new section before "## Promotion to `main`":

```markdown
## Batched agent runs

Several items at once run through the `agent-run` skill ([0005](../05_decisions/0005-agent-run-skill.md)): two lanes in separate worktrees with their own test slots, change fragments instead of shared doc lines, `git merge origin/staging` to catch up (never rebase), each PR merged into `staging` on green CI, one docs PR per run that folds the fragments and records calibration.
```

`PROJECT_INDEX.md` (with the 04_workflows entries): `- [AGENT_RUN_PLAN.md](docs/04_workflows/AGENT_RUN_PLAN.md): implementation plan for the agent-run skill (decision 0005)` if not already present, and `- .claude/skills/agent-run/: the agent-run skill (plan, run, review)`.

- [ ] **Step 3: Skill review pass** — dispatch the `plugin-dev:skill-reviewer` agent on `.claude/skills/agent-run/SKILL.md` with the spec path. Apply only findings that fix a missing step, a wrong trigger or an ambiguity; record any others in the PR body.

- [ ] **Step 4: Full local gate**

Run: `npm run lint && npm run test:all && npm run build`
Expected: green; unit count +10 over PR 1 (7 lanes + 3 workflow).

- [ ] **Step 5: CHANGELOG and spec status**

CHANGELOG under `## Unreleased`:

```
- `agent-run` skill (`.claude/skills/agent-run/`, decision 0005): plans a batch of backlog items with an 18-section template and per-row model and effort confirmation, runs them as two worktree lanes with their own test slots and change fragments, and reviews estimates against actuals into PLAN.md's Run calibration. Tests: unit +10 (lane builder, usage guard, workflow template parse, brief placeholders).
```

In `0005-agent-run-skill.md` set `Status: accepted, 2026-10-02; implemented by PR <prereq #> and PR <skill #>.`

- [ ] **Step 6: Commit, push, PR, merge on green**

```bash
git add .claude/skills/agent-run/SKILL.md CLAUDE.md docs/04_workflows/GIT_WORKFLOW.md PROJECT_INDEX.md CHANGELOG.md docs/05_decisions/0005-agent-run-skill.md
git commit -m "feat(agent-run): SKILL.md and links

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push -u origin claude/agent-run-skill
gh pr create --base staging --title "agent-run skill: plan, run and review batched agent runs" --body "<summary of Tasks 6-10, skill-reviewer outcome, ending with the Claude Code line>"
gh pr checks <n> --watch --interval 20 && gh pr merge <n> --merge
```

Expected: CI green, merged into `staging`.

---

## After both PRs

The pilot (Wave A2: MON-8, FEA-12, FEA-13, ENG-7) is a separate request that invokes the skill. Its review measures the success criteria in the spec against the 2026-10-01 baseline.
