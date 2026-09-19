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

Names only (values live in Vercel and a local `.env`, never in git): `GEMINI_API_KEY`, `APP_URL`, `FIREBASE_SERVICE_ACCOUNT_JSON` (server), `VITE_FIREBASE_*` (API_KEY, AUTH_DOMAIN, PROJECT_ID, STORAGE_BUCKET, MESSAGING_SENDER_ID, APP_ID, MEASUREMENT_ID, DATABASE_ID, OAUTH_CLIENT_ID), `VITE_SENTRY_DSN`, `VITE_GOOGLE_MAPS_API_KEY`. `FIREBASE_SERVICE_ACCOUNT_JSON` is required even in local dev for the admin-user endpoint.

## Firebase console settings not tracked in the repo

- Authentication > Settings > **Authorized domains** must include the serving domains (`portal.print2frame.xyz`, `www.print2frame.xyz`, and the auth domain `auth.print2frame.xyz` used by the config), or Google sign-in fails with `auth/unauthorized-domain` / `auth/invalid-continue-uri`.
- Verify client config with `firebase apps:sdkconfig`, not the committed `firebase-applet-config.json`, which has drifted before.

## Local commands

```bash
npm run dev         # Vite on 0.0.0.0:3000, proxies /api/* locally
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
