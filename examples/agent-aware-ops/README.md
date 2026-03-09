# Agent-Aware Ops Example

This example is part of the mature product surface for Gorsee.

It shows the recommended path for an internal operator-facing app where AI diagnostics, IDE sync, session packs, and MCP workflows are first-class concerns.

## Why This Example Exists

- demonstrate `ai.enabled` as a product path, not a side experiment
- show `gorsee/client` and `gorsee/server` imports in a diagnostics-oriented app
- provide a reference shape for `gorsee ai ide-sync`, `gorsee ai pack`, and `gorsee ai mcp`

## Recommended Commands

- `bun run dev`
- `bun run check`
- `bunx gorsee ai ide-sync`
- `bunx gorsee ai ide-sync --watch`
- `bunx gorsee ai pack`
- `bunx gorsee ai mcp`
- `bunx gorsee ai doctor`
