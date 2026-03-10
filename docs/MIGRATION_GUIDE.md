# Migration Guide

This document defines compatibility and root-entrypoint cleanup guidance for Gorsee as a mature product.

## Entry Point Migration

New code should prefer:

- `gorsee/client`
- `gorsee/server`
- `gorsee/forms` for form contracts
- `gorsee/routes` for route contracts
- scoped stable subpaths such as `gorsee/auth`, `gorsee/db`, `gorsee/security`, `gorsee/env`, and `gorsee/log` for domain-specific concerns

Compatibility-only paths:

- root `gorsee`
- `gorsee/compat`

## Migration Steps

1. replace browser-safe imports with `gorsee/client`
2. replace route/form helper imports with `gorsee/routes` and `gorsee/forms`
3. replace domain imports from `gorsee/server` with scoped subpaths such as `gorsee/auth`, `gorsee/db`, `gorsee/security`, `gorsee/env`, and `gorsee/log`
4. keep root `gorsee` only where explicit compatibility semantics are still required
5. run `gorsee upgrade` to update the installed framework, rewrite obvious scoped-import drift and `loader -> load` aliases, and emit `docs/upgrade-report.json`
6. resolve migration audit entries such as `UG008`, `UG009`, `UG010`, and `UG011`
7. rerun `gorsee check`, `typegen`, and app builds

## Canonical Import Mapping

- `gorsee` -> `gorsee/client`, `gorsee/server`, or `gorsee/compat` depending on intent
- `gorsee/client` route helpers -> `gorsee/routes`
- `gorsee/client` form helpers -> `gorsee/forms`
- `gorsee/server` auth/session APIs -> `gorsee/auth`
- `gorsee/server` database APIs -> `gorsee/db`
- `gorsee/server` security APIs -> `gorsee/security`
- `gorsee/server` env APIs -> `gorsee/env`
- `gorsee/server` logging APIs -> `gorsee/log`

## Upgrade Audit Signals

- `UG008`: root `gorsee` is still used in application code
- `UG009`: domain APIs still come from `gorsee/server` instead of scoped stable subpaths
- `UG010`: forms/routes helpers still come from `gorsee/client` instead of `gorsee/forms` or `gorsee/routes`
- `UG011`: route module still exports `loader` instead of canonical `load`

## Framework Mapping

### Next.js

- `app/` route modules map to `routes/`
- page-bound mutations should converge on route `action`
- image/content/auth/cache choices should become explicit framework contracts instead of plugin folklore

### Remix

- `load` / `action` stay close conceptually, but Gorsee keeps route, cache, and security assumptions more explicit
- prefer `defineFormAction()` plus `gorsee/forms` contracts for structured form mutations

### Astro

- content-heavy routes map well to `examples/content-site`
- islands stay explicit rather than hidden behind broad component-compatibility layers

### Nuxt

- server/runtime boundaries should move to `gorsee/server`, with route reads on `load` and page mutations on `action`
- browser-safe compositional code should move to `gorsee/client`

## Migration Proof Surface

Use these when validating migration intent:

- `examples/frontend-app`
- `examples/secure-saas`
- `examples/content-site`
- `examples/agent-aware-ops`
- `benchmarks/realworld`
- `examples/workspace-monorepo`
- `examples/server-api`
- `proof/proof-catalog.json`
- `docs/ADOPTION_PROOF_MANIFEST.json`

## Migration Rule

Migration is a mature product workflow. It should reduce ambiguity, not create parallel patterns.
