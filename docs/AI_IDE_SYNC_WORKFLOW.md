# AI IDE Sync Workflow

This document defines the `gorsee ai ide-sync` workflow for Gorsee as a mature product.

## Purpose

`gorsee ai ide-sync` produces editor-facing projections from the canonical AI artifact store.

Stable outputs:

- `.gorsee/ide/diagnostics.json`
- `.gorsee/ide/events.json`
- `.gorsee/ide/context.md`

## Recommended Flow

1. enable AI observability in `app.config.ts`
2. run the app, build, or checks
3. run `gorsee ai ide-sync`
4. point editor tooling at `.gorsee/ide/*`
5. use `gorsee ai ide-sync --watch` for live development sessions

## Operator Guarantees

- IDE sync is derived from local structured artifacts, not from scraping terminal output
- the generated files remain a stable operator workflow
- IDE sync should stay useful even when bridge or MCP is not in use
