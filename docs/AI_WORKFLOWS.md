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

- local AI bootstrap via `gorsee ai init`
- framework cold-start export via `gorsee ai framework`
- IDE sync via `gorsee ai ide-sync`
- local bridge ingestion via `gorsee ai bridge`
- stdio MCP access via `gorsee ai mcp`
- cross-session handoff via `gorsee ai pack`
- explicit named checkpoint capture via `gorsee ai checkpoint`
- diagnostics-first summarization via `gorsee ai doctor`

`gorsee ai pack` is expected to leave both the full context bundle and grounded handoff briefs on disk:

- `.gorsee/agent/latest.{json,md}`
- `.gorsee/agent/deploy-summary.{json,md}`
- `.gorsee/agent/release-brief.{json,md}`
- `.gorsee/agent/incident-brief.{json,md}`
- `.gorsee/agent/incident-snapshot.{json,md}`

`gorsee ai checkpoint` is expected to leave explicit operator snapshots on disk:

- `.gorsee/agent/checkpoints/*.json`
- `.gorsee/agent/checkpoints/*.md`
- `.gorsee/agent/checkpoints/*.meta.json`
- `.gorsee/agent/checkpoints/latest.json`

Use `gorsee ai framework --format markdown` when a new agent session needs the canonical product context, import boundaries, route grammar, key doc paths, and syntax patterns before touching runtime diagnostics.

Use `gorsee ai init` once per repository when AI workflows are enabled to scaffold `.gorsee/rules.md`, `GORSEE.md`, and the checkpoint directory before the first tracked session.

Use `gorsee ai checkpoint --mode inspect|propose|apply|operate` when an operator wants to preserve the current session state with explicit mutation semantics.

Canonical AI operation modes:

- `inspect` for read-only debugging and repository comprehension
- `propose` for non-mutating remediation planning
- `apply` for repository edits without runtime operations
- `operate` for deploy, worker, bridge, or incident actions with explicit operator intent

That cold-start packet is also expected to carry the current `app.mode` so the next agent can reason correctly about `frontend`, `fullstack`, or `server` constraints before making changes.

Operational AI artifacts should also carry the current application context:

- `app.mode`
- `runtime.topology`
- mode-aware diagnostics context in `.gorsee/ai-events.jsonl`, `.gorsee/ai-diagnostics.json`, and exported AI packets
- server-oriented apps should also rely on structured job lifecycle events instead of handwritten worker logs

Transport rule:

- model traffic should prefer provider-direct or self-hosted execution paths
- the AI bridge is for diagnostics ingestion and workflow coordination, not for sitting on the production runtime request path

Check enforcement:

- `gorsee check` warns with `W928` when `ai.enabled` is set but no local AI rules file exists
- `gorsee check` warns with `W929` when the latest AI packet reports `apply` or `operate` mode without a matching explicit checkpoint

## Product Expectations

- workflows must be repeatable across sessions and environments
- bridge failure must never affect app/runtime behavior
- agents should consume structured artifacts before scraped console output
- human operators should be able to hand off context without tribal knowledge
- reactive trace artifacts should stay machine-readable and versioned when a team includes them in local debugging workflows
- application mode must stay explicit and machine-readable across AI packets, upgrade reports, and deploy/build contracts
