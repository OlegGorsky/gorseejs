# Release Policy

This document defines the intended Gorsee release channels for a mature product release train.

## Channels

### Stable

- version format: `x.y.z`
- npm tag: `latest`
- intended for production consumption

### Canary

- version format: `x.y.z-canary.N`
- npm tag: `canary`
- intended for early validation of security/runtime changes before wider rollout

### Release Candidate

- version format: `x.y.z-rc.N`
- npm tag: `rc`
- intended for final validation before a stable release

## Invariants

- stable releases must not use prerelease suffixes
- canary releases must use an explicit `-canary.N` suffix
- release candidates must use an explicit `-rc.N` suffix
- release channel policy is enforced by:
  - `release:stable:check`
  - `release:canary:check`
  - `release:rc:check`
  - `compiler:promotion:check`
  - `build:promotion:check`

## Release Train Guidance

Suggested flow:

1. merge runtime/security work onto main
2. publish one or more `canary` builds
3. publish `rc` once release smoke and deploy validation are stable
4. publish `stable` only after the RC line is validated

## Security-Sensitive Changes

For changes that affect security invariants, prefer:

- canary first
- then rc
- then stable

This keeps semantic tightening out of blind stable releases.

## Mode-Aware Release Reasoning

Release validation must stay aware of the current product shape:

- `app.mode` should remain explicit for mature applications
- `app.mode must stay explicit in mature apps`
- release triage must distinguish `frontend`, `fullstack`, and `server` expectations
- `release triage must consider frontend/fullstack/server behavior`
- `runtime.topology` must stay aligned with diagnostics, deploy assumptions, and incident analysis
- `runtime.topology must stay aligned with release diagnostics`
- `deploy target compatibility must stay aligned with frontend/fullstack/server mode contracts`

## Tooling

- `docs/RELEASE_CONTRACT.json` is the machine-readable release contract for channels, mandatory policy gates, and operator expectations.
- `bun run api:policy` validates the machine-readable public API stability contract before release.
- `bun run adoption:policy` validates the machine-readable adoption and market-ready proof contract before release.
- `bun run critical:surface` validates the narrow high-risk regression suite before broader release verification proceeds.
- `node scripts/release-version-plan.mjs canary` prints the next expected canary version.
- `node scripts/release-version-plan.mjs rc` prints the next expected release candidate version.
- `node scripts/release-version-plan.mjs stable` normalizes a prerelease back to its stable base version.
- `node scripts/compiler-promotion-check.mjs` validates the compiler backend promotion gate.
- `node scripts/build-promotion-check.mjs` validates the build backend promotion gate.
- `node scripts/backend-switch-evidence-check.mjs` validates the go/no-go evidence required before any backend default switch.
- `node scripts/backend-default-switch-review-check.mjs` validates the unified operator review packet for backend default switches.
- `node scripts/compiler-default-switch-rehearsal-check.mjs` validates the compiler default-switch rehearsal path.
- `node scripts/build-default-switch-rehearsal-check.mjs` validates the build default-switch rehearsal path.
- `node scripts/backend-candidate-rollout-check.mjs` validates the operational rollout plan for the candidate backend system.
- `bun run backend:candidate:verify` runs the full candidate backend verification train before any default-switch review can move to go.
- `docs/RELEASE_CHECKLIST.md` is the operator-facing checklist that must be satisfied before publishing.
- `node scripts/release-check.mjs` validates packed manifest normalization and tarball contents.
- `node scripts/install-matrix-check.mjs` validates source, tarball, and workspace install paths.
- `node scripts/release-smoke.mjs` validates packed starter creation, standalone `create-gorsee`, canonical example sandbox builds across `frontend`, `fullstack`, and `server` reference apps, and deploy-generator behavior.
- `docs/APPLICATION_MODES.md` defines the canonical frontend/fullstack/server shapes that release reasoning must preserve.

## Product Standard

Releases are product events. Gorsee must not publish with prototype-level discipline, undocumented contract drift, or knowingly misaligned docs.

Release reasoning should remain aligned with:

- `docs/API_STABILITY.md`
- `docs/APPLICATION_MODES.md`
- `docs/SUPPORT_MATRIX.md`
- `docs/DEPRECATION_POLICY.md`
- `docs/EXAMPLES_POLICY.md`
- `docs/RUNTIME_FAILURES.md`
- `docs/RUNTIME_TRIAGE.md`
- `docs/AI_WORKFLOWS.md`
- `docs/AI_SURFACE_STABILITY.md`
- `docs/UPGRADE_PLAYBOOK.md`
- `docs/FIRST_PRODUCTION_ROLLOUT.md`
- `docs/RELEASE_CONTRACT.json`
- `docs/BENCHMARK_METHODOLOGY.md`
- `docs/BENCHMARK_RELEASE_DISCIPLINE.md`
- `docs/EVIDENCE_POLICY.md`
- `docs/BACKEND_SWITCH_EVIDENCE.md`
- `docs/BACKEND_DEFAULT_SWITCH_REVIEW.md`
- `docs/COMPILER_DEFAULT_SWITCH_REHEARSAL.md`
- `docs/BUILD_DEFAULT_SWITCH_REHEARSAL.md`
- `docs/BACKEND_CANDIDATE_ROLLOUT_PLAN.md`
- `docs/COMPILER_DEFAULT_SWITCH_DOSSIER.md`
- `docs/BUILD_DEFAULT_SWITCH_DOSSIER.md`
- `docs/ROADMAP_COMPLETION_POLICY.md`
- `docs/TOP_TIER_EXIT_GATE.md`
