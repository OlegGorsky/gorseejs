# AI Session Packs

This document defines cross-session handoff through `gorsee ai pack` for Gorsee as a mature product.

## Purpose

Session packs let one session hand off diagnostics context to another session without relying on memory or copied terminal output.

Stable artifacts:

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

## Example Workflow

Session A:

1. run checks or reproduce a failure
2. run `gorsee ai pack`
3. leave `.gorsee/agent/latest.{json,md}` in the repo-local artifact store

Session B:

1. read `.gorsee/agent/latest.json`
2. inspect `.gorsee/agent/latest.md` for concise operator context
3. inspect `.gorsee/agent/release-brief.json` when deciding whether a built release should be promoted
4. inspect `.gorsee/agent/incident-brief.json` when triaging a live or recent failure
5. inspect `.gorsee/agent/deploy-summary.json` when a panel or agent needs a stable promotion payload
6. inspect `.gorsee/agent/incident-snapshot.json` when a panel or agent needs a current incident state snapshot
7. continue from explicit diagnostics instead of rediscovering the same failure

## Product Expectations

- session packs are a stable handoff workflow
- session packs should include schema identity and artifact context
- session packs should expose grounded release and incident briefs without requiring an extra CLI export step
- session packs should expose separate deploy-summary and incident-snapshot artifacts for control-plane style consumers
- session packs should remain aligned with IDE projections and MCP-visible state
