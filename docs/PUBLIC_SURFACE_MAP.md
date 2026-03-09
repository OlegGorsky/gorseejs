# Public Surface Map

This document defines the canonical import map for Gorsee product surfaces.

The goal is to keep imports deterministic for humans, coding agents, and framework tooling.

## Canonical Entry Points

### `gorsee/client`

Use for browser-safe code:

- signals, stores, resources, mutations
- client router and navigation helpers
- islands, head, link, image
- browser-side `createEventSource`

Use dedicated subpaths when the concern is already clearly scoped:

- `gorsee/forms` for form contracts and client form submission state
- `gorsee/routes` for route contracts, typed navigation, and route objects that can be passed directly to `Link`

Some re-exports remain on `gorsee/client` for compatibility, but new guidance should treat `gorsee/forms` and `gorsee/routes` as the primary domain surfaces.

### `gorsee/server`

Use for server runtime execution primitives:

- middleware and context
- `load`, actions, RPC, SSE streams, WS, cache, guards, request policy
- route/page/partial response orchestration

`gorsee/server` remains stable, but new code should not treat it as the catch-all import for every non-browser concern.

Some domain exports still remain reachable through `gorsee/server` for compatibility. Prefer the scoped subpath when auth, db, security, env, log, AI, i18n, or content is the primary concern.

### Specialized Stable Subpaths

Prefer the dedicated stable subpath when the concern is clearly scoped:

- `gorsee/auth` for auth and session stores
- `gorsee/db` for database and migrations
- `gorsee/security` for CORS, CSRF, headers, and rate limiting
- `gorsee/ai` for AI artifacts, MCP, bridge, IDE sync, and diagnostics
- `gorsee/forms` for form contracts, validation, and client-side form action state
- `gorsee/routes` for route contracts, params, search construction, and typed navigation
- `gorsee/i18n` for locale helpers and formatting contracts
- `gorsee/content` for content collections and querying
- `gorsee/env` for environment loading and public env access
- `gorsee/log` for structured framework logging
- `gorsee/testing` for public testing helpers

## Compatibility Entry Points

### `gorsee`

Compatibility-only root barrel.

Do not use in new product code.

### `gorsee/compat`

Explicit compatibility entrypoint for legacy migration semantics.

Use only when the import itself is intentionally marked as compatibility-bound.

## Product Rule

If a new feature can live on a dedicated stable subpath, prefer that over expanding compatibility or catch-all barrels.
