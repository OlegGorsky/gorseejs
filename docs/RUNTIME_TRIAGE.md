# Runtime Triage

This document is the operator-facing runtime triage guide for Gorsee as a mature product.

Machine-readable companion: `docs/DIAGNOSTICS_CONTRACT.json`

## First Pass

When production/runtime behavior drifts, check in this order:

1. `bun run check`
2. `bun run build`
3. `dist/manifest.json`
4. `dist/release.json`
5. generated deploy artifacts
6. `.gorsee/ai-events.jsonl`
7. `.gorsee/agent/latest.json`
8. `.gorsee/agent/incident-brief.json`
9. `.gorsee/agent/incident-snapshot.json`
10. `.gorsee/ide/context.md`

When reading AI artifacts, verify that the recorded app context matches the real deployment shape:

- `app.mode`
- `runtime.topology`
- `AI app context`

## Triage Questions

Ask these questions first:

- is the failure document, partial, RPC, or raw route-handler shaped?
- is trusted origin configured correctly for the real environment?
- are forwarded headers being trusted only behind a real proxy hop?
- is the response accidentally cached when it should be `no-store`?
- did a route bundle or prerender artifact disappear?
- does `dist/release.json` describe the same runtime class and artifact set that the deployment actually uses?
- does the AI artifact say `frontend`, `fullstack`, or `server`, and is that actually the deployed shape?

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
