# 0003: Source layout by feature, with an `@/` import alias

## Status

Accepted, 2026-09-21. Implemented in Phase 7 step 8.2 (pull requests #42 to #51 and the one that adds this file).

## Context

The project grew as a proof of concept, and its layout reflected how it was built rather than what it does. A newcomer had to learn our history to find anything:

- `src/components/` was split by vague names (`common`, `tools`, `crm`), and `crm` held CRM, finance and quotation screens together.
- Business logic for one domain was scattered across `utils/`, `services/` and `components/` (invoicing alone lived in five places).
- Every import was relative (`../../utils/...`), so moving any file broke dozens of others, which made restructuring feel too risky to attempt.
- The README was an unedited AI Studio template, there was no `.env.example`, and each module had its documentation in two places.

The goal was a structure that a developer who has never seen this repository would recognise from common React and Vite projects.

## Decision

1. **Organise `src/` by business domain.** Each domain is a folder under `src/features/` that holds its screens, its logic and any client only it uses:
   `auth`, `profile`, `dashboard`, `messaging`, `leads`, `customers`, `quotations`, `deals`, `invoicing`, `partners`, `fabrication`, `logistics`, `admin`.
2. **Keep cross-cutting code out of features.**
   - `src/shared/ui/`: presentational primitives (tables, cards, modals, filters).
   - `src/shared/components/`: components used by several features (delete confirmation, error boundary, pickers).
   - `src/shared/utils/`: pure helpers with no business meaning (dates, validation, CSV, toast, entity matching).
   - `src/services/`: infrastructure clients (Firebase, Firestore sync, audit log, Gemini, mail, Drive, Contacts, Maps).
   - `src/context/` and `src/constants/`: the permissions provider, roles, company info and email templates.
3. **One dependency rule.** A feature may import `@/shared`, `@/services`, `@/context`, `@/constants` and other features by `@/features/<name>/...`. `shared`, `services`, `context` and `constants` never import a feature.
4. **One import style.** Outside its own folder, code under `src/` and the Vitest tests imports with the `@/` alias, which means `src/`. Same-folder and child-folder imports use `./`. ESLint enforces this (`no-restricted-imports` in `eslint.config.js`).
5. **Files that Vite does not process keep relative paths:** `api/` (Vercel functions), the root config files, Playwright specs and node fixtures.
6. **Tests stay grouped by type** (`tests/unit`, `component`, `api`, `integration`, `e2e`), as described in `docs/04_workflows/TESTING.md`.
7. **Docs:** one folder per module, `docs/02_modules/<module>/{README.md, CLAUDE.md, FINDINGS.md}`.

Where a file belongs when unsure: if only one domain uses it, put it in that feature; if several use it and it knows nothing about the business, `shared`; if it talks to an external service, `services`.

## How it was done

The move was made with a small script that renamed files with `git mv` and rewrote every import, `vi.mock` path and documentation path from a manifest, in twelve small pull requests that each passed the full test gate (lint, unit, API, component, rules, build and a browser smoke test). Nothing else changed in those pull requests, so each diff is renames plus import lines. The script and its link checker were temporary and were deleted afterwards; they are in git history (pull requests #45 and #44).

## Consequences

- A new domain is a new folder under `src/features/`, and a change to one domain stays in one folder.
- Cross-feature imports are visible and intentional (`@/features/invoicing/...` from logistics, for example), which makes coupling easier to see and reduce.
- The alias needs a line in each tool config (`vite.config.js`, both Vitest configs, `jsconfig.json` for editors); a new tool that resolves modules on its own must be given the same alias or use relative paths.
- Two clients (`googleMapsService`, `contactsService`) stayed in `services/` even though one feature uses each, because a shared component uses the Maps client and `shared` must not import a feature.

## Not done, on purpose

- **Splitting the very large files** (`App.jsx`, `Partners.jsx`, `LeadCardDetails.jsx`, `FabricationWorks.jsx` and others over 800 lines). That changes code, not layout, and belongs in its own steps with tests. It is in the `PLAN.md` follow-up backlog.
- **Code formatter.** No Prettier yet; adopting it would rewrite most files and should be its own change.
- **Co-locating tests with source.** The by-type layout is documented and works with the current scripts and CI.

## Alternatives considered

- **Keep the layered layout** (`components/`, `services/`, `utils/`) and only rename folders. Cheaper, but the confusing part was scattering one domain across layers, which renaming does not fix.
- **Full feature-sliced design** with separate `entities`, `widgets` and `pages` layers. More structure than a codebase of this size needs.
