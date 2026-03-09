# Reactive Hydration

This document defines the current hydration guidance for Gorsee as a mature product.

Hydration is not treated as an invisible default. It is a deliberate runtime choice tied to route shape and interactivity boundaries.

## Core Rule

Prefer the smallest hydration boundary that solves the product need.

In practice that means:

- prefer SSR-only output for fully static regions
- prefer islands for focused interactivity
- hydrate broad route regions only when the route genuinely behaves like a client-controlled surface

## Runtime Semantics

When Gorsee performs client navigation or hydration, the runtime contract is:

- newer navigations cancel older in-flight navigations
- late responses from stale navigations are discarded
- route identity is query-aware; `pathname + search` is the canonical client navigation path
- native form submissions are not intercepted by the router unless an explicit Gorsee form runtime is used; repeat submissions therefore follow native browser request semantics
- push navigations reset scroll to the top of the next route
- history back/forward restores the previous scroll position
- form controls and focus are preserved across partial navigations when the next route exposes the same preserve key, `name`, or `id`
- incidental focus on links or other non-preserved elements must not overwrite the last preserved form-control focus target
- hydration mismatches trigger a controlled full client re-render instead of silently leaving ownership ambiguous
- `beforeNavigate` hook failures cancel navigation fail-closed instead of continuing through ambiguous client state

## Preferred Path

### SSR-only

Use SSR-only rendering when:

- the content is informational
- interactivity is absent or trivial
- SEO and cacheability dominate

### Islands

Use islands when:

- only small controls or widgets are interactive
- the page is mostly content
- client JavaScript should stay intentionally small

### Broad Route Hydration

Use broader hydration only when:

- many page regions depend on client-side state
- the route behaves like an application surface rather than a content surface
- multiple islands would make ownership less clear than one cohesive interactive route

## Anti-Patterns

Do not:

- hydrate the whole route because it is convenient
- mix public content and large client takeover without a clear reason
- treat hydration scope as an incidental build artifact rather than a product choice

## Product Rule

Hydration should remain explicit, bounded, and easy for both humans and agents to infer from code structure.
