# Compiler Execution Backlog

This document turns the compiler-platform strategy into concrete execution slices.

It is based on the current compiler audit and is intended to guide the first migration waves toward `OXC` and a future `Rolldown` backend.

## Audit Summary

Current measured totals:

- 23 compiler/build/release files in the current audit scope
- 5 direct `Bun.build` touchpoints
- 8 Bun plugin resolve touchpoints
- 15 TypeScript AST touchpoints
- 42 regex/string transform touchpoints
- 26 generated-string artifact touchpoints

Interpretation:

- the biggest migration pressure today is not TypeScript AST itself
- the biggest migration pressure is the amount of regex/string transform logic spread across build and analysis layers
- the second migration pressure is Bun-specific build coupling

## Priority Order

## Transition Program Status

Status: completed for the migration-governance and candidate-evidence block.

Completed outcomes:

- compiler backend migration now has parity, canary, rehearsal, dossier, promotion, and evidence trains
- build backend migration now has parity, canary, rehearsal, dossier, promotion, and evidence trains
- unified candidate verification now exists as one package-level train
- release, CI, checklist, and review surfaces now enforce the candidate transition program

Open work after this block:

- gather repeated production evidence runs on the switched canonical path
- keep compiler/build dossiers and unified review in `go` state intentionally
- keep route facts and compiler parity surfaces versioned and machine-readable

### Wave 1: OXC Analysis Backbone

Goal: replace analysis drift before replacing the bundler.

Targets:

1. `src/cli/check-ast.ts`
2. `src/cli/cmd-check.ts`
3. `src/router/scanner.ts`
4. `src/cli/cmd-docs.ts`
5. `src/cli/cmd-typegen.ts`

Why first:

- highest analysis leverage
- lower release risk than build-backend migration
- removes regex-heavy correctness debt early

Expected output:

- one canonical route/export/import analysis layer
- fewer divergent file scanners
- clearer machine-readable facts for CLI and policy checks

Estimated effort:

- 1 engineer, 1–2 weeks for interface + first migration slice
- 1 additional week for parity hardening and fixtures

## Wave 2: OXC Transform Layer

Goal: move framework transforms off string-rewrite heuristics.

Targets:

1. `src/build/rpc-transform.ts`
2. `src/build/server-strip.ts`
3. `src/build/route-metadata.ts`

Why second:

- these transforms directly affect runtime/build correctness
- they currently rely heavily on regex/string shaping
- they should be compiler-owned before changing the bundler backend

Expected output:

- compiler-backed server/client partition transforms
- compiler-backed RPC call transforms
- stronger transform diagnostics and fixture parity

Estimated effort:

- 1 engineer, 2–3 weeks including regression fixtures

## Wave 3: Build Abstraction Layer

Goal: isolate build orchestration from Bun-specific APIs.

Targets:

1. `src/build/client.ts`
2. `src/build/css-modules.ts`
3. `src/cli/bun-plugin.ts`
4. `src/cli/cmd-build.ts`

Required abstractions:

- route entry generation
- framework import resolution
- CSS module artifact collection
- client build result object
- diagnostic emission

Expected output:

- `buildClientBundles()` no longer centers `Bun.build()` directly
- framework build logic becomes backend-hostable

Estimated effort:

- 1 engineer, 2 weeks for interface extraction + Bun backend

## Wave 4: Rolldown Backend Spike

Goal: prove parity before canonical adoption.

Targets:

- client route bundle generation
- framework import resolution
- chunk and manifest input parity
- CSS module artifact parity

Exit criteria:

- release smoke still passes
- runtime parity tests still pass
- manifest and client bundle contracts stay stable

Estimated effort:

- 1 engineer, 1–2 weeks for spike
- additional 1 week if promoted to production backend

## Wave 5: Artifact Schema Hardening

Goal: make generated artifacts compiler-versioned.

Targets:

- route facts emitted by analysis
- build manifest producer inputs
- deploy artifact conformance presets
- CLI-generated metadata outputs

Expected output:

- more machine-readable, versioned compiler artifacts
- easier canary/RC validation for compiler migration

Estimated effort:

- parallelizable with Waves 2–4

## Resource Model

### Minimum Team

- 1 senior framework/compiler engineer can execute sequentially
- realistic duration: 6–10 weeks

### Preferred Team

- 1 compiler/build engineer
- 1 runtime/product hardening engineer

Realistic duration:

- 4–6 weeks with overlap

## Risk Map

### Low Risk

- analysis interfaces
- compiler audit surfaces
- docs/typegen/check migration behind parity tests

### Medium Risk

- route scanner migration
- RPC transform migration
- server-strip migration

### High Risk

- bundler backend switch
- CSS module parity under a new backend
- manifest/chunk identity changes

## First PR Slices

### PR 1

- add compiler analysis interface module
- codify route/export/import facts shape
- adapt one consumer (`cmd-docs`) to the interface

Status:

- done: `src/compiler/module-analysis.ts` now owns shared route/export/import facts
- done: `cmd-docs`, `check-ast`, and `cmd-check` consume the shared analysis layer
- done: root `gorsee` import drift now reports `W911`
- started: analysis now sits behind a backend adapter, with TypeScript as the canonical implementation
- started: backend selection is now registry-based and flag-ready via `GORSEE_COMPILER_BACKEND`
- started: experimental `OXC` landing slot and backend parity harness now exist before dependency adoption
- started: CLI entrypoints now initialize compiler backend selection automatically
- completed: `oxc` is now the canonical compiler default path

### PR 2

- move `check-ast` and `cmd-check` facts onto the same interface
- add parity tests for import-boundary diagnostics

Status:

- done: `check-ast` and `cmd-check` now consume shared module analysis facts
- done: root `gorsee` import drift is enforced as `W911`
- done: parity tests cover the import-boundary diagnostic path

### PR 3

- migrate route scanner facts and `cmd-typegen`
- preserve route ordering and matcher contracts

### PR 4

- introduce transform interface for RPC/server-strip
- port one transform path with parity fixtures

Status:

- started: route client transforms now flow through `src/build/route-client-transform.ts`
- started: `server-strip` consumes the shared transform contract instead of private helpers
- done: parity fixtures now assert transform metadata and preserved behavior

### PR 5

- extract build backend abstraction from `src/build/client.ts`
- keep Bun as the first backend implementation

Status:

- started: client bundling now accepts a pluggable backend contract while keeping Bun as the canonical backend
- started: framework import resolution is shared between CLI and client build paths
- started: `buildProject()` accepts injected client build backends for future backend spikes
- started: build backend selection is now registry-based and flag-ready via `GORSEE_BUILD_BACKEND`
- started: build entrypoints now initialize backend selection automatically

### Wave 5 Progress

- started: route compiler facts now have a versioned schema in `src/compiler/route-facts.ts`
- started: `gorsee typegen` now emits `.gorsee/route-facts.json` as a machine-readable artifact
- completed: route facts are now the canonical metadata surface for typegen/docs contracts
- completed: compiler parity reports now expose machine-readable surfaces, not only difference lists

### PR 6

- completed: build backend selection is registry-based and flag-ready via `GORSEE_BUILD_BACKEND`
- completed: `rolldown` now runs on the real `rolldown` package for client bundle generation
- completed: build parity covers Bun vs `experimental-rolldown` and Bun vs `rolldown`
- completed: `rolldown` now runs as the canonical build default
- completed: artifact parity covers manifest/static/runtime-facing bundle surface between Bun and `rolldown`
- completed: `rolldown` now preserves CSS module artifact parity through the shared framework CSS-module contract
- completed: build canary now includes production runtime smoke parity for Bun vs `rolldown`
- completed: compiler/build promotion checks now gate the switched canonical defaults `oxc` and `rolldown`

## Product Rule

Do not start with the bundler swap.

Start with analysis and transform ownership, then build abstraction, then backend migration.
