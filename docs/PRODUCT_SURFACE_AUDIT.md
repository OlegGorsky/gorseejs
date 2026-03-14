# Product Surface Audit

This document is the concise maturity index for Gorsee product surfaces.

Use it when a human operator or coding agent needs a quick answer to:

- which surfaces are currently treated as closed and mature
- which surfaces are only partially mature
- which source-of-truth docs define each surface

This document is a summary layer. It does not replace the deeper contracts in `docs/`.

## Closed Surfaces

These surfaces currently have code, docs, and automated proof strong enough to be treated as closed for the current product contract:

- security and request-policy runtime: canonical origin, proxy trust, RPC protection, request classification, and fail-closed runtime behavior
- page rendering pipeline: route/document/partial rendering, streaming shells, error boundaries, and response-shape failure propagation
- reactive core runtime race contracts: signals/resources/mutations invalidation, optimistic updates, rollback behavior, and reconnect suppression
- dev runtime and HMR contract: typed update generation, origin-gated internal channels, machine-readable client payloads, and fail-closed malformed update fallback
- publish/install/release train: packed exports, release smoke, install matrix, release checks, and npm delivery discipline
- CLI contract surface: top-level command matrix, AI subcommands, README/AGENTS/framework generator alignment, and command-policy enforcement
- AI bootstrap and enforcement surface: `gorsee ai framework`, `gorsee ai init`, `gorsee ai checkpoint`, local rules scaffold, and `W928` / `W929`
- AI diagnostics and handoff artifacts: bridge, MCP, IDE sync, bundles, session packs, release/deploy/incident briefs, and schema-aligned artifacts
- Node/npm adoption contract: explicit Bun-first development framing plus validated Node and npm adoption paths
- plugin ecosystem: deterministic ordering, config validation, lifecycle/teardown failure handling, and conformance harness coverage
- domain helper surfaces: content, forms, i18n, image, and typed routes with scoped import and release-surface enforcement
- public import surfaces: `gorsee/client`, `gorsee/server`, scoped stable subpaths, and compatibility-only root guidance
- starter and bootstrap surface: canonical starter set, examples policy, `create-gorsee`, and starter onboarding contract
- deploy contract surface for documented targets: Bun-first process runtime plus validated supported adapters and generated deploy artifacts
- third-party editor integration contract: explicit local artifact-first integration path for VS Code/Cursor and other editor consumers
- release-facing reactive evidence summary: promoted realistic metrics summarized through benchmark artifacts, baselines, and guarded release-facing evidence docs

## Partially Mature Surfaces

These surfaces are already product-facing, but should still be treated as partially mature because the current evidence or examples are narrower than the final ambition:

- reactive measurement story beyond the currently closed race/runtime contract, especially hydration-heavy and invalidation-heavy comparative evidence
- market-facing adoption proof: external production references, migration stories, and third-party validation beyond repo-local evidence

## Canonical Source Map

Use these documents as the source of truth for each surface:

- `docs/TEST_COVERAGE_AUDIT.md` for closed-vs-gap test proof and `COV-*` contract tracking
- `docs/PUBLIC_SURFACE_MAP.md` and `docs/PUBLIC_SURFACE_MANIFEST.json` for import surfaces
- `docs/CLI_CONTRACT.json` for command surfaces
- `docs/AI_WORKFLOWS.md`, `docs/AI_ARTIFACT_CONTRACT.md`, and `docs/AI_SURFACE_STABILITY.md` for AI workflows and artifacts
- `docs/AI_INTEGRATION_CONTRACT.json` for the local editor/tool integration contract and the explicit boundary between stable local integration and still-partial external ecosystem reach
- `docs/THIRD_PARTY_EDITOR_INTEGRATIONS.md` for artifact-first guidance across VS Code/Cursor and other editor consumers
- `docs/SUPPORT_MATRIX.md` for support claims and validated runtime targets
- `docs/SECURITY_MODEL.md` and `docs/RUNTIME_SECURITY_CONTRACT.json` for runtime/security guarantees
- `docs/DEPLOY_TARGET_GUIDE.md` and `docs/DEPLOY_CONTRACT.json` for deploy/runtime target behavior
- `docs/REACTIVE_MEASUREMENT_CONTRACT.json` and `docs/REACTIVE_MEASUREMENT_GAPS.md` for the machine-readable remaining benchmark evidence backlog
- `docs/REACTIVE_EVIDENCE_SUMMARY.md` and `docs/REACTIVE_EVIDENCE_SUMMARY.json` for release-facing realistic reactive benchmark summaries
- `docs/TOP_TIER_ROADMAP.md`, `docs/TOP_TIER_EXIT_GATE.md`, and `docs/TOP_TIER_COMPETITION_PLAN.md` for maturity and market-competition framing
- `docs/COMPETITION_CLOSURE_PLAN.md` and `docs/COMPETITION_BACKLOG.json` for the explicit remaining external backlog and operator-facing closure plan
- `docs/EXTERNAL_PROOF_INTAKE.md`, `docs/EXTERNAL_PROOF_PIPELINE.json`, `docs/EXTERNAL_PROOF_REVIEW.md`, and `docs/EXTERNAL_PROOF_REGISTRY.json` for the intake path, pending queue, review process, and accepted registry of public external proof
- `docs/MARKET_READY_PROOF.md` and `docs/ADOPTION_PROOF_MANIFEST.json` for repo-local proof surfaces and adoption evidence
- `docs/NODE_NPM_ADOPTION.md` for explicit Node/npm adoption framing

## Reading Order

When a new session needs a fast but grounded understanding of the project:

1. read this file for the maturity snapshot
2. read `docs/TEST_COVERAGE_AUDIT.md` for automated proof status
3. read `docs/PUBLIC_SURFACE_MAP.md` and `docs/CLI_CONTRACT.json` for product surface boundaries
4. read the relevant deep contract docs for the surface being changed

## Maintenance Rule

Update this document when either of the following changes:

- a surface moves from partial to closed maturity
- public claims or proof expectations shift in a way that changes the maturity summary
