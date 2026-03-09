# Upgrade Playbook

This document defines upgrade handling for Gorsee as a mature product.

## Recommended Upgrade Flow

1. read release notes and policy docs
2. update the framework version intentionally
3. run `gorsee upgrade --rewrite-imports --check --report docs/upgrade-report.json`
4. run `bun run check -- --rewrite-loaders` when route modules still carry `loader` aliases
5. run `bun run test:confidence` when runtime-sensitive behavior changed
6. rerun `gorsee typegen` and `gorsee docs` for app packages where relevant
7. validate deploy artifacts and placeholder origins before rollout

## Channel Guidance

- `stable` for normal production use
- `canary` for early validation of runtime/security changes
- `rc` for final verification before stable rollout

## Contract Changes

When an upgrade changes:

- API stability
- support matrix
- deprecation behavior
- runtime diagnostics
- AI workflows

the corresponding docs must be read as part of the upgrade.


## Backend Override Compatibility

- canonical compiler/build defaults now center `oxc` and `rolldown`
- legacy overrides remain documented in `docs/BACKEND_OVERRIDE_DEPRECATION.md` until a separate deprecation review removes them

- override removal sequencing is documented in `docs/BACKEND_OVERRIDE_REMOVAL_PLAN.md` and must not start before review is complete
