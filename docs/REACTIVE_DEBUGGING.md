# Reactive Debugging

This document defines the current debugging story for Gorsee's reactive runtime.

Gorsee is a mature product. Reactive debugging is therefore treated as a shipped runtime surface, not an informal collection of counters.

## Current Surface

The canonical diagnostics path is dev-only and machine-readable:

- `configureReactiveDiagnostics({ enabled: true, captureEvents: true })`
- `getReactiveDiagnosticsSnapshot()`
- `getReactiveGraphNodes()`
- `getReactiveDependencyEdges()`
- `getReactiveDiagnosticsEvents()`
- `getReactiveTraceArtifact()`
- `createRuntimeDevtoolsSnapshot()`
- `renderRuntimeDevtoolsHTML()`
- `renderRuntimeDevtoolsOverlay()`

`getReactiveTraceArtifact()` returns a versioned snapshot with:

- `schemaVersion`
- aggregate counters
- graph nodes
- dependency edges
- ordered lifecycle and invalidation events

This artifact is the canonical trace format for tools, tests, and agent-facing debugging helpers.
It is also the canonical machine-readable explanation surface for recomputation chains in the reactive runtime.

The shipped human-readable inspector layer now derives from the same source of truth instead of inventing a second runtime model:

- router navigation diagnostics
- hydration diagnostics
- reactive trace artifacts
- optional route-tree metadata provided by the caller

## What The Trace Explains

The shipped trace surface is expected to answer:

- which signal, computed, effect, resource, or mutation node was created
- which dependencies were observed between reactive nodes
- which invalidation caused a computed or effect rerun
- when a resource started, succeeded, failed, refetched, mutated, or was invalidated
- when a mutation started, succeeded, failed, rolled back, settled, or reset

## Current Practical Guidance

- keep signal ownership local and explicit
- keep resource keys and invalidation paths obvious
- keep optimistic mutations small and rollback semantics understandable
- keep hydration boundaries narrow so interactive ownership is visible
- keep hydration ownership obvious when a route mixes static markup and islands
- prefer one reactive pattern per job rather than layering several patterns at once

## Current Gaps

Reactive debugging still has follow-on work outside the current closure:

- direct `gorsee ai doctor` ingestion of live reactive traces during app sessions without relying on a saved artifact file
- richer request/cache inspectors when those runtime stores expose stable local diagnostics
- richer resource cache/invalidation state inspectors when those runtime stores expose stable local diagnostics

## Product Rule

Reactive diagnostics must remain:

- explicit
- versioned
- dev-only
- stable enough for tool and agent consumption

They must not become an accidental production API or a second reactive runtime model.
