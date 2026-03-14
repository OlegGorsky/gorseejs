# Market-Ready Proof

This document defines the canonical proof surfaces Gorsee uses when claiming top-tier framework maturity.

Gorsee is a mature product. Proof therefore means shipped, inspectable, repeatable surfaces rather than marketing adjectives.

Canonical proof surfaces must stay clean and reproducible inside the repository itself: no committed install directories, generated build output, transient `.gorsee*` artifacts, or local benchmark/example databases.

## Canonical Proof Catalog

The canonical machine-readable catalog is:

- `proof/proof-catalog.json`
- `docs/ADOPTION_PROOF_MANIFEST.json`
- `docs/EXTERNAL_PROOF_REGISTRY.json` for accepted public external evidence once it exists

It currently anchors these proof surfaces:

- `examples/frontend-app` for browser-first frontend-mode adoption
- `examples/secure-saas` for authenticated full SaaS flows
- `examples/content-site` for docs/content and marketing flows
- `examples/agent-aware-ops` for internal operations and AI-observability workflows
- `examples/plugin-stack` for deterministic plugin composition and extension-surface adoption
- `benchmarks/realworld` for full-stack reference-app proof-of-shape
- `examples/workspace-monorepo` for workspace and multi-package adoption
- `examples/server-api` for API-first server-mode adoption

## What Each Surface Proves

### `examples/frontend-app`

Proves:

- frontend-mode route and build shape
- browser-safe imports and prerender-only execution
- static/CDN-oriented deployment posture without process runtime expectations

### `examples/secure-saas`

Proves:

- protected route groups
- auth middleware placement
- private cache semantics
- RPC policy baseline for application teams
- typed route navigation inside a protected app shell
- validated billing-form mutations with progressive enhancement
- protected RPC refresh inside the dashboard shell
- team invite governance, role policy, and access-window validation in a second protected mutation surface
- small reactive islands coexisting with server-rendered protected workflows

### `examples/content-site`

Proves:

- public content route structure
- prerender and cache boundaries
- marketing/docs-friendly page composition

### `examples/agent-aware-ops`

Proves:

- AI diagnostics-first operation model
- IDE sync, bridge, MCP, and session-pack workflows inside a real app shape
- operator-facing incident debugging baseline

### `examples/plugin-stack`

Proves:

- deterministic plugin registration and dependency ordering
- stable `gorsee/plugins` entrypoint adoption instead of compatibility imports
- extension-surface proof inside a real fullstack app shape

### `benchmarks/realworld`

Proves:

- reference-app full-stack shape
- auth, forms, mutations, and content flows together
- realistic benchmark artifact discipline

It does not prove universal production parity by itself.

### `examples/workspace-monorepo`

Proves:

- workspace onboarding
- shared package boundaries
- deterministic app/runtime ownership in monorepos

### `examples/server-api`

Proves:

- server-mode route and build shape
- API-first execution without page/UI routes
- explicit service/runtime ownership for process deployments

## Product Rule

If a public claim about Gorsee maturity, adoption, or production readiness cannot be traced back to:

- a canonical example
- a benchmark proof surface
- a rollout/adoption document
- or `proof/proof-catalog.json`

then the claim is incomplete.

## What Internal Proof Does Not Replace

Repository-local proof is necessary, but it is not the same thing as broad market proof.

These proof surfaces validate:

- canonical app shapes
- runtime and product contracts
- migration and rollout guidance grounded in shipped examples

They do not replace:

- external production references
- third-party adoption evidence
- broader ecosystem integration reach
- comparative market validation against the largest framework products

Those concerns are tracked as deliberate post-exit product evolution in `docs/TOP_TIER_COMPETITION_PLAN.md`.
They enter the canonical system through `docs/EXTERNAL_PROOF_CLAIMS.json`, `docs/EXTERNAL_PROOF_INTAKE.md`, `docs/EXTERNAL_PROOF_EXECUTION.md`, `docs/EXTERNAL_PROOF_OUTREACH.json`, and `docs/EXTERNAL_PROOF_REGISTRY.json`.
