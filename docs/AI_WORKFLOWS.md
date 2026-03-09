# AI Workflows

This document defines the repeatable AI-first workflows for Gorsee as a mature product.

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

- IDE sync via `gorsee ai ide-sync`
- local bridge ingestion via `gorsee ai bridge`
- stdio MCP access via `gorsee ai mcp`
- cross-session handoff via `gorsee ai pack`
- diagnostics-first summarization via `gorsee ai doctor`

## Product Expectations

- workflows must be repeatable across sessions and environments
- bridge failure must never affect app/runtime behavior
- agents should consume structured artifacts before scraped console output
- human operators should be able to hand off context without tribal knowledge
- reactive trace artifacts should stay machine-readable and versioned when a team includes them in local debugging workflows
