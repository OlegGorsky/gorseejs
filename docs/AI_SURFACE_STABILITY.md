# AI Surface Stability

This document defines stable versus evolving AI-facing sub-surfaces for Gorsee as a mature product.

## Stable Surfaces

- `gorsee ai ide-sync`
- `gorsee ai mcp`
- `gorsee ai pack`
- `.gorsee/ide/diagnostics.json`
- `.gorsee/ide/events.json`
- `.gorsee/ide/context.md`
- `.gorsee/agent/latest.json`
- `.gorsee/agent/latest.md`
- `GORSEE_AI_CONTEXT_SCHEMA_VERSION`

## Evolving Surfaces

- bridge payload selection and optional headers
- doctor/export presentation details
- artifact regression grouping heuristics
- future AI-facing example apps and editor integrations

## Rule

Stable surfaces require docs, tests, and release awareness. Evolving surfaces can improve, but they still must not drift silently.
