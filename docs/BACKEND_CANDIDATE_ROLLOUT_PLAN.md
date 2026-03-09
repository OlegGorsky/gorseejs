# Backend Candidate Rollout Plan

This plan defines the working transition from the current stable backend system to the new candidate backend system.

New candidate system:

- compiler default: `oxc`
- build default: `rolldown`

Stable system today:

- compiler default: `oxc`
- build default: `rolldown`

## Objective

Move from canary-only validation to production-grade candidate validation without changing the stable defaults prematurely.

## Phase 1: Candidate Verification

Run the unified evidence and candidate verification pipelines:

- `bun run backend:candidate:evidence:verify`
- `bun run backend:candidate:verify`

Required outcome:

- compiler and build evidence trains stay green
- unified review and backend switch evidence stay green
- release/CI policy checks stay green
- no stable defaults change

## Phase 2: Candidate Release Train

Use the candidate system as the validated release candidate path:

- compiler rehearsal is green
- build rehearsal is green
- release docs and support matrix still describe stable vs candidate paths correctly

Required outcome:

- candidate path behaves like a production rehearsal, not like an experiment

## Phase 3: Go / No-Go Review

Use the dossiers and unified review packet:

- `docs/BACKEND_CANDIDATE_EVIDENCE_PLAN.md`
- `docs/COMPILER_DEFAULT_SWITCH_DOSSIER.md`
- `docs/BUILD_DEFAULT_SWITCH_DOSSIER.md`
- `docs/BACKEND_DEFAULT_SWITCH_REVIEW.md`

Required outcome:

- each dossier moves from `no-go` to `go` intentionally
- unified review packet moves from `no-go` to `go` intentionally

## Phase 4: Default Switch

Only after the earlier phases are green together:

- - switch build default from `bun` to `rolldown`
- update support/release docs to reflect the new stable defaults

## Rollback Rule

If candidate verification or release-train validation regresses:

- keep stable defaults unchanged
- keep candidate backends behind rehearsal/canary paths
- update dossiers back to explicit `no-go`

## Product Rule

Do not treat the candidate system as the stable system until the candidate pipeline and go/no-go review both pass.

## Status

- rollout-program block status: complete
- canonical backend defaults are now switched
- next action is protecting the switched defaults with ongoing evidence, not more migration plumbing
