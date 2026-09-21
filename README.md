# Print To Frame ERP

A single-page ERP/CRM for a custom-framing business: leads, quotations, deals, fabrication, logistics and invoicing, plus a partner referral network. React 18 + Vite in the browser, Firebase (Auth, Firestore, Storage) as the only backend, and a few Vercel serverless functions in `api/` for the AI proxy, email and admin user actions.

## Prerequisites

- Node 22 (`nvm use` reads `.nvmrc`)
- Java 21 and the Firebase CLI (`npm install -g firebase-tools`), only for the rules tests
- A browser and, for end-to-end tests, Playwright (`npx playwright install`)

## Getting started

```bash
npm ci
cp .env.example .env.local   # then fill in what you need; see the comments in the file
npm run dev                  # http://localhost:3000
```

To run the whole app against the local Firebase emulators with fake data instead of a real project:

```bash
npx firebase emulators:start --only firestore,auth --project demo-print2frame-test
npm run seed:emulator        # in a second terminal
npm run dev:emulated
```

The emulator setup covers Firestore and Auth only. File uploads (partner documents, fabrication blueprints) need a real Storage bucket. Seeded logins are listed in [docs/04_workflows/TESTING.md](docs/04_workflows/TESTING.md).

Server-side features (AI drafting, email, creating or resetting Firebase Auth users) need real credentials: `GEMINI_API_KEY`, `SMTP_USER` and `SMTP_APP_PASSWORD`, and `FIREBASE_SERVICE_ACCOUNT_JSON`. Never commit them. In production they are Vercel environment variables.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server on port 3000, with a local proxy for `/api/*` |
| `npm run dev:emulated` | Dev server in `test` mode, using the emulator settings in `.env.test` |
| `npm run build` / `npm run preview` | Production build to `dist/`, and serve it locally |
| `npm run lint` | ESLint over the whole repo |
| `npm test` | Unit tests (`tests/unit`) |
| `npm run test:api` | API handler tests with mocked Firebase Admin, Gemini and SMTP |
| `npm run test:component` | React component tests (jsdom and Testing Library) |
| `npm run test:rules` | `firestore.rules` tests on the Firebase emulator (needs Java) |
| `npm run test:e2e` | Playwright browser tests against the emulators |
| `npm run test:all` | Unit, API, component and rules tests in sequence |
| `npm run coverage` | Unit and API tests with a coverage report in `coverage/` |
| `npm run seed:emulator` | Load fake users and data into a running emulator |

`push:staging` and `deploy:live` are maintainer shortcuts for the release flow below; do not run them casually.

## Testing

Five layers, each with one job: unit, API, component, rules and end to end. Pick the cheapest layer that can prove the behaviour. The guide, the coverage map and how to add a test are in [docs/04_workflows/TESTING.md](docs/04_workflows/TESTING.md). CI runs lint, unit, API, component, build and rules on every pull request.

## Project structure

```
api/            Vercel serverless functions (AI proxy, email, admin user actions)
public/         static assets
src/
  App.jsx       composition root: state, Firestore listeners, routing by tab
  components/   screens and shared UI (being reorganised into features/ and shared/, see PLAN.md 8.2)
  services/     Firebase, Firestore sync, audit log, Gemini, mail and other clients
  utils/        pure business logic and helpers
  context/      permissions and messaging providers
  constants/    roles, company info, email templates
tests/          unit, api, component, integration (rules), e2e, helpers, fixtures
docs/           architecture, per-module notes, security, workflows, decisions
firestore.rules Firestore security rules (deployed by hand, never by a push)
```

Access control is enforced in three places that must agree: `src/context/PermissionsContext.jsx`, `firestore.rules` and `src/constants/roles.js` (see [docs/03_security/RBAC_MODEL.md](docs/03_security/RBAC_MODEL.md)).

## Branches and deploys

- Work on a branch, open a pull request into `staging`. `staging` builds a Vercel preview.
- `main` is production (`portal.print2frame.xyz`). It only receives a reviewed merge from `staging`.
- Pushing does not deploy Firestore rules. Any change to `firestore.rules` is deployed separately by an authorised maintainer with `firebase deploy --only firestore:rules --project <project-id>`. See [docs/04_workflows/DEPLOY_PROCESS.md](docs/04_workflows/DEPLOY_PROCESS.md) and [docs/04_workflows/GIT_WORKFLOW.md](docs/04_workflows/GIT_WORKFLOW.md).

## Documentation

Everything written about the system is listed in [PROJECT_INDEX.md](PROJECT_INDEX.md). Progress and open work are tracked in [PLAN.md](PLAN.md), changes in [CHANGELOG.md](CHANGELOG.md), and how to contribute in [CONTRIBUTING.md](CONTRIBUTING.md).
