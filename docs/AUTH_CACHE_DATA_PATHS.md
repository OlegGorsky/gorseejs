# Auth / Cache / Data Paths

This document defines the recommended auth, cache, and data choices for Gorsee app classes as a mature product.

## Secure SaaS App

- auth: `createAuth()` with persistent session store
- auth workflows: signed `magic-link`, `password-reset`, and `email-verification` tokens through `createAuthActionTokenManager()`
- cache: `routeCache({ mode: "private" })`
- data: SQLite for single-node, Postgres for networked SQL ownership, Redis-backed session/cache/rate-limit for multi-instance
- jobs: `createMemoryJobQueue()` for single-node, `createRedisJobQueue()` for multi-instance/durable background work with Redis-backed scheduling and lease renewal
- topology: declare `runtime.topology = "multi-instance"` when replicas share traffic; production then requires `security.rateLimit.limiter`

## Content / Marketing Site

- auth: usually none or limited admin-only auth outside the public path
- cache: `routeCache({ mode: "public", includeAuthHeaders: false })` only for intentionally public pages
- data: static content, CMS fetches, or read-mostly DB access with explicit public/private separation

## Agent-Aware Internal Tool

- auth: explicit operator/session model, usually mandatory
- cache: prefer correctness and `private` or `no-store` over speculative hit rate
- data: operational tables, dashboards, diagnostics artifacts, and queued background work kept explicit and inspectable
- observability: keep local `.gorsee/*` artifacts for node-local triage and add `ai.bridge.url` when incidents must be aggregated across a fleet

## Workspace / Monorepo App

- auth: app-owned, not hidden in shared packages
- cache: app-owned route policy
- data: shared domain packages are acceptable, but runtime ownership stays in the app package
