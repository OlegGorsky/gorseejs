# DOM Benchmark Proof

This document defines what DOM/reactive benchmarks do and do not prove for Gorsee as a mature product.

## What It Proves

`benchmarks/js-framework-bench` is evidence for:

- fine-grained update cost
- row-operation/reactive update trends
- no-VDOM runtime behavior under benchmark-style workloads

## What It Does Not Prove

DOM/reactive results do not prove:

- routing correctness
- SSR correctness
- cache behavior
- security/runtime policy guarantees

## Product Rule

When citing DOM/reactive results, describe them as runtime evidence, not as a blanket statement that every real app will behave identically.
