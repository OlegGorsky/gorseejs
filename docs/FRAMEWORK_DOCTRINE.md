# Framework Doctrine

This document defines the non-negotiable engineering doctrine for Gorsee.

## Product Level

Gorsee is built as a mature product.

Every change must be evaluated as a framework product decision, not as an experiment, playground tweak, or convenience shortcut.

## Core Doctrine

### Determinism over flexibility

If several valid implementation styles lead to drift, ambiguity, or agent confusion, the framework should choose one canonical path.

### Guarantees over recipes

Critical capabilities must live in the framework contract when possible:

- request policy
- security boundaries
- cache semantics
- deploy assumptions
- diagnostics and observability

### Reactivity over historical baggage

The runtime should remain fine-grained and direct.

Avoid introducing:

- mandatory VDOM diffing
- compatibility layers that weaken the reactive model
- dependencies that reintroduce legacy architecture by accident

### AI readability over cleverness

Agents must be able to infer structure and intent reliably.

Prefer:

- explicit file placement
- clear naming
- narrow APIs
- machine-readable artifacts
- generated scaffolds that already follow canonical route/form/data contracts

Avoid:

- magical cross-cutting behavior
- hidden alternate execution paths
- redundant APIs that do the same thing differently

### Fail-closed over permissive defaults

When the framework cannot prove a sensitive action is safe, it should reject or constrain it.

This especially applies to:

- origins
- proxy trust
- RPC boundaries
- cache visibility
- internal request surfaces

## Architectural Consequences

- `gorsee/client` and `gorsee/server` remain the primary public surfaces.
- Gorsee supports three canonical modes: `frontend`, `fullstack`, and `server`.
- These modes must share one doctrine, one CLI, one release train, and one contract vocabulary.
- scoped stable subpaths such as `gorsee/auth`, `gorsee/db`, `gorsee/security`, `gorsee/ai`, `gorsee/forms`, and `gorsee/routes` should carry clearly bounded domain concerns.
- route modules should converge on one canonical grammar: `load`, `action`, `cache`, `middleware`, and raw method handlers where transport-level control is required.
- Root `gorsee` stays compatibility-only unless a stricter migration story is defined.
- New features must strengthen AI-first and reactive-first identity.
- Optionality that weakens determinism is a cost, not a benefit.
- Security/runtime docs are part of the shipped contract.

## Rejection Criteria

Proposals should normally be rejected if they:

- introduce multiple blessed ways to solve the same core task
- blur client/server boundaries
- weaken request execution order
- add heavy dependencies for convenience
- increase implicit framework behavior without adding enforceable guarantees
- optimize for novelty while reducing maintainability or predictability
