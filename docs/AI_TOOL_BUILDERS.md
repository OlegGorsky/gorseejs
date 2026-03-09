# AI Tool Builders

This document defines guidance for external tool builders consuming Gorsee AI artifacts as a mature product.

## Preferred Inputs

External tools should prefer these inputs in order:

1. `.gorsee/agent/latest.json`
2. `.gorsee/ide/events.json`
3. `.gorsee/ide/diagnostics.json`
4. `.gorsee/ide/context.md`
5. `.gorsee/ai-events.jsonl`

## Builder Guidance

- respect `GORSEE_AI_CONTEXT_SCHEMA_VERSION`
- treat additive evolution as normal and breaking changes as deliberate product events
- consume structured fields such as `requestId`, `traceId`, `spanId`, `route`, `artifact`, and `version`
- prefer diagnostics-first UX over raw event dumping
- do not infer private framework internals from incidental output formats

## Non-Goals

- external tools should not parse unstable internal module structure
- external tools should not depend on console text as the primary contract
