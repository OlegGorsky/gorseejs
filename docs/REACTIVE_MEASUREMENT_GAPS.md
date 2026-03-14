# Reactive Measurement Gaps

This document defines the status of the reactive measurement backlog in Gorsee's reactive/runtime story as a mature product.

Machine-readable companion: `docs/REACTIVE_MEASUREMENT_CONTRACT.json`

Release-facing promoted metric summary: `docs/REACTIVE_EVIDENCE_SUMMARY.md`

The goal is to keep measurement closure explicit, so roadmap work stays honest.

## Evidence Backed Baselines

The benchmark surface now has explicit realistic app-shape evidence contracts for:

- route-wide hydration versus island-only hydration
- hydration growth across small and expanded mixed-content routes
- many concurrent `createResource` instances
- invalidation-heavy resource workflows under repeated churn
- optimistic update pressure under repeated writes
- rollback-heavy shared-write mutation fanout
- larger numbers of focused islands on one route
- larger multi-island route growth with mixed SSR content

These are now represented through the canonical `benchmarks/realworld` artifact surface and should be treated as evidence-backed benchmark categories rather than undocumented aspirations.

Those promoted metrics now also have a release-facing summary layer in `docs/REACTIVE_EVIDENCE_SUMMARY.md` and `docs/REACTIVE_EVIDENCE_SUMMARY.json`.

## Remaining Gaps

There are no open repo-local gaps in the current reactive measurement contract.
The previously open categories below are now treated as closed for the current product surface and remain listed so policy tooling can track what was closed.

### Hydration

Closed through:

- route-wide hydration versus island-only hydration
- hydration cost as island count grows
- hydration behavior across more realistic mixed-content routes

### Resources

Closed through:

- many concurrent `createResource` instances
- invalidation-heavy flows
- stale-time and keyed-dedup scenarios under more realistic app shapes

### Mutations

Closed through:

- optimistic update pressure under repeated writes
- rollback-heavy flows
- mutation behavior when several UI regions depend on the same write path

### Multi-Island Pages

Closed through:

- larger numbers of focused islands on one route
- interaction between SSR output size and island hydration cost

## Product Rule

Reopen this backlog only if a new release-facing reactive claim is made without repeatable evidence and a matching regression gate.
