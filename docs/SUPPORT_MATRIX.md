# Support Matrix

This document defines the supported execution matrix for Gorsee as a product.

Gorsee is a mature product. Support claims should therefore map to documented and validated product behavior.

## Runtime Contract

- package manager contract: `bun@1.3.9`
- exact Bun engine contract: `1.3.9`
- machine-readable dependency contract: `docs/DEPENDENCY_CONTRACT.json`
- primary runtime target: Bun
- primary development/build runtime target: Bun
- production build runtime entries: `dist/prod.js` for Bun, `dist/prod-node.js` for Node, `dist/server-handler.js` for Bun-compatible fetch adapters, and `dist/server-handler-node.js` for Node-compatible fetch adapters
- publish/install contract: compiled package surface via `dist-pkg/*.js` and `dist-pkg/*.d.ts`

Gorsee currently optimizes for Bun-first development and build execution.
Production output now also includes a first-class Node runtime entry without requiring the source `routes/` tree at runtime.

## Distribution Contract

- repository development uses the source-first workspace surface in `src/`
- packed releases must rewrite exports, `bin`, and `types` to compiled `dist-pkg/` artifacts
- `npm pack` output must not ship raw `src/index.ts`
- starter bootstrap must stay available through `bunx gorsee create`, `npx create-gorsee`, and `npm create gorsee@latest`
- install validation must cover source install, tarball install, and workspace install paths before release
- release smoke must exercise packed starter creation, standalone `create-gorsee`, `check`, `typegen`, `docs`, `build`, deploy generation, and canonical example sandbox builds from the packed tarball
- public API stability must stay machine-readable through `docs/PUBLIC_SURFACE_MANIFEST.json` and `api:policy`
- deploy/runtime profile assumptions must stay machine-readable through `docs/DEPLOY_CONTRACT.json` and `deploy:policy`

## Framework Surfaces

Canonical application modes:

- `frontend`
- `fullstack`
- `server`

Reference: `docs/APPLICATION_MODES.md`

## CI-Validated Matrix

Current CI-validated matrix:

- operating systems: `ubuntu-latest`, `macos-latest`, `windows-latest`
- Node contract runtimes for cross-platform tooling/runtime validation: `22`, `24`
- browser runtime smoke: `chromium`, `firefox`, `webkit`

Validation rules:

- cross-platform jobs prove install, typecheck, and core CLI/runtime contract compatibility
- cross-platform jobs also validate the documented Node production entry on the supported Node contract runtimes
- browser matrix jobs prove hydration/navigation semantics on the built production runtime
- provider smoke remains Ubuntu-based unless a provider contract explicitly requires broader host validation

### Supported

- development server via `gorsee dev`
- starter bootstrap via `bunx gorsee create`, `npx create-gorsee`, or `npm create gorsee@latest`
- production runtime via `gorsee start`
- Node production runtime via `gorsee start --runtime node` or `node dist/prod-node.js`
- canonical Bun-first server-mode worker runtime via `gorsee worker` or `bun run worker`
- build pipeline via `gorsee build`
- frontend-mode static/prerendered build output without process runtime entrypoints
- server-mode process runtime output without mandatory client bundle generation
- structured job lifecycle telemetry for memory and Redis-backed job queues through the AI observability surface
- first-class worker service lifecycle helpers via `defineWorkerService()` and `runWorkerService()`
- type generation, docs generation, and migrations through the documented CLI
- deployment generators for Vercel, Netlify, Fly.io, Cloudflare, and Docker
- process deploy generation with explicit runtime profiles: `gorsee deploy docker --runtime bun|node` and `gorsee deploy fly --runtime bun|node`
- provider-fixed runtime profiles: Vercel emits the Node-compatible handler path, Cloudflare and Netlify emit fetch/edge-compatible handler paths

### Product-Validated

These surfaces are expected to stay covered by CI, release checks, or integration tests:

- dev/prod parity
- request/security policy behavior
- deploy adapter assumptions
- browser navigation and client hydration on the production runtime
- browser navigation and client hydration on Chromium, Firefox, and WebKit
- query-bearing navigation plus form/focus/scroll preservation on the production runtime
- generated provider handlers serving built output
- built Bun and Node production runtime entries plus Bun/Node-compatible server handler artifacts
- built Bun and Node runtime entrypoints remain validated against Node `22` and `24` in CI
- generated Docker and Fly process deploy artifacts for both Bun and Node runtime profiles
- deploy contract surface via `deploy:policy` and `docs/DEPLOY_CONTRACT.json`
- optimized image props/srcset contracts, structured form validation/action helpers, and typed route builders
- locale negotiation/fallback/Intl helpers and locale-aware content collection loading
- scaffold/install matrix
- stable release channel discipline
- public API stability surface via `api:policy` and `docs/PUBLIC_SURFACE_MANIFEST.json`
- adoption proof surface via `adoption:policy` and `docs/ADOPTION_PROOF_MANIFEST.json`
- competition backlog and external proof intake surface via `competition:policy`, `docs/COMPETITION_BACKLOG.json`, and `docs/EXTERNAL_PROOF_REGISTRY.json`
- explicit Node/npm adoption framing via `docs/NODE_NPM_ADOPTION.md`
- benchmark evidence surface via `benchmarks:policy`, `benchmarks:realworld:check`, and `docs/BENCHMARK_CONTRACT.json`
- release-facing reactive evidence summary via `docs/REACTIVE_EVIDENCE_SUMMARY.md` and `docs/REACTIVE_EVIDENCE_SUMMARY.json`
- third-party editor integration guidance via `docs/THIRD_PARTY_EDITOR_INTEGRATIONS.md` and `docs/AI_INTEGRATION_CONTRACT.json`
- critical surface suite via `critical:surface` and `test:critical-surface`
- release contract surface via `docs/RELEASE_CONTRACT.json`, `release:train:check`, and `release:checklist:check`
- runtime security surface via `runtime:security:policy` and `docs/RUNTIME_SECURITY_CONTRACT.json`
- diagnostics contract surface via `runtime:policy` and `docs/DIAGNOSTICS_CONTRACT.json`
- dependency surface via `dependency:policy` and `docs/DEPENDENCY_CONTRACT.json`
- test coverage audit via `docs/TEST_COVERAGE_AUDIT.md` and `coverage:audit`

## Experimental Backend Flags

These flags are not stable support claims. They are controlled migration surfaces and must stay behind parity checks before promotion:

- `GORSEE_COMPILER_BACKEND=experimental-oxc`
- `GORSEE_BUILD_BACKEND=experimental-rolldown`

Rules:

- default production behavior remains `oxc` analysis plus `rolldown` build backend
- experimental backends must prove parity before becoming defaults
- `oxc` is the canonical compiler default
- `rolldown` is the canonical build default
- docs should not call experimental backends supported until release validation exists

## Backend Promotion Gates

- `oxc` is the canonical compiler default and must keep `compiler:parity`, `compiler:canary`, `compiler:evidence:verify`, and promotion policy checks green.
- `compiler:evidence:verify` is the practical evidence train for protecting the canonical compiler default after the switch.
- `rolldown` is the canonical build default and must keep `build:parity`, `build:canary`, `build:evidence:verify`, and promotion policy checks green.
- `build:evidence:verify` is the practical evidence train for protecting the canonical build default after the switch.
- production runtime smoke parity is part of the build promotion gate, not an optional extra.
- changing the canonical default without the promotion gates should be treated as a release-policy violation.

## Application Shapes

Current product focus:

- content-heavy SSR applications
- islands-based interactive applications
- reactive dashboards and real-time applications
- product-grade full-stack apps using auth, cache, routes, and deploy adapters

## Support Expectations

- if a target is documented as supported, it should be testable and releasable
- if a target is not tested, docs should avoid strong support claims
- provider-specific assumptions must be encoded in adapter docs and validated in release workflows where possible

## Future Expansion Rules

Before broadening the support matrix, Gorsee should add:

- automated validation
- explicit documentation
- release and compatibility reasoning

No environment should be called supported on reputation alone.
