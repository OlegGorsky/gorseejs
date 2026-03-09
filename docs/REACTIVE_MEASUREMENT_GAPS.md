# Reactive Measurement Gaps

This document defines the remaining measurement gaps in Gorsee's reactive/runtime story as a mature product.

The goal is to make missing evidence explicit, so roadmap work stays honest.

## Evidence Backed Baselines

The benchmark surface now has explicit realistic app-shape evidence contracts for:

- route-wide hydration versus island-only hydration
- many concurrent `createResource` instances
- optimistic update pressure under repeated writes
- larger numbers of focused islands on one route

These are now represented through the canonical `benchmarks/realworld` artifact surface and should be treated as evidence-backed benchmark categories rather than undocumented aspirations.

## Remaining Gaps

### Hydration

Missing clearer measurement for:

- route-wide hydration versus island-only hydration
- hydration cost as island count grows
- hydration behavior across more realistic mixed-content routes

### Resources

Missing clearer measurement for:

- many concurrent `createResource` instances
- invalidation-heavy flows
- stale-time and keyed-dedup scenarios under more realistic app shapes

### Mutations

Missing clearer measurement for:

- optimistic update pressure under repeated writes
- rollback-heavy flows
- mutation behavior when several UI regions depend on the same write path

### Multi-Island Pages

Missing clearer measurement for:

- larger numbers of focused islands on one route
- interaction between SSR output size and island hydration cost

## Product Rule

These are not excuses to weaken the current reactive story. They are the explicit next evidence gaps to close in later phases.
