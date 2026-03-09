# Compiler Switch Evidence Plan

This plan defines the evidence path that moved `oxc` from candidate to canonical compiler default and now protects that default from regression.

Current stable default:

- `oxc`

Previous default:

- `typescript`

## Evidence Train

Run `bun run compiler:evidence:verify` as the canonical compiler verification train.

That train must prove all of the following together:

- parity remains green
- module-analysis parity remains green on the canonical compiler path
- route facts artifacts remain versioned and machine-readable on the canonical compiler path
- CLI docs generation remains green on the canonical compiler path
- CLI project checks remain green on the canonical compiler path
- programmatic runtime flows remain green on the canonical compiler path
- backend init/selection remains green on the canonical compiler path
- dossier and promotion checks remain green

## Exit Criteria

The compiler switch remains valid only while the repository continues to show:

- repeated green `compiler:evidence:verify` runs on the canonical path
- `docs/COMPILER_DEFAULT_SWITCH_DOSSIER.md` remains in `go` state
- `docs/BACKEND_DEFAULT_SWITCH_REVIEW.md` keeps compiler in `go` state
- support and release docs continue to describe `oxc` as the canonical compiler default

## Rollback Rule

If `compiler:evidence:verify` fails materially, treat that as a compiler-default regression and either fix the regression or revert the compiler default intentionally.

## Product Rule

Do not silently drift away from `oxc` as the compiler default. Any reversal must go through the same product review discipline.
