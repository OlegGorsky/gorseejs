# Application Modes

This document defines the canonical application modes for Gorsee.

Gorsee is one application platform with three first-class modes. These are not three separate products.

## Canonical Modes

### `frontend`

Use `frontend` for browser-first prerendered apps when Gorsee should own the UI/runtime shape but not a long-lived process runtime.

Canonical properties:

- browser-safe code paths
- prerendered page routes
- static-capable deploy targets
- no mandatory process runtime entrypoint

Use this mode for:

- marketing and content sites
- browser-first dashboards backed by an external API
- static or prerendered product surfaces

### `fullstack`

Use `fullstack` for the canonical Gorsee app model where UI, route grammar, server logic, security policy, and deploy/runtime contracts live together.

Canonical properties:

- `gorsee/client` + `gorsee/server`
- page routes plus API surfaces
- route `load` / `action` / `middleware` / cache contracts
- Bun or Node process runtime, plus supported fetch/adapter targets

Use this mode for:

- SaaS products
- internal tools
- content + authenticated application hybrids
- apps where the same repo owns UI and server execution

### `server`

Use `server` for API-first and service-oriented systems where browser surfaces are optional or absent.

Canonical properties:

- server-first runtime ownership
- process/runtime contracts stay explicit
- no mandatory client bundle generation
- fits API services, background execution, and service-oriented systems

Use this mode for:

- JSON or RPC APIs
- internal services
- control-plane backends
- worker-oriented or service-oriented applications

Canonical starter paths:

- `bunx gorsee create my-app --template frontend`
- `bunx gorsee create my-app --template server-api`
- `bunx gorsee create my-app --template worker-service`

Canonical repository proof surfaces:

- `examples/frontend-app`
- `examples/secure-saas`
- `examples/content-site`
- `examples/agent-aware-ops`
- `examples/workspace-monorepo`
- `examples/server-api`

## Mode Contract

Set the mode explicitly in `app.config.ts`:

```ts
export default {
  app: {
    mode: "fullstack",
  },
}
```

`fullstack` is the default when `app.mode` is omitted, but mature applications should keep the mode explicit so CLI checks, deploy generation, upgrade reports, and AI context all agree on the intended product shape.

## Mode Boundaries

- `gorsee/client` is the canonical browser-safe surface.
- `gorsee/server` is the canonical server/runtime surface.
- root `gorsee` remains compatibility-only for new code.
- `frontend` should not silently grow server-runtime assumptions.
- `server` should not silently grow browser/UI assumptions.
- `fullstack` is the canonical composition of client + server, not a separate ad-hoc runtime.

## Operational Consequences

- `gorsee check` validates import and route drift against the declared mode.
- `gorsee build` emits different artifacts depending on the mode.
- `gorsee start` is valid only when the mode produces a process runtime.
- `gorsee worker` is the canonical Bun-first CLI entry for long-running `server`-mode worker and service processes.
- `gorsee deploy` must respect mode-compatible targets and runtime profiles.
- `gorsee ai framework` and `gorsee upgrade` include the current mode in machine-readable artifacts.

## Canonical Progression

Recommended progression is additive, not divergent:

1. start with `frontend` when the product is browser-first
2. move to `fullstack` when Gorsee should own route/server execution too
3. use `server` when the application is service-first and browser surfaces are no longer the center of the product

Do not mix multiple product shapes accidentally. Switch the mode explicitly when the architecture changes.
