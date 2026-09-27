# Deploy Process

> How staging previews and production deployments happen. Sources: `CLAUDE.md`, `vercel.json`, `firebase.json`, `package.json`. Vercel project settings are not visible from the repo and were not checked.

## Hosting model

- **SPA + `api/*` serverless functions: Vercel.** `vercel.json` rewrites `/api/*` to `api/*` and everything else to `index.html`. Build: `npm run build` (Vite, output `dist/`).
- **Firestore rules and (optionally) Firebase Hosting: Firebase.** `firebase.json` defines a Hosting target (`dist`) and Firestore rules, but production traffic is served by Vercel per the project notes.
- **No Cloud Functions** exist ([GCP_INVENTORY.md](../01_architecture/GCP_INVENTORY.md)).

## Staging (preview)

Push to the `staging` branch; Vercel builds a preview deployment. Check the preview before merging.

## Production

Merge `staging` into `main` and push; Vercel deploys `main` to `portal.print2frame.xyz`. Needs explicit confirmation (see [GIT_WORKFLOW.md](GIT_WORKFLOW.md)).

## Firestore rules deployment

Pushing `firestore.rules` does **not** change live rules. Deploy separately:

```bash
firebase deploy --only firestore:rules --project print-to-frame-erp
```

`firebase` is installed and authenticated as the project owner in this environment. Confirm which of the three databases in `firebase.json` the app targets before deploying.

## Environment variables

Names only (values live in Vercel and a local `.env`, never in git): `GEMINI_API_KEY`, `APP_URL`, `FIREBASE_SERVICE_ACCOUNT_JSON` (server), `VITE_FIREBASE_*` (API_KEY, AUTH_DOMAIN, PROJECT_ID, STORAGE_BUCKET, MESSAGING_SENDER_ID, APP_ID, MEASUREMENT_ID, DATABASE_ID, OAUTH_CLIENT_ID), `VITE_SENTRY_DSN`, `VITE_GOOGLE_MAPS_API_KEY`. `FIREBASE_SERVICE_ACCOUNT_JSON` is required even in local dev: all three endpoints verify the caller's ID token with it.

## Storage rules deployment

`storage.rules` (owner decision DEC-3) is also deployed by hand, never by pushing:

```bash
firebase deploy --only storage --project print-to-frame-erp
```

The rules call `firestore.get()` on the caller's `users` document, so the Storage service agent needs `roles/firebaserules.firestoreServiceAgent`. An interactive deploy asks to grant it; a `--non-interactive` deploy skips the prompt silently, so check it with `gcloud projects get-iam-policy`. Status: deployed to `print-to-frame-erp` on 2026-09-27 (default bucket `print-to-frame-erp.firebasestorage.app`, `asia-south1`, created in production mode), and the Storage service agent was granted `roles/firebaserules.firestoreServiceAgent` so the rules can read `users`.

## Firebase console settings not tracked in the repo

- State on 2026-09-27 (owner): the Google Picker API and Cloud Storage for Firebase API are enabled; the browser key "Browser key (auto created by Firebase)" allows the Picker API and has no website restriction yet (backlog SEC-10); the default bucket `print-to-frame-erp.firebasestorage.app` is in `asia-south1`; the Storage service agent has `roles/firebaserules.firestoreServiceAgent`.
- Authentication > Settings > **Authorized domains** must include the serving domains (`portal.print2frame.xyz`, `www.print2frame.xyz`, and the auth domain `auth.print2frame.xyz` used by the config), or Google sign-in fails with `auth/unauthorized-domain` / `auth/invalid-continue-uri`.
- Verify client config with `firebase apps:sdkconfig`, not the committed `firebase-applet-config.json`, which has drifted before.

## Local commands

```bash
npm run dev         # Vite on 127.0.0.1:3000, runs the api/*.js handlers locally
npm run build
npm test            # unit tests
npm run test:rules  # Firestore rules vs local emulator (needs Java)
npm run lint
```

## Rollback

Not documented in the repo. On Vercel, redeploy or promote a previous deployment from the dashboard; for rules, redeploy the previous `firestore.rules` from git.

## Open questions

- Vercel project settings (root directory, env vars, Git integration) were not verified.
- Whether Firebase Hosting is used at all alongside Vercel.
