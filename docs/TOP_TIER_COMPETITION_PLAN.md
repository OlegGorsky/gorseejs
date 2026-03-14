# Top-Tier Competition Plan

This document defines the canonical post-exit plan for closing the gap between Gorsee's baseline product maturity and true competition with top-tier framework products.

It is intentionally separate from `docs/TOP_TIER_ROADMAP.md`.

`docs/TOP_TIER_ROADMAP.md` proves that Gorsee operates as a mature product.
This document tracks the additional work required for Gorsee to win against larger frameworks in real adoption environments.

## Purpose

After the top-tier baseline exit gate is closed, the remaining question is no longer "is the framework disciplined enough to ship?"

The remaining question is:

- can teams adopt it at lower friction
- can external operators trust its market claims
- can it demonstrate real production depth
- can it sustain differentiation beyond repository-local proof

This document is the single canonical plan for that work.

## Current Competition Gaps

### 1. External Proof Gap

Today Gorsee has strong internal proof surfaces:

- canonical examples
- benchmark reference apps
- machine-readable proof catalogs
- release and policy enforcement

What is still missing for stronger market competition:

- external production references
- public migration stories from other stacks
- independent downstream validation outside the main repository

### 2. Adoption Funnel Gap

Gorsee is intentionally Bun-first.

That improves determinism, but it also narrows the adoption funnel relative to frameworks that fit more existing Node/npm environments with minimal negotiation.

Competition work here means:

- reducing practical friction for Node-oriented teams
- making package-manager and runtime expectations obvious before adoption
- proving the supported non-primary paths with the same clarity as the Bun-first path where product strategy allows

### 3. Reference App Depth Gap

Some canonical examples currently prove contract shape more than production complexity.

Competition work here means:

- richer first-party examples for SaaS, content, internal tools, and server systems
- examples that demonstrate auth, forms, cache, typed routes, mutations, and reactive interactivity together
- examples that read like product references, not only conformance fixtures

### 4. Comparative Performance Gap

Gorsee already treats benchmark discipline seriously, but the reactive/runtime story still has remaining evidence gaps.

Competition work here means:

- clearer comparative evidence for hydration growth, resource invalidation pressure, mutation rollback pressure, and mixed-content multi-island routes
- repeatable comparisons that are legible to external evaluators, not only internal policy gates

### 5. Ecosystem Reach Gap

AI-first differentiation is real, but editor and tool reach is still narrow compared with top-tier framework ecosystems.

Competition work here means:

- broadening editor integration reach beyond the current baseline
- making AI surfaces easier for third parties to integrate without tribal knowledge
- turning the AI story from a first-party strength into an ecosystem surface

## Execution Spheres

### Sphere A: External Trust

Goal:

- move from internal proof to externally legible trust signals

Deliverables:

- at least one public migration case study
- at least two external reference deployments or downstream repos
- explicit external-proof catalog entries once those surfaces exist
- validated claims normalized through `docs/EXTERNAL_PROOF_CLAIMS.json`
- sourcing through `docs/EXTERNAL_PROOF_EXECUTION.md` and `docs/EXTERNAL_PROOF_OUTREACH.json`
- intake through `docs/EXTERNAL_PROOF_INTAKE.md` and `docs/EXTERNAL_PROOF_REGISTRY.json`

### Sphere B: Adoption Friction

Goal:

- reduce the delta between "interesting framework" and "practical candidate for a real team"

Deliverables:

- sharper Node/npm adoption guidance
- stricter onboarding language around runtime and package-manager assumptions
- validation of any expanded adoption path before claiming it publicly

### Sphere C: Reference App Depth

Goal:

- make canonical examples persuasive as product references

Deliverables:

- secure SaaS example covering authenticated dashboard, forms, cache, typed routes, and protected RPC flow
- richer content/reference examples with more realistic route and data shape
- workspace example that demonstrates shared package boundaries with non-trivial flow

### Sphere D: Market-Facing Evidence

Goal:

- make the reactive and runtime story competitive in external evaluation

Deliverables:

- comparative benchmark reports tied to concrete app shapes
- closed measurement gaps in `docs/REACTIVE_MEASUREMENT_GAPS.md`
- release-facing metric summaries that remain grounded in repeatable evidence

### Sphere E: Ecosystem Reach

Goal:

- widen the framework's practical orbit without diluting its deterministic model

Deliverables:

- broader AI/editor integration surface
- clearer third-party integration docs for AI and diagnostics workflows
- deliberate downstream expansion only when it preserves product clarity

## Rules

- do not reopen baseline maturity unless a shipped claim is currently unjustified
- do not disguise market-expansion work as baseline hardening
- do not broaden support claims without validation
- do not chase ecosystem parity by adding overlapping framework models

## Completion Standard

Competition work is complete only when the relevant surfaces are visible in:

- code
- examples
- docs
- tests or validation
- externally legible proof where the claim depends on external adoption
