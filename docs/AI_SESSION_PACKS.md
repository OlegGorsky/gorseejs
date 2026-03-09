# AI Session Packs

This document defines cross-session handoff through `gorsee ai pack` for Gorsee as a mature product.

## Purpose

Session packs let one session hand off diagnostics context to another session without relying on memory or copied terminal output.

Stable artifacts:

- `.gorsee/agent/latest.json`
- `.gorsee/agent/latest.md`

## Example Workflow

Session A:

1. run checks or reproduce a failure
2. run `gorsee ai pack`
3. leave `.gorsee/agent/latest.{json,md}` in the repo-local artifact store

Session B:

1. read `.gorsee/agent/latest.json`
2. inspect `.gorsee/agent/latest.md` for concise operator context
3. continue from explicit diagnostics instead of rediscovering the same failure

## Product Expectations

- session packs are a stable handoff workflow
- session packs should include schema identity and artifact context
- session packs should remain aligned with IDE projections and MCP-visible state
