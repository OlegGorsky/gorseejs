# Reactive Evidence Summary

This document defines the release-facing summary for Gorsee's promoted realistic reactive evidence as a mature product.

Machine-readable companion: `docs/REACTIVE_EVIDENCE_SUMMARY.json`

Data sources:

- `benchmarks/realworld/artifact.json`
- `benchmarks/realworld/baseline.json`
- `scripts/realworld-benchmark-check.mjs`

This summary is intentionally narrow.
It summarizes the currently promoted realistic app-shape evidence.
The internal reactive measurement backlog is now closed for the current product contract; broader market-facing comparison work remains separate from this repo-local summary.

## Current Promoted Metrics

Measured artifact timestamp: `2026-03-14T17:55:00.000Z`

Environment:

- runtime: `bun@1.3.9`
- os: `linux`
- cpu: `x64`

Promoted metrics versus current regression ceilings:

- `contentRouteTtfbMs`: measured `3.47`, regression ceiling `10`, headroom `6.53`
- `hydrationGrowthMs`: measured `182.64`, regression ceiling `300`, headroom `117.36`
- `multiIslandHydrationMs`: measured `559.47`, regression ceiling `700`, headroom `140.53`
- `multiIslandRouteGrowthMs`: measured `741.93`, regression ceiling `950`, headroom `208.07`
- `resourceInvalidationPressureMs`: measured `170.42`, regression ceiling `250`, headroom `79.58`
- `resourceRouteRenderMs`: measured `5.28`, regression ceiling `10`, headroom `4.72`
- `mutationRollbackMs`: measured `4.15`, regression ceiling `10`, headroom `5.85`
- `rollbackHeavyMutationsMs`: measured `144.37`, regression ceiling `220`, headroom `75.63`
- `workspaceBuildMs`: measured `824.76`, regression ceiling `1100`, headroom `275.24`

## Interpretation

- the promoted realistic app-shape artifact is inside all current regression thresholds
- hydration remains the tightest current family of metrics and should stay the first area to watch
- resource invalidation and rollback-heavy mutation fanout are now measured explicitly rather than inferred from narrower route-level scenarios
- workspace-scale build behavior remains release-guarded, not anecdotal

## Scope Boundary

This summary closes the current repo-local reactive measurement layer for promoted realistic metrics.

It does not replace:

- external comparative reports aimed at market-facing evaluation
- future benchmark categories that are not yet part of the current release contract

## Product Rule

Use this summary for release-facing evidence and operator review.
Use `docs/REACTIVE_MEASUREMENT_GAPS.md` and `docs/REACTIVE_MEASUREMENT_CONTRACT.json` to confirm whether the repo-local backlog remains closed after future scope expansion.
