# Compiler Default Switch Dossier

This dossier tracks the evidence and completion status for promoting `oxc` to the canonical compiler backend default.

Current default:

- `oxc`

Previous default:

- `typescript`

## Required Evidence

- `bun run compiler:parity`
- `bun run compiler:canary`
- `bun run compiler:promotion:check`
- `bun run compiler:evidence:verify`
- `bun run backend:switch:evidence:check`
- CLI docs/typegen/check workflows remain green on the canonical path
- route facts and docs artifacts remain contract-compatible
- route facts remain the canonical metadata source for docs, typegen, and build consumers
- module-analysis parity surfaces remain machine-readable and drift-free

## Evidence References

- parity command: `scripts/compiler-backend-parity.mjs`
- canonical verification path: `scripts/compiler-canary-check.mjs`
- CLI canonical workflow: `tests/cli/programmatic-runtime.test.ts`
- backend init coverage: `tests/compiler/init.test.ts`
- route facts artifact: `.gorsee/route-facts.json`
- route facts contract: `tests/compiler/route-facts-contract.test.ts`
- module-analysis parity surfaces: `scripts/compiler-backend-parity.mjs`, `tests/compiler/module-analysis-parity.test.ts`, `tests/compiler/oxc.test.ts`
- support/release policy: `docs/SUPPORT_MATRIX.md`, `docs/BACKEND_SWITCH_EVIDENCE.md`
- default-switch rehearsal: `scripts/compiler-default-switch-rehearsal-check.mjs`
- evidence train: `scripts/compiler-evidence-check.mjs`

## Current Evidence

- parity status: green
- canonical verification status: green
- promotion gate status: green
- release/CI gate status: green
- default-switch rehearsal status: green
- evidence train status: green

## Default-Switch Blockers

- none for the compiler default switch itself
- remaining backend migration work is build-side, not compiler-side

## Open Risks

- regressions in route analysis, docs extraction, or check diagnostics must still be treated as compiler-default regressions
- legacy `typescript` override remains available and must stay deterministic until explicitly deprecated

## Go / No-Go

- current decision: go for default switch
- status: completed
- reason: `oxc` now owns the canonical compiler default and release path

## Product Rule

Update this dossier if the canonical compiler default regresses, is reverted, or moves again.
