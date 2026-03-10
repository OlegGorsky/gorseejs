# Product Vision

## Position

Gorsee is an AI-first application platform.

It is designed for deterministic collaboration between humans and coding agents, with security, observability, and runtime discipline treated as core product properties across frontend, fullstack, and server application modes.

Gorsee is not:

- a pet project
- a research prototype
- a loose collection of optional integrations
- a React-compatible wrapper with framework branding

Gorsee is a mature product under active hardening and productization.

Its canonical operating modes are:

- `frontend`
- `fullstack`
- `server`

These are not separate products. They are three official paths through one platform contract.

## Market Thesis

Most modern web frameworks still assume:

- humans are the primary authors
- flexibility is more valuable than determinism
- security and deployment guarantees can be deferred to docs and ecosystem recipes
- AI assistance can be bolted on afterward

Gorsee rejects those assumptions.

The framework is built for a world where:

- humans and coding agents work in the same repository
- ambiguous architecture slows delivery and increases risk
- production systems need explicit runtime contracts
- reactive performance and small client payloads matter

## Product Pillars

### AI-first development

The framework must be predictable for coding agents.

This requires:

- explicit project structure
- narrow import surfaces
- stable command and runtime contracts
- machine-readable docs and upgrade artifacts
- diagnostics and observability that can be consumed by tools
- strong defaults with minimal pattern drift

### Reactive-first execution

The runtime should reflect current frontend engineering, not historical baggage.

This means:

- fine-grained reactivity
- no mandatory VDOM layer
- direct SSR rendering
- explicit hydration
- islands for route-scoped client JavaScript

### Security-first runtime

Security is part of execution semantics, not post-facto hardening.

This means:

- request classification before execution
- explicit policy validation
- canonical origin contract
- guarded proxy trust
- fail-closed behavior for internal and state-changing surfaces

### Product-grade discipline

Every subsystem should behave like part of a mature framework product.

This means:

- release train discipline
- deploy assumptions encoded in generated artifacts
- first-party starter templates for canonical app classes
- tests for runtime and policy invariants
- compatibility surfaces managed intentionally
- avoidance of “just another option” API design

## Differentiation

Gorsee does not win by listing more features than larger frameworks.

It wins by combining:

- AI-native development workflow
- deterministic full-stack architecture
- reactive runtime without VDOM baggage
- enforceable security and deployment contracts

## Strategic Rules

- Prefer one strong model over multiple partially supported models.
- Prefer framework guarantees over ecosystem recipes.
- Prefer explicit contracts over implicit conventions.
- Prefer small, composable primitives over dependency-heavy abstraction layers.
- Prefer mature product behavior over experimental sprawl.
