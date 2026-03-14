# Third-Party Editor Integrations

This document defines the canonical third-party editor integration surface for Gorsee as a mature product.

Machine-readable companion: `docs/AI_INTEGRATION_CONTRACT.json`

The rule is simple:

- editor tooling should consume structured local Gorsee artifacts
- editor tooling should not depend on scraped terminal output
- model traffic should remain provider-direct or self-hosted

## Stable Local Inputs

Third-party editor tooling should prefer these stable artifacts:

- `.gorsee/ide/diagnostics.json`
- `.gorsee/ide/events.json`
- `.gorsee/ide/context.md`
- `.gorsee/agent/latest.json`
- `.gorsee/agent/latest.md`
- `.gorsee/agent/checkpoints/latest.json`

Stable commands:

- `gorsee ai ide-sync`
- `gorsee ai ide-sync --watch`
- `gorsee ai pack`
- `gorsee ai checkpoint`
- `gorsee ai mcp`

## Recommended Integration Patterns

### VS Code and Cursor

Use the packaged extension in `integrations/vscode-gorsee-ai` when the editor supports the VS Code extension model.

Recommended flow:

1. run `gorsee ai init`
2. run `gorsee ai ide-sync --watch`
3. install the packaged VSIX or run the staged extension host

### JetBrains IDEs

Use file watchers, external tools, or plugins that read:

- `.gorsee/ide/diagnostics.json` for issue surfaces
- `.gorsee/ide/context.md` for condensed operator context
- `.gorsee/agent/latest.json` for session handoff state

Recommended flow:

1. run `gorsee ai ide-sync --watch`
2. map diagnostics to editor problems
3. map `context.md` or `latest.md` into a dedicated tool window

### Neovim and LSP-style Tooling

Use diagnostics consumers or language-tooling helpers that read:

- `.gorsee/ide/diagnostics.json`
- `.gorsee/ide/events.json`
- `.gorsee/agent/checkpoints/latest.json`

Recommended flow:

1. run `gorsee ai ide-sync --watch`
2. convert structured diagnostics to quickfix or loclist entries
3. use checkpoints and session packs for deterministic agent handoff

### MCP-Capable Tools

Use `gorsee ai mcp` when the editor or agent host supports stdio MCP.

This is the preferred path when the tool needs:

- structured diagnostics queries
- structured events queries
- framework-context retrieval

## Integration Rules

- treat `.gorsee/*` as canonical local truth for editor integration
- keep mode, rules, and checkpoint semantics visible to downstream tools
- use `gorsee ai bridge` only for trusted local workflow coordination, not as a production runtime path
- do not claim a third-party editor integration as product-ready unless it follows the structured artifact contract

## Product Rule

Gorsee supports third-party editor integration through explicit local contracts first.
Public ecosystem trust signals belong in the external-proof surface, not in ad hoc editor claims.
