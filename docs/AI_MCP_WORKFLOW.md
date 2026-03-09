# AI MCP Workflow

This document defines the `gorsee ai mcp` workflow for Gorsee as a mature product.

## Purpose

`gorsee ai mcp` exposes local AI state through a stdio MCP server so an agent can inspect diagnostics and artifacts directly.

## Recommended Flow

1. keep `.gorsee/ai-events.jsonl` and `.gorsee/ai-diagnostics.json` up to date
2. run `gorsee ai mcp`
3. connect a local MCP-aware tool
4. query diagnostics, events, and context through structured resources instead of log scraping

## Product Expectations

- MCP is a stable operator workflow
- MCP should reflect the same local artifact state as IDE sync and session packs
- MCP consumers should treat versioned artifacts as the source of truth, not undocumented internals
