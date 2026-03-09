# Backend Candidate Evidence Plan

This plan defines the unified evidence train for the candidate backend system.

Candidate system:

- compiler default: `oxc`
- build default: `rolldown`

Stable system today:

- compiler default: `oxc`
- build default: `rolldown`

## Unified Evidence Train

Run `bun run backend:candidate:evidence:verify` as the canonical unified evidence train.

That train must prove all of the following together:

- compiler evidence remains green
- build evidence remains green
- unified backend review remains green
- backend switch evidence remains green
- compiler and build defaults now both run on the canonical switched path

## Candidate Verification

Run `bun run backend:candidate:verify` as the full candidate verification train.

That train extends unified evidence with:

- release train checks
- release checklist checks
- CI policy checks

## Exit Criteria

Before any unified default switch can happen, the repository must show:

- repeated green `backend:candidate:evidence:verify` runs
- repeated green `backend:candidate:verify` runs
- dossiers remain in `go` state intentionally
- unified review packet remains in `go` state intentionally

## Rollback Rule

If either unified evidence or candidate verification fails, keep both stable defaults unchanged and keep both candidate backends behind candidate-only paths.

## Product Rule

Do not treat the candidate backend system as the stable backend system until both unified evidence and candidate verification remain green.

## Status

- transition-program block status: complete
- default-switch decision status: pending evidence review
- current unified decision: `no-go`
