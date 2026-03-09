# Runtime Triage

This document is the operator-facing runtime triage guide for Gorsee as a mature product.

## First Pass

When production/runtime behavior drifts, check in this order:

1. `bun run check`
2. `bun run build`
3. `dist/manifest.json`
4. generated deploy artifacts
5. `.gorsee/ai-events.jsonl`
6. `.gorsee/agent/latest.json`
7. `.gorsee/ide/context.md`

## Triage Questions

Ask these questions first:

- is the failure document, partial, RPC, or raw route-handler shaped?
- is trusted origin configured correctly for the real environment?
- are forwarded headers being trusted only behind a real proxy hop?
- is the response accidentally cached when it should be `no-store`?
- did a route bundle or prerender artifact disappear?

## Recommended Commands

- `bun run check`
- `bun run test:confidence`
- `bunx gorsee ai doctor`
- `bunx gorsee ai export --bundle --format markdown`
- `bun run release:smoke`

## Escalation Points

Escalate immediately when any of the following are true:

- production runtime cannot resolve a trusted origin
- route/document/partial semantics diverge between dev and prod
- placeholder origins remain in deploy artifacts
- canonical examples or scaffolded release smoke fail to build
- AI artifacts stop carrying enough failure context for an agent to diagnose the incident
