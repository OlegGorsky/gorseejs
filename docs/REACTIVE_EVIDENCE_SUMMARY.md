# Reactive Evidence Summary

This document defines the release-facing summary for Gorsee's promoted realistic reactive evidence as a mature product.

Machine-readable companion: `docs/REACTIVE_EVIDENCE_SUMMARY.json`

Data sources:

- `benchmarks/realworld/artifact.json`
- `benchmarks/realworld/baseline.json`
- `scripts/realworld-benchmark-check.mjs`

This summary is intentionally narrow.
It summarizes the currently promoted realistic app-shape evidence.
It does not replace the broader remaining backlog in `docs/REACTIVE_MEASUREMENT_GAPS.md`.

## Current Promoted Metrics

Measured artifact timestamp: `2026-03-09T04:07:19.657Z`

Environment:

- runtime: `bun@1.3.9`
- os: `linux`
- cpu: `x64`

Promoted metrics versus current regression ceilings:

- `contentRouteTtfbMs`: measured `3.47`, regression ceiling `10`, headroom `6.53`
- `multiIslandHydrationMs`: measured `559.47`, regression ceiling `700`, headroom `140.53`
- `resourceRouteRenderMs`: measured `5.28`, regression ceiling `10`, headroom `4.72`
- `mutationRollbackMs`: measured `4.15`, regression ceiling `10`, headroom `5.85`
- `workspaceBuildMs`: measured `824.76`, regression ceiling `1100`, headroom `275.24`

## Interpretation

- the promoted realistic app-shape artifact is inside all current regression thresholds
- hydration is the tightest current headroom and should remain the first promoted metric to watch
- resource render and mutation rollback metrics currently remain comfortably inside their guarded limits
- workspace-scale build behavior remains release-guarded, not anecdotal

## Scope Boundary

This summary closes only the release-facing evidence summary layer for currently promoted realistic metrics.

It does not close the broader backlog for:

- hydration growth across wider island counts
- invalidation-heavy resource pressure beyond the current realistic route proof
- rollback-heavy mutation scenarios with broader shared-write-path fanout
- SSR-size versus hydration-cost interaction across more mixed-content routes

Those remaining gaps stay canonical in `docs/REACTIVE_MEASUREMENT_GAPS.md` and `docs/REACTIVE_MEASUREMENT_CONTRACT.json`.

## Product Rule

Use this summary for release-facing evidence and operator review.
Use `docs/REACTIVE_MEASUREMENT_GAPS.md` when deciding whether the broader reactive benchmark story is fully closed.
