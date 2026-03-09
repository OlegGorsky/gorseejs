# SSR Benchmark Proof

This document defines what SSR throughput benchmarks do and do not prove for Gorsee as a mature product.

## What It Proves

`benchmarks/ssr-throughput` is evidence for:

- server-render throughput trends
- SSR render cost trends
- bundle size tendencies when measured alongside route shape

## What It Does Not Prove

SSR throughput does not prove:

- hydration correctness
- route-level cache correctness
- end-user interaction quality
- deploy-target parity by itself

## Product Rule

When citing SSR numbers publicly, tie them to:

- exact benchmark package
- runtime architecture being measured
- environment assumptions
- the fact that throughput is only one part of product behavior
