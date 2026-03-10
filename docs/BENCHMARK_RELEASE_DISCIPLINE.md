# Benchmark Release Discipline

This document defines how benchmark evidence should influence release and product language for Gorsee as a mature product.

## Release Discussion Rules

- do not cite a benchmark without naming the benchmark package
- do not mix SSR numbers and DOM/reactive numbers into one vague “faster” claim
- do not treat Realworld as a universal production benchmark
- keep benchmark claims scoped to the runtime behavior they actually measure

## Public Claim Threshold

A result is strong enough to cite publicly only when:

1. it is reproducible
2. the benchmark package is documented
3. the environment assumptions are known
4. the claim is phrased narrowly
5. the result does not contradict runtime-correctness or product-discipline concerns

Realistic app-shape claims additionally require:

6. a machine-readable `benchmarks/realworld` artifact exists
7. the artifact covers the relevant scenario category explicitly
8. the preserved artifact and baseline remain aligned with `docs/BENCHMARK_CONTRACT.json`

## Product Rule

Benchmark evidence supports product language. It must not replace precision.
