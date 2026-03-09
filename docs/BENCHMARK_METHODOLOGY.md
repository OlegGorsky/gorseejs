# Benchmark Methodology

This document defines benchmark methodology for Gorsee as a mature product.

## Purpose

Benchmarks exist to support concrete runtime claims with repeatable evidence.

They are not:

- universal UX proof
- correctness proof
- marketing screenshots without reproducible commands

## Methodology Rules

1. benchmark commands must be runnable from package roots
2. environment assumptions must be stated alongside results
3. results should identify which benchmark package produced them
4. claims must distinguish SSR throughput, DOM/reactive behavior, and full-stack proof-of-shape
5. results should be reproducible before being cited in README, release notes, or product copy

## Current Benchmark Families

- `benchmarks/ssr-throughput`
- `benchmarks/js-framework-bench`
- `benchmarks/realworld`

## Interpretation Baseline

- SSR throughput measures rendering/server-side throughput, not whole-app UX
- DOM/reactive results measure fine-grained update behavior, not framework correctness
- Realworld validates shape and operational breadth, not universal production parity
