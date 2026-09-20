# Project Index

One-stop map of every document in this repo. Update this file whenever a doc is added, moved or removed.

## Code layout

- Frontend: `src/` (React + Vite SPA)
- Backend: `api/` (Vercel serverless functions)
- Cloud Functions source: `functions/` (none yet)
- Firestore rules: `firestore.rules`

## Root

- [CLAUDE.md](CLAUDE.md): shared instructions for Claude Code
- `CLAUDE.local.md`: personal, gitignored
- [CHANGELOG.md](CHANGELOG.md): change history
- [PLAN.md](PLAN.md): current investigation progress

## Architecture

- [SYSTEM_OVERVIEW.md](docs/01_architecture/SYSTEM_OVERVIEW.md): repo layout, frontend/backend split
- [GCP_INVENTORY.md](docs/01_architecture/GCP_INVENTORY.md): functions and triggers, code vs console-only
- [CROSS_MODULE_TRIGGERS.md](docs/01_architecture/CROSS_MODULE_TRIGGERS.md): trigger chains across modules

## Modules

Map, then per-module Claude instructions.

- [auth](docs/02_modules/auth.md) | [instructions](docs/02_modules/auth/CLAUDE.md) | [findings](docs/02_modules/auth/FINDINGS.md)
- [cost-calculator-quotation](docs/02_modules/cost-calculator-quotation.md) | [instructions](docs/02_modules/cost-calculator-quotation/CLAUDE.md) | [findings](docs/02_modules/cost-calculator-quotation/FINDINGS.md)
- [customers](docs/02_modules/customers.md) | [instructions](docs/02_modules/customers/CLAUDE.md) | [findings](docs/02_modules/customers/FINDINGS.md)
- [deals](docs/02_modules/deals.md) | [instructions](docs/02_modules/deals/CLAUDE.md) | [findings](docs/02_modules/deals/FINDINGS.md)
- [employees](docs/02_modules/employees.md) | [instructions](docs/02_modules/employees/CLAUDE.md) | [findings](docs/02_modules/employees/FINDINGS.md)
- [internal-messaging](docs/02_modules/internal-messaging.md) | [instructions](docs/02_modules/internal-messaging/CLAUDE.md) | [findings](docs/02_modules/internal-messaging/FINDINGS.md)
- [invoicing](docs/02_modules/invoicing.md) | [instructions](docs/02_modules/invoicing/CLAUDE.md) | [findings](docs/02_modules/invoicing/FINDINGS.md)
- [leads](docs/02_modules/leads.md) | [instructions](docs/02_modules/leads/CLAUDE.md) | [findings](docs/02_modules/leads/FINDINGS.md)
- [notifications](docs/02_modules/notifications.md) | [instructions](docs/02_modules/notifications/CLAUDE.md) | [findings](docs/02_modules/notifications/FINDINGS.md)
- [operations-fabrication](docs/02_modules/operations-fabrication.md) | [instructions](docs/02_modules/operations-fabrication/CLAUDE.md) | [findings](docs/02_modules/operations-fabrication/FINDINGS.md)
- [operations-inspection](docs/02_modules/operations-inspection.md) | [instructions](docs/02_modules/operations-inspection/CLAUDE.md) | [findings](docs/02_modules/operations-inspection/FINDINGS.md)
- [operations-logistics](docs/02_modules/operations-logistics.md) | [instructions](docs/02_modules/operations-logistics/CLAUDE.md) | [findings](docs/02_modules/operations-logistics/FINDINGS.md)
- [partners](docs/02_modules/partners.md) | [instructions](docs/02_modules/partners/CLAUDE.md) | [findings](docs/02_modules/partners/FINDINGS.md)
- [profile-settings](docs/02_modules/profile-settings.md) | [instructions](docs/02_modules/profile-settings/CLAUDE.md) | [findings](docs/02_modules/profile-settings/FINDINGS.md)
- [receipts](docs/02_modules/receipts.md) | [instructions](docs/02_modules/receipts/CLAUDE.md) | [findings](docs/02_modules/receipts/FINDINGS.md)
- [user-management-rbac](docs/02_modules/user-management-rbac.md) | [instructions](docs/02_modules/user-management-rbac/CLAUDE.md) | [findings](docs/02_modules/user-management-rbac/FINDINGS.md)

## Security

- [RBAC_MODEL.md](docs/03_security/RBAC_MODEL.md)
- [FIRESTORE_RULES_NOTES.md](docs/03_security/FIRESTORE_RULES_NOTES.md)

## Workflows

- [GIT_WORKFLOW.md](docs/04_workflows/GIT_WORKFLOW.md)
- [DEPLOY_PROCESS.md](docs/04_workflows/DEPLOY_PROCESS.md)
- [TESTING.md](docs/04_workflows/TESTING.md)
- [POST_MERGE_VERIFICATION_REPORT.md](docs/POST_MERGE_VERIFICATION_REPORT.md): 16-module post-merge verification report
- [HANDOFF_REPORT.md](docs/HANDOFF_REPORT.md): Antigravity to Claude Code handoff report

## Decisions

- [0001-why-quotation-engine-is-custom.md](docs/05_decisions/0001-why-quotation-engine-is-custom.md)
