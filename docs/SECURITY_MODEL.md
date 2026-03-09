# Security Model

Gorsee is a mature product-grade framework. This document defines shipped security invariants, not aspirational guidance for an experimental codebase.

## Scope

This document defines the security assumptions and framework guarantees Gorsee aims to preserve.

The goal is not best-effort hardening. The goal is stable framework invariants for AI-first, deterministic full-stack execution.

## Threat Model

Primary framework threat classes:

- auth bypass
- origin confusion
- cache poisoning
- SSRF
- deserialization abuse
- source exposure
- dev-server abuse
- path traversal / path normalization bypass

## Core Invariants

### Request Execution Order

For route execution the intended order is:

1. request metadata normalization
2. request security policy validation
3. middleware chain
4. guard execution inside the same chain
5. load / action / route handler / page render

Hidden alternate paths that bypass this order are treated as framework bugs.

### Endpoint Classes

Gorsee models these endpoint kinds explicitly:

- `page`
- `partial`
- `action`
- `route-handler`
- `rpc`
- `static`

Internal behavior must not rely on client-supplied internal headers without an explicit contract.

### Canonical Origin

Production is expected to run with a canonical application origin.

Origin-sensitive behavior includes:

- redirects
- state-changing requests
- internal endpoints
- dev/HMR upgrade checks

Preferred source of truth: `security.origin` in `app.config.ts`.
Runtime fallback: `APP_ORIGIN`.

### Proxy / Forwarded Headers

Forwarded headers are not trusted unless explicitly enabled.

If proxy trust is enabled, forwarded metadata may affect effective host/proto, but host allowlist enforcement remains a separate explicit policy.

Trusted proxy depth must also be explicit. Gorsee only trusts the configured number of hops from the end of the `Forwarded` / `X-Forwarded-*` chain.

Provider presets may enable safe defaults for forwarded trust:

- `vercel`
- `netlify`
- `fly`
- `reverse-proxy`

`cloudflare` keeps forwarded trust disabled by default.

### Redirect Safety

All redirect flows should use centralized sanitation.

Unsafe pattern:

- using user-controlled absolute URLs directly

Expected safe model:

- relative targets by default
- canonical-origin-aware sanitation for absolute targets

### Cache Model

The framework direction is private/auth-aware defaults.

Public/shared caching of personalized responses is considered a dangerous misuse class.

Expected cache invariants:

- `routeCache()` defaults to `mode: "private"`
- response identity always splits on `Accept` and `X-Gorsee-Navigate`
- `public` / `shared` caching must be opt-in
- `no-store` must stay fail-closed

### RPC Boundary

Gorsee does not implement React Server Components, Flight protocol, or Server Actions transport.

That removes a major 2025-2026 risk class, but RPC remains a critical boundary.

Expected RPC invariants:

- POST-only
- explicit auth/CSRF middleware policy
- request and response size limits
- explicit content-type rules
- versioned RPC envelope over `application/vnd.gorsee-rpc+json`

RPC is a separate boundary from route `_middleware.ts`.

### Dev Server

Dev server is treated as a real attack surface.

Expected protections:

- HMR origin checks
- safe file boundaries
- no implicit trust of cross-origin input on internal dev channels

### Static / Assets

Static serving must use normalized path containment.

Public assets and internal build artifacts should remain logically separate.

If remote asset fetching or image optimization is added later, it must be treated as SSRF-prone by default.

## Adapter Assumptions

Deploy adapters are part of the framework boundary, not post-processing glue.

Provider-specific assumptions are documented in [`ADAPTER_SECURITY.md`](./ADAPTER_SECURITY.md).

The framework intends to preserve these adapter invariants:

- canonical origin contract
- immutable client asset cache contract
- explicit RPC policy wiring where the adapter exposes server execution

## Framework Guarantees

Current intended guarantees:

- route middleware and guard participate in real runtime execution
- production requires canonical origin
- internal endpoint behavior is not purely header-trusted
- partial responses use a stricter contract than full document responses
- RPC can be protected through explicit middleware policy
- security-sensitive behavior is documented as part of the product contract and must remain aligned with shipped code

## Application Responsibilities

The framework does not automatically solve:

- business authorization logic
- outbound network policy for arbitrary app fetches
- secret storage/rotation
- deploy platform misconfiguration
- unsafe redirect/URL logic in app code

## Product Standard

Security regressions in Gorsee are product regressions.

Changes that weaken these invariants must be treated as release-blocking issues unless explicitly approved as a major product decision.
