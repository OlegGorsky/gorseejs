# Compatibility Guardrails

This document defines how Gorsee keeps the compatibility surface from expanding again as a mature product.

## Compatibility Rule

Compatibility APIs exist to help migration, not to define new greenfield architecture.

## Guardrails

- new docs should prefer `gorsee/client` and `gorsee/server`
- root `gorsee` remains compatibility-only
- compatibility paths need migration reasoning before they grow
- new examples and scaffolds should not normalize compatibility-only entrypoints

## Product Rule

Compatibility is a constraint, not a strategy. It must not become a backdoor for architectural drift.
