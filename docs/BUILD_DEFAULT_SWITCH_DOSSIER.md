# Build Default Switch Dossier

This dossier tracks the evidence and completion status for promoting `rolldown` to the canonical build backend default.

Current default:

- `rolldown`

Previous default:

- `bun`

## Required Evidence

- `bun run build:parity`
- `bun run build:canary`
- `bun run build:promotion:check`
- `bun run build:evidence:verify`
- `bun run backend:switch:evidence:check`
- artifact parity for manifest, prerendered pages, route bundles, and CSS-module artifacts
- production runtime smoke parity remains green
- emitted output surface parity for canonical build fixtures remains green

## Evidence References

- parity command: `scripts/build-backend-parity.mjs`
- canonical verification path: `scripts/build-canary-check.mjs`
- CLI canonical workflow: `tests/cli/programmatic-runtime.test.ts`
- production runtime smoke: `tests/integration/production-backend-parity.test.ts`
- artifact parity coverage: `tests/build/artifact-parity.test.ts`
- emitted output surface parity: `scripts/build-backend-parity.mjs`, `tests/build/client-backend-parity.test.ts`, `tests/build/fixtures.test.ts`
- support/release policy: `docs/SUPPORT_MATRIX.md`, `docs/BACKEND_SWITCH_EVIDENCE.md`
- default-switch rehearsal: `scripts/build-default-switch-rehearsal-check.mjs`
- evidence train: `scripts/build-evidence-check.mjs`

## Current Evidence

- parity status: green
- canonical verification status: green
- promotion gate status: green
- release/CI gate status: green
- default-switch rehearsal status: green
- evidence train status: green

## Default-Switch Blockers

- none for the build default switch itself
- compiler/build migration plumbing is complete at this layer

## Open Risks

- chunk topology may continue to differ from legacy Bun output and must remain outside the product contract
- legacy `bun` override remains available and must stay deterministic until explicitly deprecated

## Go / No-Go

- current decision: go for default switch
- status: completed
- reason: `rolldown` now owns the canonical build default and release path

## Product Rule

Update this dossier if the canonical build default regresses, is reverted, or moves again.
