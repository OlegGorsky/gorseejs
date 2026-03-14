# Reactive Benchmarks

This document defines the current benchmark surface for Gorsee's reactive/runtime claims as a mature product.

Benchmarks are part of the product evidence surface. They are not marketing props and they should not be cited without context.

The canonical machine-readable benchmark contract lives at:

- `docs/BENCHMARK_CONTRACT.json`

## Current Benchmark Packages

The canonical realistic app-shape coverage is:

- content-heavy routes
- hydration growth across small and expanded mixed-content routes
- multi-island dashboards
- larger multi-island route growth
- resource-heavy routes
- invalidation-heavy resource workflows
- mutation-heavy UIs
- rollback-heavy mutation fanout
- workspace-scale apps

### `benchmarks/ssr-throughput`

Use this package to measure:

- SSR render speed
- HTTP throughput
- bundle size characteristics

Key commands:

- `bun run bench:ssr`
- `bun run bench:size`
- `bun run bench`

### `benchmarks/js-framework-bench`

Use this package to measure:

- pure reactive/data operation performance
- js-framework-benchmark-style row operations

Key commands:

- `bun run dev`
- `bun run bench`

## Interpretation Rules

- SSR throughput is not the same as whole-app UX quality
- DOM benchmark results are not the same as product correctness
- bundle size measurements should be read together with route shape and feature set
- benchmark results should be reproducible before they are used in product positioning

## Current Gaps

There are no open repo-local reactive measurement gaps for the current promoted benchmark contract.

The benchmark surface now carries explicit measured coverage for:

- hydration-specific growth costs across small and expanded routes
- `createResource` invalidation-heavy workflows
- `createMutation` rollback-heavy shared-write fanout
- larger multi-island application shapes with mixed SSR output

The benchmark surface now also carries a checked regression gate at:

- `benchmarks/realworld/baseline.json`

That baseline is intentionally conservative. It exists to catch product regressions in the currently promoted realistic app-shape metrics, not to overfit one machine.

## Realistic Evidence Contract

`benchmarks/realworld` is the canonical full-stack proof-of-shape package.

It now carries a machine-readable measured artifact at:

- `benchmarks/realworld/artifact.json`

And a verifier at:

- `scripts/realworld-benchmark-check.mjs`

The artifact is expected to represent realistic app-shape evidence for:

- content route TTFB
- hydration growth across mixed-content routes
- multi-island hydration
- large-route multi-island growth
- resource invalidation pressure
- resource-heavy render paths
- mutation rollback pressure
- rollback-heavy mutation fanout
- workspace-scale build behavior

`scripts/realworld-benchmark-check.mjs` now validates both artifact shape and baseline regression thresholds before release-facing verification can pass.

## Evidence Discipline

Read this document together with:

- `docs/BENCHMARK_METHODOLOGY.md`
- `docs/SSR_BENCHMARK_PROOF.md`
- `docs/DOM_BENCHMARK_PROOF.md`
- `docs/BENCHMARK_ARTIFACTS.md`
- `docs/BENCHMARK_RELEASE_DISCIPLINE.md`
- `docs/BENCHMARK_CONTRACT.json`

Supporting proof surfaces:

- Benchmark Methodology
- SSR Benchmark Proof
- DOM Benchmark Proof
- Benchmark Artifacts
- Benchmark Release Discipline

## Product Rule

Performance claims should stay benchmark-backed, scoped, and reproducible.
Promoted realistic metrics should also stay guarded by a machine-readable regression gate, not only by the presence of a benchmark artifact.
