# Dependency Policy

This document defines dependency discipline for Gorsee as a mature product.

## Rules

- prefer no new dependency over a convenience dependency
- prefer one deliberate dependency over a stack of overlapping helpers
- new dependencies must strengthen the AI-first reactive framework model
- dependency growth must not weaken determinism, bundle discipline, or runtime clarity

## Review Questions

Before adding a dependency:

1. does it replace complexity or only hide it
2. does it add a second way to solve a framework-level problem
3. does it weaken the dependency-light runtime identity
4. does it expand the long-term maintenance burden more than it helps

## Product Rule

Dependency surface is part of the product surface. Unnecessary growth is a product defect.

## Publish Rule

- if a dependency is imported by the shipped CLI, build pipeline, runtime, or compiled package surface, it must be treated as a runtime dependency
- publish-time compiled artifacts must not depend on packages that are only present in `devDependencies`
- runtime dependencies should stay pinned exactly so release and install validation match the shipped tarball
