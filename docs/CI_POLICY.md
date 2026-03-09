# CI Policy

This document defines the minimum CI contract for Gorsee as a mature framework product.

## Required Gates

Every pull request and push to `main` must run:

1. `bun run ci:policy`
2. `bun run ai:policy`
3. `bun run dx:policy`
4. `bun run maturity:policy`
5. `bun run runtime:policy`
6. `bun run examples:policy`
7. `bun run verify:security`
8. `bun run compiler:promotion:check`
9. `bun run build:promotion:check`
10. `bun run backend:switch:evidence:check`
11. `bun run backend:default-switch:review:check`
12. `bun run compiler:default:rehearsal:check`
13. `bun run build:default:rehearsal:check`
14. `bun run backend:candidate:rollout:check`
15. `bun run backend:candidate:verify`
16. `bun run test:confidence`
17. `bun test`
18. `bun run release:train:check`
19. `bun run release:checklist:check`
20. `npm run release:check`
21. `npm run install:matrix`
22. `npm run release:smoke`
23. `bun run test:provider-smoke`
24. `bun run test:browser-smoke`

## Support Matrix

The validated CI surface must cover:

- operating systems: `ubuntu-latest`, `macos-latest`, `windows-latest`
- browser smoke targets: `chromium`, `firefox`, `webkit`

Cross-platform CI does not need to run the heaviest release workflow on every OS. It does need to prove install, typecheck, and core CLI/runtime contract behavior on every documented validated OS.

## Change-Sensitive Rules

Security-sensitive and runtime-contract changes must not bypass the security gate.

This includes changes affecting:

- request ordering
- middleware / guard / load / action / RPC execution
- origin / proxy / host handling
- cache key or `Vary` semantics
- public client/server entrypoints and workspace self-reference behavior
- large-app fixtures, route groups, and multi-layer runtime composition
- deploy adapters and generated provider configs
- release scripts and publish metadata
- compiled publish surface, packed tarball contents, and install matrix behavior

For those changes, CI must run the full sequence above before merge.

CI is not a convenience layer. It is part of the framework's product enforcement surface.

## Confidence Suite

`bun run test:confidence` is the mandatory high-signal fixture suite for:

- public entrypoint boundaries
- dev/prod auth and cache parity
- dev/prod cache and RPC parity
- production large-app composition coverage
- canonical production recipe fixtures

These tests exist to prove that Gorsee behaves like a mature product under realistic app shapes, not only under isolated unit scenarios.

## Runtime Smoke

`bun run test:provider-smoke` and `bun run test:browser-smoke` are required because production credibility depends on:

- provider handlers executing built output, not placeholder text
- browser-visible hydration and navigation working on the built runtime
- CI proving the shipped production path, not only internal module contracts
- browser claims being validated on Chromium, Firefox, and WebKit rather than one happy-path engine

## Examples Surface

`bun run examples:policy` is required because canonical examples are part of the shipped product surface.

They must stay aligned with:

- `docs/CANONICAL_RECIPES.md`
- `docs/FRAMEWORK_DOCTRINE.md`
- `docs/EXAMPLES_POLICY.md`

## Runtime Diagnostics Surface

`bun run runtime:policy` is required because runtime diagnostics and failure analysis are part of the shipped product surface.

They must stay aligned with:

- `docs/BUILD_DIAGNOSTICS.md`
- `docs/RUNTIME_FAILURES.md`
- `docs/CACHE_INVALIDATION.md`
- `docs/STREAMING_HYDRATION_FAILURES.md`
- `docs/RUNTIME_TRIAGE.md`
- `docs/STARTER_FAILURES.md`

## AI Workflow Surface

`bun run ai:policy` is required because AI workflows are part of the shipped product surface.

They must stay aligned with:

- `docs/AI_WORKFLOWS.md`
- `docs/AI_IDE_SYNC_WORKFLOW.md`
- `docs/AI_MCP_WORKFLOW.md`
- `docs/AI_BRIDGE_WORKFLOW.md`
- `docs/AI_TOOL_BUILDERS.md`
- `docs/AI_SURFACE_STABILITY.md`
- `docs/AI_SESSION_PACKS.md`
- `docs/AI_DEBUGGING_WORKFLOWS.md`
- `docs/AI_ARTIFACT_CONTRACT.md`

## DX Surface

`bun run dx:policy` is required because adoption guidance is part of the shipped product surface.

They must stay aligned with:

- `docs/STARTER_ONBOARDING.md`
- `docs/MIGRATION_GUIDE.md`
- `docs/UPGRADE_PLAYBOOK.md`
- `docs/DEPLOY_TARGET_GUIDE.md`
- `docs/FIRST_PRODUCTION_ROLLOUT.md`
- `docs/AUTH_CACHE_DATA_PATHS.md`
- `docs/RECIPE_BOUNDARIES.md`
- `docs/WORKSPACE_ADOPTION.md`
- `docs/TEAM_FAILURES.md`

## Maturity Surface

`bun run maturity:policy` is required because long-tail maturity standards are part of the shipped product surface.

They must stay aligned with:

- `docs/MATURITY_POLICY.md`
- `docs/DEPENDENCY_POLICY.md`
- `docs/COMPATIBILITY_GUARDRAILS.md`
- `docs/AMBIGUITY_POLICY.md`
- `docs/DX_FEEDBACK_LOOP.md`
- `docs/EVIDENCE_POLICY.md`
- `docs/ROADMAP_COMPLETION_POLICY.md`

## Release Train

The release train workflow must support validating:

- `stable`
- `canary`
- `rc`

Canary and RC validation should run before stable for security-sensitive semantic tightening.

Compiler/build backend promotion gates must remain part of the release train before any default backend switch is shipped.

## Bun Contract

- the repository uses `bun@1.3.9` as the exact package manager contract
- CI must use `bun install --frozen-lockfile`
- lockfile drift is treated as a policy failure, not as an optional warning

## Product Standard

No pull request should be treated as “just a prototype change” when it affects runtime, security, release, or tooling contracts.

Changes that redefine public API tiers, support claims, or deprecation behavior must update:

- `docs/API_STABILITY.md`
- `docs/SUPPORT_MATRIX.md`
- `docs/DEPRECATION_POLICY.md`
