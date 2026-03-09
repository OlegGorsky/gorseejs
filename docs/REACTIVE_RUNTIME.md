# Reactive Runtime

This document defines the current Gorsee reactive runtime story.

Gorsee is a mature product with a reactive-first identity. The reactive model is not a side utility layer and not a React compatibility shim.

## Position

Gorsee follows a fine-grained reactive model closer to Solid than to React.

That means:

- signals are the primary unit of reactive state
- DOM updates are attached directly rather than routed through a VDOM diff
- SSR reads current reactive values directly
- hydration is explicit and route-scoped
- islands are preferred over broad client takeover when only small regions are interactive

## Primary APIs

Use `gorsee/client` for the public reactive surface:

- `createSignal`
- `createComputed`
- `createEffect`
- `createResource`
- `createDataQuery`
- `createStore`
- `createMutation`
- `createDataMutation`
- `invalidateResource`
- `invalidateAll`
- `configureReactiveDiagnostics`
- `getReactiveDiagnosticsSnapshot`
- `getReactiveGraphNodes`
- `getReactiveDependencyEdges`
- `getReactiveDiagnosticsEvents`
- `getReactiveTraceArtifact`
- `Suspense`
- `island`

## Recommended Path

### Signals

Use signals for local interactive state and small, explicit reactive values.

### Computed values

Use computed values when state is derived from one or more signals or store fields.

### Resources

Use `createResource` for async reads that need loading/error state and explicit invalidation.

Use `createDataQuery` when the read path is a long-lived application data contract with one canonical cache key.

### Stores

Use `createStore` when the state shape is object-like and benefits from field-level reactivity.

### Mutations

Use `createMutation` when the write path needs optimistic updates and a clear mutation lifecycle.

Use `createDataMutation` when the write path should invalidate one or more explicit query keys after success.

### Reactive diagnostics

Use the diagnostics APIs only for dev and tooling workflows.

The canonical machine-readable trace surface is `getReactiveTraceArtifact()`. It explains dependency edges, invalidation causes, and resource/mutation lifecycle without changing production behavior when diagnostics are disabled.

### Suspense

Use `Suspense` where async UI boundaries are deliberate and small. Do not treat it as a replacement for route structure.

### Islands

Use `island()` when only a portion of the page is interactive. Prefer islands over hydrating entire routes by default.

## Non-Goals

The reactive runtime is not intended to become:

- a VDOM compatibility layer
- a React mental-model clone
- a large adapter surface for multiple competing state models
- a permissive abstraction that makes reactive behavior harder for agents to infer

## Product Rule

If a new API weakens fine-grained reactivity, makes hydration more implicit, or reintroduces VDOM-style drift, it should not be added casually.
