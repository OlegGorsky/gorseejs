# Canonical Language Plan

This document defines the plan for tightening Gorsee's framework language without weakening the product's core philosophy.

The objective is not to reduce capability. The objective is to remove ambiguity, collapse competing high-level paths, and make the framework easier for both humans and coding agents to read, generate, and maintain.

## Product Goal

Gorsee should preserve and strengthen these properties:

- reactive-first execution
- deterministic architecture
- strict client/server boundaries
- security-first runtime behavior
- AI-first readability and observability
- product-grade documentation, examples, and release discipline

The language plan must improve clarity without regressing those properties.

## Target State

Gorsee should converge on a language where a new developer or coding agent can infer, with minimal documentation:

- where to import a capability from
- how route data is read
- how mutations are performed
- how forms are modeled
- how routes are built and navigated
- how cache behavior is declared and invalidated
- where client/server boundaries are enforced

## Core Rules

- one canonical way beats multiple overlapping ways
- compatibility surfaces must not shape future product language
- helper-style APIs should not become the center of the public model
- documentation, examples, generators, and policy checks must all teach the same language
- new APIs are justified only when they strengthen the canonical grammar

## Scope

This plan covers:

- public entrypoints
- route module grammar
- mutation semantics
- forms
- routing contracts
- auth and access-control language
- cache and invalidation language
- naming consistency
- docs, examples, generators, and deprecation policy

## Phase 0: Fix The Language Contract

Define the target language explicitly before adding new architecture on top of the current surface.

Deliverables:

- a canonical language RFC or equivalent strategy artifact
- explicit classification of surfaces as `stable`, `compat`, `experimental`, or `internal`
- a single preferred path for each core task

Questions this phase must answer:

- what are the canonical public surfaces
- what is compatibility-only
- what is the preferred route grammar
- what is the preferred mutation model
- what is the preferred form model
- what is the preferred routing contract

## Phase 1: Clean Up Public Surfaces

Reduce ambiguity at the import boundary first.

### Canonical surfaces

Keep these as the main stable surfaces:

- `gorsee/client`
- `gorsee/server`

Keep these as scoped stable surfaces for clearly bounded domains:

- `gorsee/auth`
- `gorsee/db`
- `gorsee/security`
- `gorsee/ai`
- `gorsee/i18n`
- `gorsee/content`

Introduce additional scoped surfaces only if they improve clarity:

- `gorsee/forms`
- `gorsee/routes`

### Compatibility surfaces

- root `gorsee` remains compatibility-only
- `gorsee/compat` remains the explicit compatibility entrypoint

### Required changes

- stop teaching greenfield usage through root `gorsee`
- stop treating compatibility layers as equal to canonical surfaces
- stop using kitchen-sink exports as the primary teaching surface

### Surface tightening work

For `gorsee/client`:

- keep browser-safe reactive and UI/runtime primitives
- keep navigation, link, hydration, and island semantics
- keep only client-native form/runtime bindings that belong in browser-safe code
- move domain-heavy concerns toward scoped subpaths over time

For `gorsee/server`:

- keep route/runtime/server contracts
- keep middleware, request policy, render and cache semantics
- avoid using it as the primary teaching surface for every domain concern
- prefer scoped subpaths for auth, db, security, ai, content, and i18n in docs and scaffolds

## Phase 2: Canonical Route Module Grammar

Every route module should read as a small deterministic program.

### Canonical page grammar

Preferred route-level concepts:

- component or default export for UI
- `load` for reading route data
- `action` for route-bound mutations
- `cache` for declarative cache policy
- `middleware` for cross-cutting request policy

### Canonical raw transport grammar

Preferred endpoint-level concepts:

- `GET`
- `POST`
- `PUT`
- `PATCH`
- `DELETE`

### Language rule

Use page grammar for application flows.
Use raw HTTP handlers for transport-level concerns.
Do not present multiple high-level grammars as equally preferred for normal application code.

## Phase 3: Unify Mutation Semantics

Gorsee currently risks scattering mutations across multiple concepts.

### Canonical mutation model

Promote one primary model for application mutations:

- `action`

### Secondary mutation models

Keep transport or integration-level mechanisms only where they are justified:

- raw method handlers for explicit protocol handling
- RPC and lower-level server execution helpers for advanced integration scenarios

### Required changes

- make the preferred mutation model obvious in docs, examples, and generators
- reduce visible competition between `action`, raw handlers, RPC helpers, and other server-side abstractions
- ensure users do not need to understand internal transport machinery to perform common app mutations

## Phase 4: Make Forms First-Class

Forms should feel like a framework contract, not a bag of utilities.

### Desired form model

One coherent form contract should express:

- schema
- coercion
- validation
- action binding
- field metadata
- server result shape
- progressive enhancement
- submission state

### Required behavior

- HTML form submission must work canonically without JavaScript
- the same form should progressively enhance with JavaScript without changing models
- field errors and form errors must use one stable, typed shape
- form results should be predictable for humans and agents

### Required API direction

Low-level helpers such as:

- schema definition
- validation utilities
- field attribute helpers
- request parsing helpers

may remain, but should no longer be the primary language taught to users.

The primary user-facing model should bind schema, validation, and action behavior together.

## Phase 5: Promote Routes From Helpers To Contracts

Typed routing should become a framework-native language, not just a typed utility layer.

### Desired route contract

A route entity should unify:

- path
- params
- search
- hash
- validation
- build
- navigate
- prefetch

### Required changes

- move away from helper-heavy route authoring as the main user story
- make route objects or route contracts first-class
- allow `Link` and navigation APIs to consume route contracts naturally
- evolve type generation toward generated route bindings, not only loose helper functions

### Language rule

Type safety should feel like the default route model, not an optional `typed` add-on layered on top.

## Phase 6: Unify Access Control Language

Auth and access control must read as one coherent high-level story.

### Preferred direction

- `auth` is the primary high-level product contract
- generic `guard` primitives remain available for advanced or custom access rules

### Required changes

- remove duplicated high-level access-control teaching paths
- define one canonical way to protect route groups
- define one canonical way to express role and permission checks
- reduce manual nested middleware examples where a clearer product contract can exist

## Phase 7: Make Cache A Language Strength

Cache semantics are one of the most important places to be more predictable than the market.

### Desired cache language

Cache should be:

- declarative
- request-policy aware
- visibility aware
- auth aware
- invalidation friendly
- inspectable by tools

### Required decisions

Fix one canonical story for:

- cache declaration
- vary semantics
- auth-aware cache behavior
- invalidation triggers
- cache diagnostics

### Diagnostics requirement

The framework should be able to explain:

- why a request was a hit or miss
- which vary inputs were used
- why a route was private, public, shared, or no-store
- what invalidated a cache entry

## Phase 8: Normalize Naming

Naming must reflect one grammar, not historical growth.

### Naming rules

- use `createX` for runtime instances or concrete entities
- use `defineX` for declarative contracts
- use `buildX` for pure value construction
- avoid leaving transport or internal helper names at the center of the public language
- avoid highlighting `typed` in central API names when type safety is meant to be the default

### Required work

- review public naming for routes, forms, mutations, cache, and server APIs
- collapse inconsistent `create` vs `define` vs `build` semantics
- push helper-style names down into lower-level layers where appropriate

## Phase 9: Align Docs, Examples, And Generators

The language is not real until the teaching surface matches it.

### Documentation work

Update the canonical product docs so they teach only the preferred language for greenfield code.

At minimum review:

- `README.md`
- `docs/FRAMEWORK_DOCTRINE.md`
- `docs/API_STABILITY.md`
- `docs/AMBIGUITY_POLICY.md`
- `docs/SECURITY_MODEL.md`
- `docs/CANONICAL_RECIPES.md`
- migration and deprecation docs

### Example work

- ensure first-party examples all use canonical imports and canonical route/form/data patterns
- remove examples that accidentally teach a competing high-level path

### Generator work

- make `gorsee create` produce only canonical language
- make type generation and scaffolds reinforce route contracts, action contracts, and canonical imports

## Phase 10: Controlled Deprecation

The language should tighten without forcing abrupt ecosystem breakage.

### Required deprecation process

For each non-canonical public API:

- classify it as `stable`, `compat`, `deprecated`, or `internal`
- document the replacement path
- define when it stops being recommended
- define whether a codemod is possible

### Deprecation rule

Keep compatibility where needed, but do not add new product guidance on top of compatibility surfaces.

## Phase 11: Enforce The Language In CI

The repository needs policy support so ambiguity does not regrow.

### Required checks

- docs must not teach compatibility paths outside migration contexts
- examples must use canonical import surfaces
- generators must produce canonical patterns
- new public APIs must not duplicate existing high-level tasks without explicit review

### Review rule

Every new public API proposal should answer:

- does it strengthen the canonical grammar
- does it reduce or increase ambiguity
- does it make agent reasoning easier or harder

## Implementation Order

Execute the plan in this order:

1. fix the language contract
2. clean up public surfaces
3. define canonical route grammar
4. unify mutation semantics
5. redesign forms as first-class contracts
6. promote routes into first-class contracts
7. unify access-control language
8. strengthen cache language and diagnostics
9. align docs, examples, and generators
10. roll out deprecations
11. enforce the language with policy checks

## Non-Negotiable Preservations

The language work must not weaken:

- fine-grained reactivity
- island-based hydration strategy
- deterministic runtime behavior
- security-first request semantics
- explicit request policy validation
- AI-first diagnostics and observability
- mature product discipline

## Success Criteria

This plan is successful when:

- a new developer can infer the preferred import path for common tasks
- a coding agent can generate canonical route, form, and server code with low ambiguity
- docs, examples, and scaffolds all teach the same model
- compatibility paths no longer shape the product's future language
- the framework reads as one coherent system instead of several overlapping layers

## Final Product Standard

Gorsee should converge on a public language with:

- one canonical client surface
- one canonical server surface
- one canonical route grammar
- one primary data-read model
- one primary mutation model
- one first-class form contract
- one first-class route contract
- one explicit cache and invalidation language

That is the target state this plan is meant to deliver.
