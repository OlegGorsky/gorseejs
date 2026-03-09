# Build Switch Evidence Plan

This plan defines the evidence path that moved `rolldown` from candidate to canonical build default and now protects that default from regression.

Current stable default:

- `rolldown`

Previous default:

- `bun`

## Evidence Train

Run `bun run build:evidence:verify` as the canonical build verification train.

That train must prove all of the following together:

- parity remains green
- artifact parity remains green for manifest, prerendered routes, client assets, and CSS-module artifacts
- emitted output surface parity remains green for canonical build fixtures
- structured backend diagnostics remain actionable on the canonical build path
- programmatic build/runtime flows remain green on the canonical build path
- backend init/selection remains green on the canonical build path
- production runtime smoke parity remains green on the canonical build path
- dossier and promotion checks remain green

## Exit Criteria

The build switch remains valid only while the repository continues to show:

- repeated green `build:evidence:verify` runs on the canonical path
- `docs/BUILD_DEFAULT_SWITCH_DOSSIER.md` remains in `go` state
- `docs/BACKEND_DEFAULT_SWITCH_REVIEW.md` keeps build in `go` state
- support and release docs continue to describe `rolldown` as the canonical build default

## Rollback Rule

If `build:evidence:verify` fails materially, treat that as a build-default regression and either fix the regression or revert the build default intentionally.

## Product Rule

Do not silently drift away from `rolldown` as the build default. Any reversal must go through the same product review discipline.
