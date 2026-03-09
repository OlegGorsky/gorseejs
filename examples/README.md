# Canonical Examples

These examples are the public, product-grade reference apps for Gorsee as a mature product.

They are not throwaway demos. They exist to show the recommended architecture for the most important application classes.

Current examples:

- `examples/secure-saas` — authenticated dashboard app with protected routes, private cache, and RPC policy
- `examples/content-site` — public content app with prerendering, islands-friendly pages, and public cache semantics
- `examples/agent-aware-ops` — operator-facing app with AI observability enabled and stable IDE/MCP/session-pack workflows
- `examples/workspace-monorepo` — public workspace reference with one app package and one shared package

Proof catalog:

- `proof/proof-catalog.json`
- `benchmarks/realworld` as the canonical reference-app proof surface alongside the example apps

Use these together with:

- `docs/CANONICAL_RECIPES.md`
- `docs/SECURITY_MODEL.md`
- `docs/AI_ARTIFACT_CONTRACT.md`
- `docs/MARKET_READY_PROOF.md`
