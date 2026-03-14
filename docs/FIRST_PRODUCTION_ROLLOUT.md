# First Production Rollout

This document defines the first-production rollout checklist for Gorsee as a mature product.

## Before Rollout

1. confirm app class and recipe
2. confirm the nearest proof catalog surface in `proof/proof-catalog.json`
3. confirm the mapped app-shape entry in `docs/ADOPTION_PROOF_MANIFEST.json`
4. compare against `examples/frontend-app`, `examples/secure-saas`, `examples/content-site`, `examples/agent-aware-ops`, `examples/plugin-stack`, `examples/workspace-monorepo`, `examples/server-api`, or `benchmarks/realworld` when the app shape is similar
5. set explicit `security.origin`
6. verify auth/cache/data path choices
7. run `bun run check`
8. run app build and deploy generation
9. validate placeholder origin replacement
10. run runtime/AI diagnostics workflows if the team depends on them
11. keep `docs/DEPLOY_CONTRACT.json` visible if rollout risk depends on provider/runtime profile assumptions

## During Rollout

- prefer explicit canary or staged validation for security/runtime changes
- monitor route/document/partial semantics
- keep `.gorsee/ai-events.jsonl` and session packs available if AI workflows are enabled
- keep the proof catalog and benchmark assumptions visible during rollout reviews
- keep `docs/ADOPTION_PROOF_MANIFEST.json` visible during rollout review when comparing app shape and migration posture
- if the rollout later becomes a public reference, intake it through `docs/EXTERNAL_PROOF_INTAKE.md` and `docs/EXTERNAL_PROOF_REGISTRY.json`

## After Rollout

- run post-rollout smoke flows
- inspect diagnostics, bridge/MCP/IDE projections where used
- capture repeated friction and convert it into docs or policy rather than local folklore
