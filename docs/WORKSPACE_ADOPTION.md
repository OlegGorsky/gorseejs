# Workspace Adoption

This document defines workspace and monorepo adoption guidance for Gorsee as a mature product.

For Bun-first versus Node/npm framing, read `docs/NODE_NPM_ADOPTION.md`.

## Recommended Structure

- root workspace package manager contract on `bun@1.3.9`
- app package owns `app.config.ts`, routes, deploy config, auth, cache, and runtime policy
- shared packages own domain or UI reuse, not hidden runtime behavior

## Common Friction

- hiding app runtime policy inside shared packages
- using root `gorsee` from shared code
- trying to make shared packages control deploy/runtime assumptions
- forgetting to run `gorsee check`, `typegen`, and `docs` from the app package

## Preferred Flow

1. keep one clear `apps/web` package
2. keep one or more `packages/*` shared modules
3. run installs from workspace root
4. run framework commands from the app package

## Product Rule

Workspace adoption should stay deterministic. Shared packages must not become a backdoor for runtime ambiguity.
