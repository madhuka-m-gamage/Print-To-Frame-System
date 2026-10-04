# Project Index

One-stop map of every document in this repo. Update this file whenever a doc is added, moved or removed.

## Code layout

- Frontend: `src/` (React + Vite SPA), organised by business domain in `src/features/<domain>`, with cross-feature code in `src/shared` and infrastructure clients in `src/services`
- Backend: `api/` (Vercel serverless functions)
- Cloud Functions: none (no `functions/` folder)
- Firestore rules: `firestore.rules`
- Storage rules: `storage.rules`

## Root

- [README.md](README.md): setup, scripts, structure
- [CLAUDE.md](CLAUDE.md): shared instructions for Claude Code
- `CLAUDE.local.md`: personal, gitignored
- [CHANGELOG.md](CHANGELOG.md): change history
- [PLAN.md](PLAN.md): progress tracker, Milestone 2 scope and burn-down
- [CONTRIBUTING.md](CONTRIBUTING.md): how to contribute
- [LICENSE](LICENSE): proprietary, all rights reserved

## Architecture

- [SYSTEM_OVERVIEW.md](docs/01_architecture/SYSTEM_OVERVIEW.md): repo layout, frontend/backend split
- [GCP_INVENTORY.md](docs/01_architecture/GCP_INVENTORY.md): functions and triggers, code vs console-only
- [CROSS_MODULE_TRIGGERS.md](docs/01_architecture/CROSS_MODULE_TRIGGERS.md): trigger chains across modules

## Modules

Map, then per-module Claude instructions.

- [auth](docs/02_modules/auth/README.md) | [instructions](docs/02_modules/auth/CLAUDE.md) | [findings](docs/02_modules/auth/FINDINGS.md)
- [cost-calculator-quotation](docs/02_modules/cost-calculator-quotation/README.md) | [instructions](docs/02_modules/cost-calculator-quotation/CLAUDE.md) | [findings](docs/02_modules/cost-calculator-quotation/FINDINGS.md)
- [customers](docs/02_modules/customers/README.md) | [instructions](docs/02_modules/customers/CLAUDE.md) | [findings](docs/02_modules/customers/FINDINGS.md)
- [deals](docs/02_modules/deals/README.md) | [instructions](docs/02_modules/deals/CLAUDE.md) | [findings](docs/02_modules/deals/FINDINGS.md)
- [employees](docs/02_modules/employees/README.md) | [instructions](docs/02_modules/employees/CLAUDE.md) | [findings](docs/02_modules/employees/FINDINGS.md)
- [internal-messaging](docs/02_modules/internal-messaging/README.md) | [instructions](docs/02_modules/internal-messaging/CLAUDE.md) | [findings](docs/02_modules/internal-messaging/FINDINGS.md)
- [invoicing](docs/02_modules/invoicing/README.md) | [instructions](docs/02_modules/invoicing/CLAUDE.md) | [findings](docs/02_modules/invoicing/FINDINGS.md)
- [leads](docs/02_modules/leads/README.md) | [instructions](docs/02_modules/leads/CLAUDE.md) | [findings](docs/02_modules/leads/FINDINGS.md)
- [notifications](docs/02_modules/notifications/README.md) | [instructions](docs/02_modules/notifications/CLAUDE.md) | [findings](docs/02_modules/notifications/FINDINGS.md)
- [operations-fabrication](docs/02_modules/operations-fabrication/README.md) | [instructions](docs/02_modules/operations-fabrication/CLAUDE.md) | [findings](docs/02_modules/operations-fabrication/FINDINGS.md)
- [operations-inspection](docs/02_modules/operations-inspection/README.md) | [instructions](docs/02_modules/operations-inspection/CLAUDE.md) | [findings](docs/02_modules/operations-inspection/FINDINGS.md)
- [operations-logistics](docs/02_modules/operations-logistics/README.md) | [instructions](docs/02_modules/operations-logistics/CLAUDE.md) | [findings](docs/02_modules/operations-logistics/FINDINGS.md)
- [partners](docs/02_modules/partners/README.md) | [instructions](docs/02_modules/partners/CLAUDE.md) | [findings](docs/02_modules/partners/FINDINGS.md)
- [profile-settings](docs/02_modules/profile-settings/README.md) | [instructions](docs/02_modules/profile-settings/CLAUDE.md) | [findings](docs/02_modules/profile-settings/FINDINGS.md)
- [receipts](docs/02_modules/receipts/README.md) | [instructions](docs/02_modules/receipts/CLAUDE.md) | [findings](docs/02_modules/receipts/FINDINGS.md)
- [user-management-rbac](docs/02_modules/user-management-rbac/README.md) | [instructions](docs/02_modules/user-management-rbac/CLAUDE.md) | [findings](docs/02_modules/user-management-rbac/FINDINGS.md)

## Security

- [RBAC_MODEL.md](docs/03_security/RBAC_MODEL.md)
- [AUTHORIZATION_MAP.md](docs/03_security/AUTHORIZATION_MAP.md): every place that grants, checks or bypasses access, and the findings from the 2026-09-21 sweep
- [FIRESTORE_RULES_NOTES.md](docs/03_security/FIRESTORE_RULES_NOTES.md)

## Workflows

- [BACKLOG.md](docs/04_workflows/BACKLOG.md): every work item with its ID, Milestone 2 scope and the After v2 list
- [LIVE_ROLLOUT.md](docs/04_workflows/LIVE_ROLLOUT.md): the approval-gated runbook for the live matrix, code promotion and rules deploys (approach under review, decision 0006)
- [GIT_WORKFLOW.md](docs/04_workflows/GIT_WORKFLOW.md)
- [DEPLOY_PROCESS.md](docs/04_workflows/DEPLOY_PROCESS.md)
- [TESTING.md](docs/04_workflows/TESTING.md)
- [changes/README.md](docs/04_workflows/changes/README.md): change fragments written by items in a multi-agent run
- [AGENT_RUN_PLAN.md](docs/04_workflows/AGENT_RUN_PLAN.md): implementation plan for the agent-run skill (decision 0005)
- [AGENT_RUN_CARDS_PLAN.md](docs/04_workflows/AGENT_RUN_CARDS_PLAN.md): implementation plan for the model decision cards (decision 0005 addendum)
- `.claude/agent-run.json`: this repo's profile for the user-level `agent-run` skill; `.claude/skills/agent-run/` is the older repo copy
- [POST_MERGE_VERIFICATION_REPORT.md](docs/POST_MERGE_VERIFICATION_REPORT.md): historical: Antigravity 16-module review verification
- [HANDOFF_REPORT.md](docs/HANDOFF_REPORT.md): Milestone 1 handoff (journey, live vs repo, how we work, what's left)

## Decisions

- [0001-why-quotation-engine-is-custom.md](docs/05_decisions/0001-why-quotation-engine-is-custom.md)
- [0002-deferred-until-live-rollout.md](docs/05_decisions/0002-deferred-until-live-rollout.md)
- [0003-source-layout.md](docs/05_decisions/0003-source-layout.md): `src/features`, `src/shared` and the `@/` import alias
- [0004-owner-decisions-backlog.md](docs/05_decisions/0004-owner-decisions-backlog.md): answers to backlog decisions DEC-1 to DEC-9
- [0005-agent-run-skill.md](docs/05_decisions/0005-agent-run-skill.md): the `agent-run` skill for batched agent runs (accepted)
- [0006-v2-scope-freeze.md](docs/05_decisions/0006-v2-scope-freeze.md): Milestone 2 scope freeze, finding triage and burn-down
