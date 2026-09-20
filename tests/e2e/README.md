# End-to-end tests

Playwright drives the real app in Chromium against the Firebase emulators. Nothing here touches real Firebase.

## Run
```bash
npm run test:e2e
```
Playwright starts `firebase emulators:start` (Firestore and Auth) and `npm run dev:emulated` (Vite in `--mode test`, which loads the committed `.env.test`), waits for the ports, then `tests/e2e/global-setup.js` runs `tests/fixtures/seed.mjs`. Locally it reuses servers you already have running.

The run fails up front unless `GCLOUD_PROJECT` starts with `demo-` and the emulator hosts are local.

## Prerequisites
- Java (the emulators need a JVM) and the `firebase` CLI (`npm install -g firebase-tools`).
- Chromium: `npx playwright install chromium` (about 150 MB download, once).

## Seeded accounts
Password `Passw0rd!test`: `admin@example.com` (Admin), `partner@example.com` (Partner), `deactivated@example.com` (Sales, Deactivated). See `docs/04_workflows/TESTING.md`.

## Debug
`npx playwright test --ui` opens the UI mode; `--headed` shows the browser; `--debug` steps through a test. Traces and failure screenshots land in `test-results/`.

Prefer role and accessible-name selectors (`getByRole`, `getByLabel`) over CSS so tests survive styling changes. Tests share one seeded emulator, so they run serially (`workers: 1`).
