# CI Policy

This document defines the minimum CI contract for Gorsee as a mature framework product.

## Required Gates

Every pull request and push to `main` must run:

1. `bun run ci:policy`
2. `bun run dependency:policy`
3. `bun run deploy:policy`
4. `bun run api:policy`
5. `bun run cli:policy`
6. `bun run adoption:policy`
7. `bun run ai:policy`
8. `bun run dx:policy`
9. `bun run maturity:policy`
10. `bun run runtime:policy`
11. `bun run runtime:security:policy`
12. `bun run examples:policy`
13. `bun run benchmarks:policy`
14. `bun run benchmarks:realworld:check`
15. `bun run critical:surface`
16. `bun run coverage:audit`
17. `bun run verify:security`
18. `bun run compiler:promotion:check`
19. `bun run build:promotion:check`
20. `bun run backend:switch:evidence:check`
21. `bun run backend:default-switch:review:check`
22. `bun run compiler:default:rehearsal:check`
23. `bun run build:default:rehearsal:check`
24. `bun run backend:candidate:rollout:check`
25. `bun run backend:candidate:verify`
26. `bun run test:critical-surface`
27. `bun run test:confidence`
28. `bun test`
29. `bun run release:train:check`
30. `bun run release:checklist:check`
31. `npm run release:check`
32. `npm run install:matrix`
33. `npm run release:smoke`
34. `bun run test:provider-smoke`
35. `bun run test:browser-smoke`

## Dependency Surface

`bun run dependency:policy` is required because runtime dependencies, Bun contract, and publish-time dependency discipline are part of the shipped product surface.

They must stay aligned with:

- `docs/DEPENDENCY_POLICY.md`
- `docs/DEPENDENCY_CONTRACT.json`

## Deploy Surface

`bun run deploy:policy` is required because deploy targets, runtime profiles, generated artifacts, and operator assumptions are part of the shipped product surface.

They must stay aligned with:

- `docs/DEPLOY_TARGET_GUIDE.md`
- `docs/ADAPTER_SECURITY.md`
- `docs/FIRST_PRODUCTION_ROLLOUT.md`
- `docs/SUPPORT_MATRIX.md`
- `docs/DEPLOY_CONTRACT.json`
- `docs/SUPPORT_MATRIX.md`

## Support Matrix

The validated CI surface must cover:

- operating systems: `ubuntu-latest`, `macos-latest`, `windows-latest`
- Node contract runtimes for cross-platform tooling/runtime validation: `22`, `24`
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

## Critical Surface Suite

`bun run critical:surface` and `bun run test:critical-surface` are required because a mature framework should isolate the narrow regression set that can silently degrade runtime or release credibility even when broader suites remain green.

They must keep failing closed for:

- `Accept-Encoding` negotiation and compression semantics
- proxy/origin/host request enforcement and RPC preflight
- router navigation regressions, hydration cleanup, and browser-global initialization safety
- reactive race contracts whose stale completions can corrupt authoritative state
- AI MCP contract regressions such as the server-level default limit
- packed release/install surface regressions for published subpaths and starter sandboxes

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

## API Stability Surface

`bun run api:policy` is required because public entrypoints and compatibility tiers are product contracts, not informal guidance.

They must stay aligned with:

- `docs/API_STABILITY.md`
- `docs/PUBLIC_SURFACE_MAP.md`
- `docs/PUBLIC_SURFACE_MANIFEST.json`
- `README.md`

## CLI Surface

`bun run cli:policy` is required because the CLI command matrix, AI subcommand surface, and cold-start/operator guidance are part of the shipped product contract.

They must stay aligned with:

- `docs/CLI_CONTRACT.json`
- `README.md`
- `AGENTS.md`
- `src/cli/framework-md.ts`

## Adoption Proof Surface

`bun run adoption:policy` is required because maturity, migration, and rollout claims should stay tied to canonical proof surfaces rather than drifting into generic prose.

They must stay aligned with:

- `proof/proof-catalog.json`
- `docs/ADOPTION_PROOF_MANIFEST.json`
- `docs/MARKET_READY_PROOF.md`
- `docs/MIGRATION_GUIDE.md`
- `docs/FIRST_PRODUCTION_ROLLOUT.md`
- `docs/RELEASE_CONTRACT.json`

## Coverage Audit Surface

`bun run coverage:audit` is required because Gorsee should not pretend that uncovered product surfaces are invisible.

It must stay aligned with:

- `docs/TEST_COVERAGE_AUDIT.md`
- `docs/SUPPORT_MATRIX.md`
- `README.md`

## Runtime Diagnostics Surface

`bun run runtime:policy` is required because runtime diagnostics and failure analysis are part of the shipped product surface.

They must stay aligned with:

- `docs/BUILD_DIAGNOSTICS.md`
- `docs/RUNTIME_FAILURES.md`
- `docs/CACHE_INVALIDATION.md`
- `docs/STREAMING_HYDRATION_FAILURES.md`
- `docs/RUNTIME_TRIAGE.md`
- `docs/STARTER_FAILURES.md`
- `docs/DIAGNOSTICS_CONTRACT.json`

## Runtime Security Surface

`bun run runtime:security:policy` is required because request classification, proxy trust, origin rules, and internal-vs-public execution semantics are shipped framework contracts.

They must stay aligned with:

- `docs/SECURITY_MODEL.md`
- `docs/ADAPTER_SECURITY.md`
- `docs/RUNTIME_SECURITY_CONTRACT.json`

## Benchmark Evidence Surface

`bun run benchmarks:policy` and `bun run benchmarks:realworld:check` are required because performance claims, benchmark families, and realistic app-shape regressions are part of the shipped evidence surface.

They must stay aligned with:

- `docs/BENCHMARK_POLICY.md`
- `docs/BENCHMARK_METHODOLOGY.md`
- `docs/BENCHMARK_ARTIFACTS.md`
- `docs/BENCHMARK_RELEASE_DISCIPLINE.md`
- `docs/REACTIVE_BENCHMARKS.md`
- `docs/BENCHMARK_CONTRACT.json`

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
