# First Production Rollout

This document defines the first-production rollout checklist for Gorsee as a mature product.

## Before Rollout

1. confirm app class and recipe
2. confirm the nearest proof catalog surface in `proof/proof-catalog.json`
3. compare against `examples/secure-saas`, `examples/content-site`, or `benchmarks/realworld` when the app shape is similar
4. set explicit `security.origin`
5. verify auth/cache/data path choices
6. run `bun run check`
7. run app build and deploy generation
8. validate placeholder origin replacement
9. run runtime/AI diagnostics workflows if the team depends on them

## During Rollout

- prefer explicit canary or staged validation for security/runtime changes
- monitor route/document/partial semantics
- keep `.gorsee/ai-events.jsonl` and session packs available if AI workflows are enabled
- keep the proof catalog and benchmark assumptions visible during rollout reviews

## After Rollout

- run post-rollout smoke flows
- inspect diagnostics, bridge/MCP/IDE projections where used
- capture repeated friction and convert it into docs or policy rather than local folklore
