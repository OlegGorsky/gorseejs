# Gorsee Agent Contract

This file defines the project-level operating contract for coding agents working in this repository.

## Product Identity

Gorsee is an AI-first reactive full-stack framework.

It is a mature product. It is not a pet project, not a toy framework, and not a research sandbox.

Every contribution must preserve and strengthen these properties:

- deterministic collaboration between humans and coding agents
- strict runtime and security contracts
- fine-grained reactive architecture without VDOM baggage
- minimal dependency surface
- product-grade release, testing, and deploy discipline

## Primary Objective

When changing this repository, optimize for:

1. correctness of framework contracts
2. security and fail-closed behavior
3. determinism and architectural clarity
4. product readiness and maintainability
5. performance and dependency discipline

## Architectural Strategy

Agents must understand and preserve the following strategy:

- `gorsee/client` is the canonical browser-safe surface.
- `gorsee/server` is the canonical server surface.
- scoped stable subpaths such as `gorsee/auth`, `gorsee/db`, `gorsee/security`, `gorsee/ai`, `gorsee/forms`, `gorsee/routes`, `gorsee/i18n`, `gorsee/content`, `gorsee/env`, `gorsee/log`, and `gorsee/testing` are part of the canonical public surface when the concern is already domain-specific.
- root `gorsee` is compatibility-only unless explicitly evolving migration semantics.
- the framework prefers one clear way over many loosely supported options.
- AI tooling is part of the framework itself, not auxiliary decoration.
- capabilities such as auth, cache, request policy, deploy assumptions, and diagnostics are framework contracts.
- AI workflows such as IDE sync, MCP, bridge, session packs, and diagnostics-first debugging are product surfaces.
- the CLI is part of the product contract, not an incidental developer convenience layer.

## Engineering Doctrine

### Determinism

Prefer explicit and canonical implementations.

Avoid:

- introducing parallel APIs with overlapping purpose
- hidden alternate execution paths
- “flexible” abstractions that reduce predictability for agents

### Security

Treat security as part of runtime semantics.

Do not weaken:

- request execution order
- request policy validation
- canonical origin requirements
- proxy trust boundaries
- RPC protection model
- cache visibility and vary semantics
- static file containment

### Reactive Model

Preserve the framework's reactive-first identity.

Do not introduce:

- mandatory VDOM architecture
- unnecessary compatibility with React mental models
- dependencies that erode fine-grained reactivity

### Product Maturity

Default to mature product decisions.

Prefer:

- explicit docs
- tests for invariants
- stable naming
- minimal dependencies
- release and deploy discipline

Reject changes that feel like:

- speculative experiments
- convenience hacks
- temporary shortcuts without a clear migration path

## Working Rules For Agents

- Read existing code before proposing architectural change.
- Preserve client/server import boundaries.
- Keep public API additions minimal and intentional.
- If a new feature can be implemented as a strict extension of an existing contract, prefer that over creating a new model.
- If a change affects security, runtime dispatch, deploy behavior, or release policy, update the relevant docs and tests in the same task.
- If a claim is made in docs or README, ensure it is reflected in code or remove the claim.
- Treat benchmark and example apps as product proof surfaces, not marketing filler.

## AI Workflow Contract

- Treat `gorsee ai framework --format markdown` as the canonical cold-start packet for the current repository or app.
- When `ai.enabled` is part of the workflow, bootstrap the local AI surface with `gorsee ai init`.
- `.gorsee/rules.md` is the preferred local AI rules file. `GORSEE.md` is the broader local operator guide.
- Keep AI sessions in `inspect` or `propose` unless mutation is justified.
- Before `apply` or `operate`, create an explicit checkpoint with `gorsee ai checkpoint --mode <mode>`.
- Treat `W928` and `W929` from `gorsee check` as contract drift, not optional housekeeping warnings.
- Prefer structured `.gorsee/*` artifacts over scraped logs when handing off context to another agent or operator.

## Canonical Product Surfaces

- Public import surfaces are defined by `docs/PUBLIC_SURFACE_MAP.md` and `docs/PUBLIC_SURFACE_MANIFEST.json`.
- CLI command surfaces are defined by `docs/CLI_CONTRACT.json`.
- AI artifact and workflow surfaces are defined by `docs/AI_ARTIFACT_CONTRACT.md`, `docs/AI_WORKFLOWS.md`, and `docs/AI_SURFACE_STABILITY.md`.
- Local AI/editor integration boundaries are defined by `docs/AI_INTEGRATION_CONTRACT.json`.
- The concise maturity snapshot for closed vs partially mature surfaces is defined by `docs/PRODUCT_SURFACE_AUDIT.md`.
- External competition backlog and closure planning are defined by `docs/TOP_TIER_COMPETITION_PLAN.md`, `docs/COMPETITION_CLOSURE_PLAN.md`, and `docs/COMPETITION_BACKLOG.json`.
- External proof intake and accepted public evidence are defined by `docs/EXTERNAL_PROOF_INTAKE.md` and `docs/EXTERNAL_PROOF_REGISTRY.json`.
- Pending external-proof candidates are tracked in `docs/EXTERNAL_PROOF_PIPELINE.json` until they are validated.
- Review and promotion of external proof candidates are defined by `docs/EXTERNAL_PROOF_REVIEW.md`.
- Explicit Node/npm adoption framing is defined by `docs/NODE_NPM_ADOPTION.md`.
- Third-party editor integration guidance is defined by `docs/THIRD_PARTY_EDITOR_INTEGRATIONS.md`.
- Release-facing realistic reactive benchmark summaries are defined by `docs/REACTIVE_EVIDENCE_SUMMARY.md` and `docs/REACTIVE_EVIDENCE_SUMMARY.json`.
- Runtime, deploy, security, and release contracts are defined by the corresponding docs and machine-readable contract files in `docs/`.

## Documentation Obligations

When a change shifts strategy or product behavior, agents should update the relevant documents:

- `README.md`
- `docs/CLI_CONTRACT.json`
- `docs/TOP_TIER_ROADMAP.md`
- `docs/PRODUCT_VISION.md`
- `docs/FRAMEWORK_DOCTRINE.md`
- `docs/API_STABILITY.md`
- `docs/PUBLIC_SURFACE_MAP.md`
- `docs/PRODUCT_SURFACE_AUDIT.md`
- `docs/COMPETITION_CLOSURE_PLAN.md`
- `docs/COMPETITION_BACKLOG.json`
- `docs/EXTERNAL_PROOF_INTAKE.md`
- `docs/EXTERNAL_PROOF_PIPELINE.json`
- `docs/EXTERNAL_PROOF_REVIEW.md`
- `docs/EXTERNAL_PROOF_REGISTRY.json`
- `docs/TEST_COVERAGE_AUDIT.md`
- `docs/AI_INTEGRATION_CONTRACT.json`
- `docs/AI_ARTIFACT_CONTRACT.md`
- `docs/AI_WORKFLOWS.md`
- `docs/AI_SURFACE_STABILITY.md`
- `docs/REACTIVE_MEASUREMENT_CONTRACT.json`
- `docs/REACTIVE_EVIDENCE_SUMMARY.md`
- `docs/REACTIVE_EVIDENCE_SUMMARY.json`
- `docs/SUPPORT_MATRIX.md`
- `docs/NODE_NPM_ADOPTION.md`
- `docs/THIRD_PARTY_EDITOR_INTEGRATIONS.md`
- `docs/DEPRECATION_POLICY.md`
- `docs/MATURITY_POLICY.md`
- `docs/DEPENDENCY_POLICY.md`
- `docs/SECURITY_MODEL.md`
- deploy, CI, or release docs when applicable

## Decision Filter

Before finalizing a change, ask:

1. Does this make Gorsee easier for an agent to reason about?
2. Does this preserve or improve deterministic behavior?
3. Does this strengthen security and runtime guarantees?
4. Does this fit a reactive-first, dependency-light architecture?
5. Would this look correct in a mature framework product?

If the answer is no, revise the approach.
