# Benchmark Artifacts

This document defines machine-readable benchmark artifact expectations for Gorsee as a mature product.

## Purpose

When benchmark results are preserved for release or public claims, they should be representable in a machine-readable form.

## Artifact Schema

The canonical schema lives at:

- `benchmarks/benchmark-artifact.schema.json`

Canonical realistic app-shape artifact:

- `benchmarks/realworld/artifact.json`

Canonical benchmark family/artifact contract:

- `docs/BENCHMARK_CONTRACT.json`

Expected fields include:

- `benchmark`
- `kind`
- `ts`
- `environment`
- `metrics`
- `notes`

## Use Cases

Machine-readable artifacts are useful for:

- release discussions
- regression comparison
- public claim review
- later tooling that compares benchmark runs across versions
- realistic full-stack app-shape evidence review

## Product Rule

If a benchmark claim is strong enough to cite publicly, it should be strong enough to preserve as a structured artifact.
