# Downstream Testing

This document defines the canonical downstream conformance surface for Gorsee.

Downstream quality is a framework contract. Apps, deploy adapters, plugins, and workspace layouts must be testable through explicit harnesses instead of scattered ad hoc temp setups.

## Canonical Harness Surface

Use `gorsee/testing` for downstream conformance helpers:

- `createFixtureAppHarness(...)`
- `createWorkspaceFixtureHarness(...)`
- `createPluginConformanceHarness(...)`
- `validatePluginConformance(...)`
- `testDeployArtifactConformance(...)`
- `assertTestDeployArtifactConformance(...)`
- `createRuntimeFixture(...)`

## Product Rules

- fixture apps and workspaces should be materialized through the shared harness when a test needs filesystem shape
- plugin lifecycle tests should prefer the shared conformance harness over hand-written setup contexts
- deploy conformance should use explicit required/forbidden token checks before relying on looser text assertions
- plugin conformance should assert capability metadata and deterministic plugin ordering, not only middleware/routes/build hook counts
- runtime fixture tests should drive router/navigation behavior without bespoke global DOM wiring in every suite

## What This Surface Proves

The downstream harness is expected to prove:

- app and workspace fixture layouts are deterministic
- plugins register middleware, routes, build hooks, capability metadata, and dependency ordering through one canonical lifecycle surface
- deploy adapters satisfy explicit artifact contracts
- router/runtime fixture behavior can be exercised without custom per-test setup glue

## Product Rule

If a downstream contract cannot be expressed through the shared testing surface, that is a signal to strengthen the harness rather than accumulate one-off test scaffolding.
