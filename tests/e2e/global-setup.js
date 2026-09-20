import { execFileSync } from 'node:child_process';
import waitOn from 'wait-on';

// Runs after Playwright has started the emulators and the emulator-mode dev server.
export default async function globalSetup() {
  const project = process.env.GCLOUD_PROJECT || '';
  const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST || '';
  const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || '';
  const local = /^(127\.0\.0\.1|localhost)(:|$)/;

  if (!project.startsWith('demo-') || !local.test(firestoreHost) || !local.test(authHost)) {
    throw new Error(
      `E2E refuses to run: it must target local emulators and a demo- project ` +
        `(GCLOUD_PROJECT="${project}", FIRESTORE_EMULATOR_HOST="${firestoreHost}", FIREBASE_AUTH_EMULATOR_HOST="${authHost}").`
    );
  }

  await waitOn({
    resources: [`tcp:${firestoreHost}`, `tcp:${authHost}`, 'tcp:127.0.0.1:3000'],
    timeout: 60_000,
  });

  execFileSync(process.execPath, ['tests/fixtures/seed.mjs'], { stdio: 'inherit', env: process.env });
}
