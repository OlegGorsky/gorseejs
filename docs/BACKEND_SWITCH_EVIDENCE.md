# Backend Switch Evidence

This document defines the evidence required before changing Gorsee's canonical compiler or build backend.

Default switches are product-contract changes. They must be justified with current evidence, not intuition.

## Compiler Default Switch

`oxc` has replaced `typescript` as the canonical compiler default because all of the following remained true together:

- `bun run compiler:parity`
- `bun run compiler:canary`
- `bun run compiler:promotion:check`
- `bun run compiler:evidence:verify`
- CLI docs/typegen/check workflows remain green on the canonical path
- machine-readable route facts remain contract-compatible
- release docs describe `oxc` as the actual compiler default

## Build Default Switch

`rolldown` has replaced `bun` as the canonical build default because all of the following remained true together:

- `bun run build:parity`
- `bun run build:canary`
- `bun run build:promotion:check`
- `bun run build:evidence:verify`
- artifact parity holds for manifest, prerendered pages, route bundles, and CSS-module artifacts
- production runtime smoke parity remains green
- release docs describe `rolldown` as the actual build default

## No-Go Conditions

Do not change canonical defaults again if any of the following are true:

- parity only passes on synthetic fixtures but not on runtime smoke paths
- docs still describe the old default as canonical
- CI or release workflows do not exercise the promotion gates
- the change removes observability or makes backend selection less deterministic

## Product Rule

Changing the canonical backend default without this evidence is a release-policy violation.

Operator dossiers:

- `docs/COMPILER_DEFAULT_SWITCH_DOSSIER.md`
- `docs/BUILD_DEFAULT_SWITCH_DOSSIER.md`
- `docs/BACKEND_DEFAULT_SWITCH_REVIEW.md`
- `docs/COMPILER_DEFAULT_SWITCH_REHEARSAL.md`
- `docs/BUILD_DEFAULT_SWITCH_REHEARSAL.md`
