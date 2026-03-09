# Canonical Recipes

This document defines the recommended production paths for common Gorsee application classes.

Gorsee is a mature product. Teams should not need to invent their own baseline architecture for common workloads.

## Recipe 1: Secure SaaS App

Recommended when the application has:

- authenticated users
- dashboards and settings pages
- personalized responses
- forms, mutations, and server-side business logic

Use this path:

- `gorsee/client` for route components, forms, islands, and reactive primitives
- prefer route module grammar built around `load`, `action`, `cache`, and `middleware`
- `Image()` with explicit remote allowlists and generated `srcset` when media is part of the route payload
- `gorsee/forms` for `defineForm()` and `useFormAction()` when building structured form flows
- `gorsee/routes` for route contracts and query construction, and pass route objects directly to `Link` where possible
- `gorsee/server` for `load`, `action`, middleware, cache, request policy, and route execution
- `gorsee/auth` for auth and session stores
- `gorsee/security` for origin, CSRF, CORS, and rate-limit policy
- `gorsee/env` and `gorsee/log` for explicit runtime configuration and structured logging
- `createAuth()` with a persistent session store
- `createAuthActionTokenManager()` for password reset, email verification, and magic-link style workflows
- `routeCache({ maxAge, mode: "private" })` for personalized document responses
- `createRedisRateLimiter()` when the app runs on multiple instances
- `security.rpc.middlewares` for RPC auth/CSRF enforcement
- explicit `security.origin` in `app.config.ts`

Recommended stores:

- SQLite for single-node deployments
- Postgres when application data must live outside a single node
- Redis for multi-instance session/cache/rate-limit coordination

Do not:

- treat route `_middleware.ts` as implicit RPC protection
- disable auth-aware cache variance for personalized pages
- rely on floating proxy/origin assumptions in production

## Recipe 2: Content / Marketing Site

Recommended when the application has:

- mostly public pages
- mostly read-only content
- strong SEO / caching needs
- optional islands for small interactive regions

Use this path:

- prefer `load` for route-bound data reads and raw method handlers only for transport-level endpoints
- prerender public pages when possible
- use islands selectively for interactive fragments
- use locale-aware content collections and explicit locale-prefixed routes when the site ships in multiple languages
- use `buildHreflangLinks()` and locale negotiation helpers instead of ad hoc language switching
- prefer `routeCache({ maxAge, mode: "public", includeAuthHeaders: false })` only for intentionally public responses
- keep RPC minimal or avoid it entirely if plain routes are enough
- keep `security.origin` explicit and deploy cache assumptions documented

Do not:

- mix personalized and public responses behind the same public cache policy
- hydrate large page regions when small islands are enough

## Recipe 3: Agent-Aware Internal Tool

Recommended when the application has:

- operational dashboards
- admin workflows
- heavy AI-assisted maintenance/debugging
- strong need for diagnostics and reproducible incident context

Use this path:

- enable `ai.enabled`
- keep route data reads on `load` so incident and AI diagnostics describe one canonical read path
- keep `.gorsee/ai-events.jsonl` and `.gorsee/ai-diagnostics.json` as canonical local artifacts
- use `gorsee ai doctor`, `gorsee ai export --bundle`, and `gorsee ai ide-sync`
- use `defineJob()` plus an app-owned queue policy for background sync, ingest, and incident fan-out
- keep runtime/auth/cache behavior explicit so agent summaries match reality

Do not:

- build agent workflows on scraped console output
- treat AI observability as optional once the tool depends on agent assistance

## Recipe 4: Workspace / Monorepo App

Recommended when the application has:

- shared packages
- multiple applications
- shared UI, domain, or config modules

Use this path:

- keep app entrypoints on `gorsee/client` and `gorsee/server`
- keep route contracts on `gorsee/routes` and forms on `gorsee/forms` when those concerns are shared inside the app package
- keep `load` and `action` in app-owned route modules instead of hiding business flow behind generic shared wrappers
- keep shared workspace packages framework-agnostic where possible
- let the app own `app.config.ts`, deploy config, auth policy, and route middleware
- run `gorsee check`, `typegen`, `docs`, and `build` from the app package

Do not:

- hide app runtime policy inside generic shared packages
- depend on root `gorsee` in new workspace code

## Product Rule

When introducing a new official pattern, update this document and keep the number of canonical paths small.

Gorsee should converge teams on a few strong product-grade recipes, not expand into many competing defaults.

Use these supporting docs together with the recipes:

- `docs/STARTER_ONBOARDING.md`
- `docs/AUTH_CACHE_DATA_PATHS.md`
- `docs/RECIPE_BOUNDARIES.md`
- `docs/WORKSPACE_ADOPTION.md`
