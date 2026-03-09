# Cache Invalidation

This document defines cache invalidation expectations for Gorsee as a mature product.

## Default Position

Cache invalidation must remain explicit. Gorsee prefers deterministic cache intent over implicit reuse.

## Modes

- `private`: default for user-sensitive document responses
- `public`: only for intentionally non-personalized responses
- `shared`: only when shared caches are a deliberate product choice
- `no-store`: required for partial navigation and other failure-prone response shapes

## Invalidation Rules

1. Do not let document and partial responses share a cache identity.
2. Keep `partial` responses on `Cache-Control: no-store`.
3. Treat cookie-aware and authorization-aware responses as separate cache contexts.
4. Use explicit invalidation after writes, not wishful eventual consistency.
5. Prefer correctness over hit rate when auth, personalization, or route groups are involved.

## Complex App Expectations

In complex apps with nested layouts, route groups, auth middleware, and RPC side effects:

- document cache entries should stay cookie-aware by default
- partial responses must stay uncached
- mutations should invalidate the exact document surfaces they affect
- operators should be able to reason about invalidation without reverse-engineering hidden cache rules

## Common Mistakes

- using `public` cache mode on personalized pages
- assuming partial navigation can reuse document cache entries
- forgetting that `routeCache()` defaults to private, auth-aware semantics
- widening cache scope before proving the route is truly shared
