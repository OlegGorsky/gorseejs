# AI Debugging Workflows

This document defines diagnostics-first debugging workflows for Gorsee as a mature product.

## Default Debugging Path

Prefer this order:

1. reproduce the failure
2. run `gorsee check` or the relevant targeted test
3. run `gorsee ai doctor`
4. run `gorsee ai export --bundle --format markdown`
5. run `gorsee ai ide-sync` or `gorsee ai mcp` depending on the tool in use

## Why This Matters

Diagnostics-first debugging keeps the framework predictable for both humans and agents.

It avoids:

- ad hoc log scraping
- losing context across sessions
- confusing runtime failure with build or release drift

## Recommended Commands

- `gorsee ai doctor`
- `gorsee ai export --bundle --format markdown`
- `gorsee ai ide-sync --watch`
- `gorsee ai pack`
- `gorsee ai mcp`

When using `gorsee ai pack`, prefer:

- `.gorsee/agent/deploy-summary.json` for panel-ready promotion state
- `.gorsee/agent/release-brief.json` for promotion/release review
- `.gorsee/agent/incident-brief.json` for operator triage
- `.gorsee/agent/incident-snapshot.json` for the latest machine-readable incident state
