# Upgrade Playbook

This document defines upgrade handling for Gorsee as a mature product.

## Recommended Upgrade Flow

1. read release notes and policy docs
2. run `gorsee upgrade`
3. inspect `docs/upgrade-report.json` for migration notes and remaining manual follow-ups
4. run `bun run test:confidence` when runtime-sensitive behavior changed
5. rerun `gorsee typegen` and `gorsee docs` for app packages where relevant
6. validate that `app.mode` is explicit and still matches the intended product shape
7. validate deploy artifacts and placeholder origins before rollout

## Dry-Run Audit

Use `gorsee upgrade --check --report docs/upgrade-report.json` when you want the structured migration audit without installing a new version yet.

The generated report is expected to include the resolved `appMode` plus recommended follow-up docs such as `docs/APPLICATION_MODES.md`.

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
