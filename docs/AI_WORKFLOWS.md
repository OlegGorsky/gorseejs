# AI Workflows

This document defines the repeatable AI-first workflows for Gorsee as a mature product.

Machine-readable companion: `docs/DIAGNOSTICS_CONTRACT.json`

## Human + Agent Collaboration

Gorsee is designed for deterministic collaboration between a human operator and a coding agent.

This is the canonical human + agent collaboration model for the framework.

The default loop is:

1. make a framework or app change
2. run `gorsee check` and targeted tests
3. inspect `.gorsee/ai-events.jsonl` and `.gorsee/ai-diagnostics.json`
4. when debugging reactive reruns, capture `createRuntimeDevtoolsSnapshot()` or `getReactiveTraceArtifact()` from the local runtime and keep it alongside the AI diagnostics surface
5. let the next agent session continue from explicit artifacts instead of guessing from logs

## Core Workflow Modes

The stable operator workflows are:

- framework cold-start export via `gorsee ai framework`
- IDE sync via `gorsee ai ide-sync`
- local bridge ingestion via `gorsee ai bridge`
- stdio MCP access via `gorsee ai mcp`
- cross-session handoff via `gorsee ai pack`
- diagnostics-first summarization via `gorsee ai doctor`

`gorsee ai pack` is expected to leave both the full context bundle and grounded handoff briefs on disk:

- `.gorsee/agent/latest.{json,md}`
- `.gorsee/agent/deploy-summary.{json,md}`
- `.gorsee/agent/release-brief.{json,md}`
- `.gorsee/agent/incident-brief.{json,md}`
- `.gorsee/agent/incident-snapshot.{json,md}`

Use `gorsee ai framework --format markdown` when a new agent session needs the canonical product context, import boundaries, route grammar, key doc paths, and syntax patterns before touching runtime diagnostics.

That cold-start packet is also expected to carry the current `app.mode` so the next agent can reason correctly about `frontend`, `fullstack`, or `server` constraints before making changes.

Operational AI artifacts should also carry the current application context:

- `app.mode`
- `runtime.topology`
- mode-aware diagnostics context in `.gorsee/ai-events.jsonl`, `.gorsee/ai-diagnostics.json`, and exported AI packets
- server-oriented apps should also rely on structured job lifecycle events instead of handwritten worker logs

## Product Expectations

- workflows must be repeatable across sessions and environments
- bridge failure must never affect app/runtime behavior
- agents should consume structured artifacts before scraped console output
- human operators should be able to hand off context without tribal knowledge
- reactive trace artifacts should stay machine-readable and versioned when a team includes them in local debugging workflows
- application mode must stay explicit and machine-readable across AI packets, upgrade reports, and deploy/build contracts
