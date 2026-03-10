# Canonical Examples

These examples are the public, product-grade reference apps for Gorsee as a mature product.

They are not throwaway demos. They exist to show the recommended architecture for the most important application classes.

Current examples:

- `examples/frontend-app` — canonical `frontend` app with browser-safe routes and prerender-only deployment assumptions
- `examples/secure-saas` — canonical `fullstack` SaaS app with protected routes, private cache, and RPC policy
- `examples/content-site` — canonical `fullstack` public content app with prerendering and public cache semantics
- `examples/agent-aware-ops` — canonical `fullstack` operator-facing app with AI observability enabled
- `examples/workspace-monorepo` — canonical `fullstack` workspace reference with one app package and one shared package
- `examples/server-api` — canonical `server` app with API-first routes, explicit runtime topology, and service-oriented execution

Mode-specific scaffolds such as `worker-service` also ship through `gorsee create`.

Proof catalog:

- `proof/proof-catalog.json`
- `benchmarks/realworld` as the canonical reference-app proof surface alongside the example apps

Use these together with:

- `docs/CANONICAL_RECIPES.md`
- `docs/SECURITY_MODEL.md`
- `docs/AI_ARTIFACT_CONTRACT.md`
- `docs/MARKET_READY_PROOF.md`
