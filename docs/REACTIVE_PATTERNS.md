# Reactive Patterns

This document defines the recommended reactive patterns for Gorsee as a mature product.

The goal is not to expose many equivalent approaches. The goal is to keep reactive code predictable for both humans and coding agents.

## Signals

Use `createSignal` for:

- local interactive state
- explicit scalar state
- values that should remain easy to trace

Prefer signals over object-heavy state when the shape is small and local.

## Stores

Use `createStore` for:

- object-like state with several fields
- state that benefits from field-level updates
- cases where many related values belong to one domain object

Prefer stores when multiple signals would become harder to read than one shaped object.

## Resources

Use `createResource` for:

- async read flows
- UI that needs explicit loading and error state
- cases that benefit from `key`, `staleTime`, and explicit invalidation

Prefer:

- explicit `key` when deduplication matters
- explicit invalidation when stale data is a correctness issue
- route or domain structure that makes async ownership obvious

Do not:

- hide critical reads behind ambiguous resource ownership
- treat resource invalidation as implicit magic

## Mutations

Use `createMutation` for:

- async write flows
- optimistic UI updates with rollback
- state transitions that need pending/success/error lifecycle

Prefer:

- one mutation per clear write path
- optimistic updates only where rollback semantics are obvious

Do not:

- spread one business action across multiple unrelated mutation objects
- use optimistic updates when rollback would leave the UI ambiguous

## Suspense

Use `Suspense` for:

- small async UI boundaries
- explicitly isolated loading states
- transitions where a fallback is better than route-level blocking

Do not:

- use `Suspense` as a substitute for route structure
- create large, implicit async trees that are hard to reason about

## Islands

Use `island()` for:

- small interactive page regions
- controls, counters, toggles, forms, and focused widgets
- content pages that only need limited client-side interactivity

Prefer islands over full-route hydration unless the whole route truly needs client control.

## Product Rule

If a reactive pattern makes ownership, invalidation, hydration, or mutation lifecycle harder to infer, it is not a good canonical pattern for Gorsee.
