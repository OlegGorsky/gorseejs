# AI Bridge Workflow

This document defines the `gorsee ai bridge` workflow for Gorsee as a mature product.

## Purpose

`gorsee ai bridge` starts an HTTP bridge for IDE, agent, and optional fleet-level event ingestion.

## Recommended Flow

1. configure `ai.bridge.url` for a trusted receiver
2. enable only the events you need
3. run `gorsee ai bridge`
4. let local tools ingest `diagnostic.issue`, `request.error`, `build.summary`, and related events

## Safety Contract

- bridge delivery is best-effort only
- a dead bridge must never block request/build/check paths
- bridge consumers must expect versioned artifact metadata where available
- bridge use is local-operator oriented, not a substitute for the canonical local artifact store
- in multi-instance deployments, keep local `.gorsee/*` artifacts per node and treat the bridge as the fleet aggregation path rather than replacing those local artifacts
