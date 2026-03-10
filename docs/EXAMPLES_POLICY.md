# Examples Policy

This document defines the policy for canonical Gorsee example apps.

Examples are part of the mature product surface. They are not disposable demos, sandbox code, or low-discipline marketing artifacts.

## Purpose

Canonical examples exist to:

- show the recommended production path for important app classes
- validate adoption workflows outside the framework source tree
- provide agent-friendly reference structure for real application shapes

## Current Canonical Examples

- `examples/frontend-app`
- `examples/secure-saas`
- `examples/content-site`
- `examples/agent-aware-ops`
- `examples/workspace-monorepo`
- `examples/server-api`

Related proof surfaces:

- `benchmarks/realworld`
- `proof/proof-catalog.json`

## Requirements

Every canonical example must:

- describe itself as part of a mature product surface
- use `gorsee/client` and `gorsee/server` entrypoints rather than root `gorsee`
- declare exact `packageManager: "bun@1.3.9"`
- expose `dev`, `build`, `start`, and `check` scripts
- keep dependencies pointed at the local framework via `file:../../`
- represent one clear recommended path, not multiple competing patterns
- remain clean, reproducible proof surfaces without committed `node_modules`, `dist`, `.gorsee*`, or local database files

Mode coverage rule:

- canonical examples must collectively cover `frontend`, `fullstack`, and `server` application modes
- mode-specific scaffolds may exist in `gorsee create`, but mature product guidance should still point at inspectable repository proof surfaces for each first-class mode
- canonical repo-local examples that depend on `gorsee` via `file:../../` must not commit `bun.lock`; Bun currently serializes local package metadata in a way that is not stable enough for this proof surface
- if `package-lock.json` is committed for a canonical example, it must stay aligned with the current Gorsee version and pinned type/runtime surfaces

## Enforcement

Canonical examples are enforced through:

- `bun run examples:policy`
- `bun run proof:policy`
- `npm run install:matrix`
- `npm run release:smoke`

Examples must remain buildable and checkable as real apps, not only readable as files.

## Product Standard

If an example drifts from the framework doctrine, canonical recipes, or shipped runtime behavior, that is a product defect.
