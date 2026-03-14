# AI Surface Stability

This document defines stable versus evolving AI-facing sub-surfaces for Gorsee as a mature product.

Machine-readable companion for local editor/tool integration: `docs/AI_INTEGRATION_CONTRACT.json`

Third-party editor guidance: `docs/THIRD_PARTY_EDITOR_INTEGRATIONS.md`

## Stable Surfaces

- `gorsee ai init`
- `gorsee ai ide-sync`
- `gorsee ai mcp`
- `gorsee ai pack`
- `gorsee ai checkpoint`
- `.gorsee/ide/diagnostics.json`
- `.gorsee/ide/events.json`
- `.gorsee/ide/context.md`
- `.gorsee/agent/latest.json`
- `.gorsee/agent/latest.md`
- `.gorsee/agent/release-brief.json`
- `.gorsee/agent/release-brief.md`
- `.gorsee/agent/incident-brief.json`
- `.gorsee/agent/incident-brief.md`
- `.gorsee/agent/deploy-summary.json`
- `.gorsee/agent/deploy-summary.md`
- `.gorsee/agent/incident-snapshot.json`
- `.gorsee/agent/incident-snapshot.md`
- `.gorsee/agent/checkpoints/*.json`
- `.gorsee/agent/checkpoints/*.md`
- `.gorsee/agent/checkpoints/*.meta.json`
- `.gorsee/agent/checkpoints/latest.json`
- `GORSEE_AI_CONTEXT_SCHEMA_VERSION`
- `docs/THIRD_PARTY_EDITOR_INTEGRATIONS.md`

## Evolving Surfaces

- bridge payload selection and optional headers
- doctor/export presentation details
- artifact regression grouping heuristics
- future AI-facing example apps and editor integrations

## Rule

Stable surfaces require docs, tests, and release awareness. Evolving surfaces can improve, but they still must not drift silently.
