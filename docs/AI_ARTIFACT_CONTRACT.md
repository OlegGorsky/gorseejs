# AI Artifact Contract

This document defines the stable contract for Gorsee AI-facing artifacts.

Gorsee is a mature product, so AI tooling must consume explicit and versioned artifacts rather than undocumented incidental output.

## Contract Scope

The current AI artifact surface includes:

- `.gorsee/ai-events.jsonl`
- `.gorsee/ai-diagnostics.json`
- `.gorsee/ide/diagnostics.json`
- `.gorsee/ide/events.json`
- `.gorsee/ide/context.md`
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

Related local debugging artifact:

- reactive trace snapshots returned by `getReactiveTraceArtifact()`
- runtime inspector snapshots returned by `createRuntimeDevtoolsSnapshot()`

These artifacts are expected to carry diagnosable runtime failure context for a mature product.

## Versioning Rule

AI context packets, IDE projections, and session-pack bundles carry an explicit schema version.

Current schema:

- `1.0`

The schema version is exported in code as `GORSEE_AI_CONTEXT_SCHEMA_VERSION`.

## Runtime Failure Scenarios

AI artifacts should remain useful for the most important failure paths, especially:

- `request.error`
- `build.summary`
- `release.smoke.error`

Agents and IDE tooling should prefer those structured events over scraped console output when diagnosing runtime, build, and release failures.

When reactive debugging is part of the failure path, tooling may also ingest a local reactive trace artifact. That artifact must stay versioned and machine-readable in the same way as the AI-facing JSON surfaces.

## Product Expectations

- AI-facing JSON outputs must be machine-readable and stable enough for tool integration.
- AI-facing Markdown outputs should embed schema identity when they represent versioned context artifacts.
- Changes to schema versioning should be treated as product-surface changes and reviewed with the same care as public API changes.

## Stability Guidance

- additive fields are preferred over breaking field removals
- schema bumps should be deliberate and documented
- generated scaffolds and agent guidance should assume versioned artifacts, not scrape unstructured logs
