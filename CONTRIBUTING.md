# Contributing

## Workflow

1. Branch from `staging`. Name it for the change, for example `fix/invoice-reprint` or `feat/logistics-fleet`.
2. Make one focused change per pull request. Open the PR into `staging`, never straight into `main`.
3. Add or update tests with the change. Start from [docs/04_workflows/TESTING.md](docs/04_workflows/TESTING.md).
4. Before pushing, run the same checks CI runs:

   ```bash
   npm run lint
   npm test
   npm run test:api
   npm run test:component
   npm run test:rules   # needs Java and the Firebase CLI
   npm run build
   ```

5. Add a line to [CHANGELOG.md](CHANGELOG.md) describing the change and, if you touch a module's behaviour, update that module's notes under `docs/02_modules/`.

## Import style

Code under `src/` and the Vitest tests import app code with the `@/` alias (`@/utils/toast` means `src/utils/toast`). Files in the same folder or a child folder use `./`. Never use `../` to reach into another folder; ESLint fails the build if you do. The exceptions are files Vite does not process: `api/` (Vercel functions), the root config files, Playwright specs and node fixtures keep relative paths.

## Rules that are easy to break

- Never commit secrets. Docs and `.env.example` list variable names only.
- Changes to `firestore.rules` are only a file change until someone deploys them by hand. Say so in the PR and do not deploy without the maintainer's approval.
- Permissions live in three places that must agree: `src/context/PermissionsContext.jsx`, `firestore.rules` and `src/constants/roles.js`.
- Do not change behaviour in a refactor pull request. Moves and renames go in their own PR.

## Where things are

See the project structure in [README.md](README.md) and the full document list in [PROJECT_INDEX.md](PROJECT_INDEX.md).
