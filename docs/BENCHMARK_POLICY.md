# Benchmark Policy

This document defines how Gorsee uses benchmarks as part of a mature product.

Benchmarks are evidence, not decoration.

## Scope

Current benchmark surfaces include:

- `benchmarks/ssr-throughput`
- `benchmarks/js-framework-bench`
- `benchmarks/realworld`

## Rules

- benchmark commands must remain runnable from their package roots
- benchmark docs must explain what the benchmark proves and what it does not prove
- benchmark claims in product docs should be reproducible
- benchmark packages should stay aligned with the current runtime architecture
- benchmark results should not be used as blanket claims about app UX or correctness
- benchmark release discussions should follow explicit comparison discipline
- machine-readable benchmark artifact expectations should remain documented when benchmark claims are preserved
- realistic app-shape claims should carry a structured `benchmarks/realworld` artifact when preserved
- benchmark directories should remain a clean, reproducible repository surface without committed `node_modules`, `dist`, `.gorsee*`, or local database files

## Current Product Interpretation

- SSR throughput supports server-rendering claims
- DOM/reactive benchmarks support fine-grained runtime claims
- Realworld supports full-stack proof-of-shape, not universal production parity

## Product Standard

If a benchmark package drifts from the framework architecture or starts implying claims it does not actually prove, that is a product defect.

Use these docs together:

- `docs/BENCHMARK_METHODOLOGY.md`
- `docs/SSR_BENCHMARK_PROOF.md`
- `docs/DOM_BENCHMARK_PROOF.md`
- `docs/BENCHMARK_ARTIFACTS.md`
- `docs/BENCHMARK_RELEASE_DISCIPLINE.md`
