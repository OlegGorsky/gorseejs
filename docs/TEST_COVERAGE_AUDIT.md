# Test Coverage Audit

This document defines the current test coverage map and gap backlog for Gorsee as a mature framework product.

The goal is not vanity percentages. The goal is contract coverage: every important product surface should either have a direct automated test, a policy/conformance gate, or an explicitly tracked gap with an owner-level rationale.

## Coverage Model

Gorsee treats the following layers as the canonical test model:

- unit tests for pure contracts and hostile input handling
- integration tests for end-to-end runtime behavior across multiple framework surfaces
- conformance/policy checks for docs, generated artifacts, release gates, and support claims
- provider/browser smoke tests for built production paths
- parity/evidence checks for compiler/build backends and shipped artifacts
- a critical surface suite for narrow high-risk regressions that should fail before broad-suite drift can hide them

“Covered” means at least one of those layers exists and is intentional.
“Gap” means there is no strong automated proof for a product claim or a failure-prone branch.

## Current Surface Map

### Covered Strongly

- request/security policy: origin, proxy, host, forwarded metadata, request classification, RPC preflight
- route cache and cache invalidation basics: vary semantics, auth-aware defaults, no-store/private/public/shared handling
- deploy generators and provider smoke: Vercel, Netlify, Fly, Cloudflare, Docker
- CLI policy surface: API stability, examples policy, DX policy, maturity policy, runtime diagnostics policy, release train policy
- build/compiler evidence: parity, promotion, dossier, canary, artifact parity, server bundle output
- auth/session workflows: core auth flows, action tokens, workflow coverage
- AI workflow surface: bridge, MCP, IDE sync, bundle/store/summary/watch contracts
- install/publish/release surface: install matrix, packed release smoke, release checks

### Covered Partially

- page rendering pipeline: route rendering, partial payloads, streaming, error boundaries
- reactive runtime: signals/resources/diagnostics are covered, but adversarial hydration drift and long-session invalidation paths remain thinner
- dev runtime: HMR/dev runtime is covered, but more malformed event/channel cases can be locked down
- plugin ecosystem: conformance exists, but failure-path coverage for misdeclared dependency graphs and config errors is still lighter than core runtime coverage
- content/forms/i18n/image/routes helpers: stable positive-path coverage exists, but fewer hostile and compatibility-focused cases are locked down

### Gap Backlog

- `COV-RUNTIME-001`: closed for the current route rendering surface. Coverage now includes route-response/not-found deep tests, full runtime dispatch for custom 404, page-load and layout-loader failure propagation through `handleRouteRequest`, render-time page/layout component failures during full-page and partial rendering, streaming shell failure propagation, and suspense error chunks during streaming responses
- `COV-RUNTIME-002`: closed for the current server-runtime helper surface. Coverage now includes regression tests and fixes for `compress`, `sse`, `jobs`, and `ws`, covering no-body compression, status preservation, disabled encoding negotiation via `q=0`, wildcard and case-insensitive `Accept-Encoding` negotiation, large-response compression without body-stream truncation, post-close SSE sends, SSE event ordering, due-job ordering, deterministic same-timestamp job ordering, retry backoff scaling, drain behavior across retry windows, room dedupe, empty-room no-ops, broadcast resilience, close argument forwarding, and binary WebSocket payload forwarding
- `COV-RUNTIME-003`: closed for the current client-runtime surface. Coverage now includes hydration text mismatch rewrites, whitespace/comment-skipping hydration claims, malformed island props, fail-closed normalization of decoded island props that are not plain objects, missing/malformed replay hooks, fail-soft replay hooks that throw during runtime cleanup or replay, replay-script invariants, single-shot lazy-island hydration under repeated observer entries, transient island-loader retry after failure, retry after hostile module surfaces such as throwing `default` accessors, fail-safe hydration-context cleanup after island component throws, fail-safe cleanup when the top-level `hydrate()` pass itself throws, malformed JSON form responses including syntactically valid but contract-invalid non-object payloads, non-Error form submit failures, stale form-error clearing on success retries with explicit action URLs, duplicate-listener suppression for repeated router initialization on the same browser globals, correct router interception for same-path links that change query while also carrying a hash fragment, and hash-insensitive prefetch deduplication for repeated links that target the same fetch URL
- `COV-REACTIVE-001`: closed for the current reactive product surface. Coverage now includes race-contract proofs and fixes for stale resource refetch suppression, explicit `refetch()` as a new authoritative fetch, shared-key peer-resource suppression of stale in-flight completions after a newer refetch, cache-key promise dedupe, shared resource-cache synchronization after local `mutate()` updates, local `mutate()` suppression of stale in-flight fetch completions that would otherwise overwrite authoritative local state, invalidation during in-flight loads including `invalidateAll()` churn across multiple keys, invalidation-triggered stale completion suppression that no longer leaves deduped resources stuck in `loading`, repeated mixed `mutate -> refetch -> invalidate -> recreate` churn on a single shared key, multi-cycle repeated shared-key churn across sequential loops, deterministic seeded pseudo-random churn, longer deterministic soak-style churn across dozens of steps, concurrent mutation pending-state semantics across mixed success/error outcomes, stale mutation completion suppression after `reset()`, optimistic rollback protection against newer optimistic layers, and live reconnect timer suppression after close, repeated socket-close events, or stale reconnect timers that fire after a socket has already reopened
- `COV-SECURITY-001`: closed for the current security/runtime surface. Coverage now includes stronger CORS mismatch tests, proxy preset override/default tests, distributed rate-limit prefix/TTL fallback coverage, CSRF rotation/middleware safe-vs-unsafe method tests, runtime adapter coverage for Cloudflare, Vercel, Netlify, Fly, and reverse-proxy deployment shapes, explicit trust opt-in/opt-out paths, canonical `Forwarded` precedence over conflicting `X-Forwarded-*` values, chained multi-hop forwarded-header selection for reverse proxies across runtime matrix, RPC preflight, and route request enforcement layers, plus explicit multi-hop override coverage for provider presets in production runtime handlers
- `COV-CLI-001`: closed for the current product command matrix. Coverage now includes fixture-based command-path tests for `cmd-generate`, `cmd-routes`, `cmd-migrate`, `cmd-typegen`, `cmd-docs`, `cmd-check`, and `cmd-deploy`, covering empty-state output, grouped-route/typegen artifacts, routes-only docs contracts, markdown docs output, strict check warning-to-error promotion, deploy target auto-detection with init-only mode, explicit deploy target generation, usage exits, migration creation/application/error paths, explicit postgres generation, and inferred sqlite generation
- `COV-PLUGIN-001`: closed for the current shared plugin-runner contract. Coverage now includes deterministic failure-path tests for dependency cycles, missing dependencies, unknown order targets, duplicate capability normalization, lifecycle metadata, setup-vs-runtime hook ordering, setup failure propagation, build hook collision ordering, target-specific build plugin filtering, reverse-order teardown cleanup that continues across multiple teardown failures while reporting aggregated errors, and dependency-graph setup/teardown ordering across multi-plugin chains
- `COV-CONTENT-001`: closed for the current content collection/helper surface. Coverage now includes malformed frontmatter fence tests, validator error propagation, locale inference from slug, extension filtering, additional content query coverage, localized sibling entry lookups, content slug composition with i18n route helpers, hreflang generation, adversarial ignored-line frontmatter cases, and nested real-collection `.mdx` loading with default-locale fallback
- `COV-I18N-001`: closed for the current i18n helper/runtime composition surface. Coverage now includes route strategy/path helper tests, locale fallback and negotiation edge cases, lazy loader no-op coverage, formatting/hreflang assertions, content-loading cross-surface coverage, localized typed-route URL generation with query/hash preservation, product-level localized router/link navigation assertions that keep history/currentPath canonical for localized typed routes, and lazy-loaded locale switching that preserves canonical hreflang/path generation
- `COV-IMAGE-001`: closed for the current image prop-generation/runtime rendering surface. Coverage now includes remote allowlist wildcard and exact-match tests, widthless/non-optimized branches, custom loader/format coverage, candidate-width assertions, deduped width generation, stable multi-format source ordering, multi-format fallback semantics, priority image loading/decoding semantics, and placeholder/style merge behavior
- `COV-PUBLISH-001`: closed for current publish surface. `release-check` enforces packed `dist-pkg` subpath compatibility for `auth`, `forms`, `routes`, `i18n`, `content`, `deploy`, and `testing`, validates that every packed export remains a direct `.js` entry with a matching `.d.ts`, and `release-smoke`/`install-matrix` execute runtime import probes for installed tarballs. Residual operational note: release-smoke and install-matrix must not mutate the shared `dist-pkg` in parallel.

### Critical Surface Suite

- `COV-GATE-001`: closed for the current critical surface suite. `critical:surface` and `test:critical-surface` now enforce the highest-risk regression path across `Accept-Encoding` compression semantics, router navigation regressions, hydration cleanup, MCP default limit behavior, proxy/request security preflight, reactive race contracts, and packed install/release surface contracts before broader release verification proceeds

## Priority Order

1. runtime/security/deploy regressions that can change production behavior silently
2. built artifact and publish/install regressions that break shipping paths
3. hydration/reactive correctness gaps that produce subtle client/runtime drift
4. CLI/productivity commands whose failures damage adoption or migration
5. ecosystem/domain surfaces such as plugins, content, i18n, and image helpers

## Required Rules

- every new product surface must land with tests or with a new `COV-*` gap entry in this document
- removing a gap requires adding the relevant automated proof in `tests/`, `scripts/`, browser smoke, or release smoke
- if docs or support claims expand, this audit must be updated in the same task
- policy scripts may treat missing audit maintenance as a repo-level failure

## Canonical Enforcement Surface

The audit is enforced through:

- `bun run critical:surface`
- `bun run test:critical-surface`
- `bun run coverage:audit`
- `tests/cli/coverage-audit.test.ts`
- `tests/cli/critical-surface.test.ts`
- `scripts/critical-surface-check.mjs`
- `scripts/coverage-audit-check.mjs`
- `docs/CI_POLICY.md`
- `docs/SUPPORT_MATRIX.md`

## Completion Standard

A surface should be treated as “closed” only when:

- tests exist for happy-path and hostile-path behavior
- built/runtime/provider paths are exercised when the surface ships there
- docs and support claims match the verified behavior
- no remaining `COV-*` entry is needed for the same contract
