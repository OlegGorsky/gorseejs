# Backend Default Switch Review

This review packet is the operator-facing summary for backend default switches in Gorsee.

It does not replace the detailed dossiers. It summarizes the current canonical defaults and their review status.

## Current Decision

- compiler default switch: go
- build default switch: go
- unified release decision: go

## Inputs

- `docs/COMPILER_DEFAULT_SWITCH_DOSSIER.md`
- `docs/BUILD_DEFAULT_SWITCH_DOSSIER.md`
- `docs/BACKEND_SWITCH_EVIDENCE.md`
- `docs/SUPPORT_MATRIX.md`
- `docs/RELEASE_POLICY.md`
- `docs/BACKEND_CANDIDATE_ROLLOUT_PLAN.md`
- `docs/COMPILER_SWITCH_EVIDENCE_PLAN.md`
- `docs/BUILD_SWITCH_EVIDENCE_PLAN.md`

## Compiler Review

- current default: `oxc`
- previous default: `typescript`
- parity/canary/promotion/rehearsal/evidence status: green
- decision: go
- reason: the canonical release path now centers `oxc`

## Build Review

- current default: `rolldown`
- previous default: `bun`
- parity/canary/promotion/rehearsal/evidence status: green
- decision: go
- reason: the canonical release path now centers `rolldown`

## Go / No-Go Rule

Keep both canonical defaults only while:

- compiler/build dossiers stay in `go` state intentionally
- release/CI gates continue to pass on the canonical path
- support and release docs continue to describe the actual canonical defaults

## Product Rule

Treat this review packet as the final operator checkpoint for future backend reversals or further backend changes.
