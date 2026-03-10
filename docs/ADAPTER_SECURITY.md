# Adapter Security Assumptions

This document defines the deploy-time security assumptions for Gorsee adapters.

These adapters are part of the framework attack surface and part of the shipped product contract.

Machine-readable companion: `docs/RUNTIME_SECURITY_CONTRACT.json`

Deploy contract companion: `docs/DEPLOY_CONTRACT.json`

## Shared Rules

- `APP_ORIGIN` must be set to the canonical production origin before public traffic.
- Internal RPC execution must keep explicit `rpcPolicy` wiring.
- Immutable client assets under `/_gorsee/*` must retain long-lived cache headers.
- Runtime host/proto derivation must not rely on platform defaults alone.
- Placeholder origins such as `REPLACE_WITH_APP_ORIGIN` or `https://example.com` must never ship to production.

## Vercel

Security assumptions:

- `vercel.json` must route `/_gorsee/*` with immutable cache headers.
- the generated serverless entry must reference `APP_ORIGIN`
- the generated serverless entry must keep `handleRPCRequestWithPolicy()`

Residual responsibility:

- wiring the final production request handler
- configuring `APP_ORIGIN` in the Vercel project environment
- applying app-level RPC/auth/CSRF middleware policy

## Cloudflare

Security assumptions:

- `wrangler.toml` must declare `APP_ORIGIN`
- `compatibility_flags = ["nodejs_compat"]` stays enabled for the generated worker contract
- `_routes.json` must exclude `/_gorsee/*` from edge routing
- the worker entry must forward explicit `rpcPolicy`

Residual responsibility:

- configuring zone/route ownership
- securing any additional Worker bindings or KV access
- not exposing extra internal fetch surfaces via custom worker code

## Netlify

Security assumptions:

- `netlify.toml` must declare `APP_ORIGIN`
- immutable cache headers for `/_gorsee/*` must remain intact
- the edge function must forward explicit `rpcPolicy`

Residual responsibility:

- configuring production origin and edge deployment settings
- ensuring custom Netlify redirects do not bypass the generated edge handler semantics

## Fly.io

Security assumptions:

- `fly.toml` must declare `APP_ORIGIN`
- generated `Dockerfile` must preserve `bun install --frozen-lockfile`
- generated `Dockerfile` must export `APP_ORIGIN`

Residual responsibility:

- final TLS/domain setup
- machine/autoscaling policy
- external reverse proxy assumptions ahead of Fly

## Docker

Security assumptions:

- generated `Dockerfile` must preserve `bun install --frozen-lockfile`
- generated `Dockerfile` must export `APP_ORIGIN`

Residual responsibility:

- ingress proxy configuration
- TLS termination
- container runtime hardening
- secret injection

## What The Framework Guarantees

- generated adapter files preserve the canonical origin contract
- generated adapter files preserve the canonical-origin contract
- generated adapter files preserve immutable asset cache semantics
- generated adapter files preserve explicit RPC policy wiring where applicable
- provider runtime matrix tests verify proxy/origin behavior through the production handler for representative presets
- install matrix checks verify both source-linked and packed-tarball sample apps can scaffold, install, check, typegen, document, and build successfully
- release smoke and CLI deploy validation enforce these assumptions
- deploy outputs are expected to meet mature product standards, not demo-only expectations

## What The Framework Does Not Guarantee

- provider account configuration
- DNS/TLS correctness
- WAF/CDN policy
- custom edge logic the application adds outside generated adapter code
