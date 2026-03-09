# Top-Tier Roadmap

This roadmap defines the single canonical execution plan for bringing Gorsee to top-tier framework maturity.

This is the only strategic roadmap document in the repository. If product direction changes, update this document instead of creating a second high-level plan.

The goal is not feature sprawl. The goal is product depth, operational trust, architectural hardening, and repeatable release discipline.

Gorsee is being built as a mature product, and this roadmap exists to close the remaining gap between strong architecture and top-tier framework execution.

## Principles

- Keep the core strict.
- Strengthen guarantees before widening API surface.
- Prefer canonical product paths over optionality.
- Treat AI-first and reactive-first identity as constraints, not marketing lines.
- Consider a stage complete only when code, tests, docs, and relevant CI/policy gates land together.

## Sphere Model

Strategic maturity still follows the stages below, but implementation may proceed by sphere when that leads to a more complete product result.

Current implementation priority:

1. Runtime / Navigation Sphere
2. Release / CI / Support Sphere
3. Reactive / Devtools Sphere
4. Ecosystem / Conformance Sphere
5. Performance / Evidence Sphere

Rule:

- when a sphere is active, prefer closing it to an enterprise-grade baseline instead of touching many half-finished subsystems
- a sphere is complete only when correctness, tests, docs, diagnostics, and CI/release enforcement are all in place

## Completed Sphere: Build / Compiler

Goal: bring the `rolldown` + `oxc` platform surface to an enterprise-grade baseline worthy of being the canonical product path.

Sub-blocks:

- client bundle correctness
- build artifact contracts
- compiler/build parity evidence
- build diagnostics and failure clarity
- CI and release enforcement for the canonical backends

Build / Compiler exit criteria:

- `rolldown` client output works for production browser runtime, not only artifact parity
- nested route entries, chunk imports, CSS assets, sourcemaps, and hashed output paths remain deterministic
- `oxc` and `rolldown` parity suites stay green against the canonical fixture corpus
- generated build/compiler artifacts are versioned or schema-checked where machine consumers depend on them
- build failures point to actionable diagnostics instead of opaque backend noise
- CI and release-train enforce the canonical compiler/build path rather than treating it as a best-effort path
- backend diagnostics carry backend/phase/code context and are covered by the build evidence train
- route facts and compiler parity surfaces remain machine-readable, versioned, and shared across docs/typegen/build metadata consumers

Status:

- closed
- release/evidence trains are green on the canonical `rolldown` + `oxc` path
- future work in this area should be treated as maintenance or deliberate platform evolution, not baseline hardening

## Active Sphere: Runtime / Navigation

Goal: bring navigation, hydration, streaming overlap, and state restoration semantics to the same enterprise-grade baseline now held by the build/compiler platform.

Priority reasons:

- runtime correctness is now the largest remaining quality gap relative to top-tier framework peers
- the build/compiler platform is stable enough to support deeper runtime hardening without churn

## Stage 1: Navigation / Hydration Hardening

Goal: make client navigation and hydration predictable under races, failures, and streaming pressure.

Tasks:

- define canonical semantics for stale navigation, request cancellation, late-response discard, form resubmission, scroll restore/reset, and focus restore
- add runtime fixtures and integration tests for `A -> B -> C` navigation races, overlapping loaders, cancellation, and streaming overlap
- add hydration mismatch detection plus controlled recovery tests
- cover partial navigation with preserved form state and focus restoration
- extend browser smoke so it validates multi-route navigation and interactive form behavior
- document the behavior as a product contract rather than incidental implementation detail

Files and surfaces to close:

- `src/runtime/router.ts`
- `tests/runtime/*`
- `tests/integration/*`
- browser/runtime smoke surfaces
- hydration/navigation docs

Exit criteria:

- race and cancellation behavior is deterministic and documented
- hydration edge cases are covered by repeatable tests
- browser smoke confirms the shipped navigation contract

Status:

- closed
- runtime navigation now enforces query-aware route identity, fail-closed guard behavior, deterministic `A -> B -> C` late-response discard, controlled hydration recovery, and preserved form/focus/scroll semantics across push and popstate navigation
- browser smoke and runtime tests validate the shipped contract instead of relying on incidental implementation details

## Stage 2: Reactive Diagnostics / Devtools

Goal: make the reactive runtime observable enough for humans and agents to debug real applications.

Tasks:

- add diagnostics hooks for signal creation/updates, resource lifecycle, mutation lifecycle, and invalidation causes
- add machine-readable trace artifacts for reactive work and recomputation chains
- expose dev-only introspection hooks without weakening production contracts
- integrate reactive traces into `gorsee ai` diagnostics surfaces where it strengthens debugging
- document why reactive work reran and how to interpret waterfall behavior

Files and surfaces to close:

- `src/reactive/*`
- `src/runtime/*`
- `docs/REACTIVE_DEBUGGING.md`
- AI diagnostics and trace docs
- tests for trace correctness and fail-closed behavior

Exit criteria:

- reactive reruns can be explained through artifacts instead of guesswork
- traces are stable enough for tooling and AI consumption
- debug surfaces do not become accidental production APIs

Status:

- baseline closed
- the reactive runtime now ships a versioned machine-readable trace artifact with counters, graph nodes, dependency edges, and ordered lifecycle events
- signal, computed, effect, resource, mutation, and invalidation activity are covered by exported diagnostics APIs and tests
- reactive diagnostics remain dev-only and do not alter production behavior when disabled
- a canonical runtime inspector surface now renders human-readable navigation, hydration, route, and reactive summaries from the same underlying diagnostics artifacts
- `gorsee ai` now ingests saved reactive trace artifacts, while direct live-session ingestion and richer request/cache inspectors remain tracked follow-on work

## Stage 3: Wider CI / Support Matrix

Goal: widen the validated execution surface beyond one OS and one browser happy path.

Tasks:

- expand CI to `ubuntu-latest`, `macos-latest`, and `windows-latest`
- expand browser validation to Chromium, Firefox, and WebKit
- widen provider/runtime evidence for supported deploy targets
- tighten the distinction between supported, validated, and experimental surfaces in docs and policy scripts
- keep NixOS-specific guidance in docs while retaining cross-platform CI as the source of support claims

Files and surfaces to close:

- `.github/workflows/ci.yml`
- `.github/workflows/release-train.yml`
- `docs/SUPPORT_MATRIX.md`
- `scripts/ci-policy-check.mjs`
- `scripts/release-train-check.mjs`

Exit criteria:

- support claims are backed by matrix validation
- browser/runtime/provider evidence is broader than a single path
- documentation and CI remain in exact sync

Status:

- closed
- CI now validates core contract coverage on `ubuntu-latest`, `macos-latest`, and `windows-latest`
- browser smoke now runs against `chromium`, `firefox`, and `webkit`
- support claims, CI policy, and release-train workflows are aligned around the same validated matrix

## Stage 4: Compiler Platform Closure

Goal: finish the move from mixed string glue and split toolchains to a single compiler-backed platform contract.

Tasks:

- audit and remove remaining regex/string-dependent critical paths in docs/build/generation flows
- version generated artifacts and define explicit schemas for machine-consumed outputs
- unify route/docs/typegen/build metadata extraction around canonical compiler/build interfaces
- add schema drift checks for generated artifacts
- preserve the current `oxc` and `rolldown` defaults while reducing leftover transitional glue

Files and surfaces to close:

- `src/compiler/*`
- `src/build/*`
- `src/cli/*`
- generated artifact contracts and tests
- compiler/build policy docs

Exit criteria:

- critical framework artifacts have versioned contracts
- compiler/build internals read as one coherent platform
- correctness no longer depends on fragile string-template structure

Status:

- closed
- versioned route facts and build manifest contracts now anchor the machine-consumed compiler/build surface
- docs, typegen, and build metadata now derive from the same canonical route-facts contract instead of parallel ad hoc shaping
- compiler/build internals now read as one coherent product platform rather than split metadata consumers

## Stage 5: Fixture-App / Adapter / Plugin Conformance

Goal: make downstream extension surfaces testable enough to be trusted as framework contracts.

Tasks:

- introduce a fixture-app harness for app shapes, deploy adapters, plugins, and workspace scenarios
- replace ad hoc temp setups with canonical fixture apps where possible
- add adapter capability tests beyond config/text generation
- add plugin conformance checks for install, config, runtime expectations, and failure semantics
- document downstream validation as an intentional first-class surface

Files and surfaces to close:

- `src/testing/index.ts`
- deploy conformance suites
- plugin conformance suites
- downstream testing docs

Exit criteria:

- downstream surfaces validate through one harness instead of scattered custom setups
- adapters and plugins are tested by execution behavior, not just by emitted files
- ecosystem quality depends on contracts, not tribal discipline

Status:

- closed
- `gorsee/testing` now provides canonical fixture-app, workspace, plugin-conformance, deploy-conformance, and runtime-fixture harnesses
- plugin and downstream tests now consume the shared conformance surface instead of hand-written setup paths where practical
- downstream validation is documented as an intentional framework surface rather than incidental test glue

## Stage 6: Performance Evidence on Realistic Apps

Goal: replace general performance claims with repeatable evidence on realistic application shapes.

Tasks:

- define canonical app-shape benchmarks for content pages, multi-island dashboards, resource-heavy routes, mutation-heavy UIs, and workspace-scale apps
- measure hydration cost, navigation latency, SSR/render time, resource contention, and mutation rollback pressure
- add regression gates for the most important metrics
- connect benchmark evidence to release and promotion policy where claims depend on it
- close the currently documented evidence gaps only when real measurements exist

Files and surfaces to close:

- benchmark scripts and fixture apps
- `docs/REACTIVE_MEASUREMENT_GAPS.md`
- benchmark docs and evidence policy
- CI gates for any promoted metrics

Exit criteria:

- performance claims are backed by repeatable realistic measurements
- regressions are caught automatically
- benchmark docs describe current evidence rather than aspirations

Status:

- baseline closed
- realistic app-shape evidence is now represented through the canonical `benchmarks/realworld` machine-readable artifact surface
- benchmark policy and release discipline now require structured evidence for realistic full-stack performance claims
- benchmark docs now describe concrete evidence surfaces instead of only listing open gaps
- promoted realistic metrics now also carry a machine-readable regression gate, while broader hydration/resource/mutation evidence still remains tracked in `docs/REACTIVE_MEASUREMENT_GAPS.md`

## Stage 7: DX / CLI Product Closure

Goal: make scaffolding, docs, upgrade, and project audit commands behave like deliberate framework contracts instead of lightweight helpers.

Tasks:

- move generated CRUD scaffolds onto typed routes, validated forms, and project-aware data modes
- emit machine-readable docs artifacts that preserve route contract details for tools and CI
- turn `gorsee upgrade` into a migration audit surface with structured reports
- extend `gorsee check` so it validates canonical TSX compiler settings in addition to security and dependency rules
- document CLI behavior as stable product surface rather than incidental ergonomics

Files and surfaces to close:

- `src/cli/cmd-generate.ts`
- `src/cli/cmd-docs.ts`
- `src/cli/cmd-upgrade.ts`
- `src/cli/cmd-check.ts`
- CLI docs and tests

Exit criteria:

- generated app code defaults to the canonical form/route/data contracts
- docs and upgrade commands emit structured artifacts suitable for tools
- CLI checks catch canonical project drift before release
- documentation and tests describe the shipped CLI behavior exactly

Status:

- closed
- `gorsee generate` now emits typed-route and validated-form CRUD scaffolds with inferred `memory`, `sqlite`, or `postgres` repository contracts
- `gorsee docs --format json --contracts` now emits a versioned machine-readable artifact with route facts and summary metadata
- `gorsee upgrade --rewrite-imports --check --report` now performs migration-audit checks, rewrites obvious import/loader drift, and can persist a structured upgrade report
- `gorsee check` now validates canonical TSX compiler settings in addition to the existing security, dependency, and origin policy checks

## Stage 8: Market-Ready Proof

Goal: make market-facing maturity claims traceable to canonical proof surfaces instead of scattered examples and benchmark references.

Tasks:

- define one machine-readable proof catalog for examples, benchmark proof-of-shape, and adoption surfaces
- connect migration and rollout docs to explicit proof surfaces
- keep comparison and adoption language tied to shipped examples and benchmark packages
- enforce the proof layer through a repository policy check instead of relying on tribal memory

Files and surfaces to close:

- `proof/proof-catalog.json`
- `scripts/proof-surface-check.mjs`
- example, migration, rollout, and proof docs

Exit criteria:

- the framework has an explicit catalog of canonical proof surfaces
- migration and rollout guidance reference those surfaces directly
- repository policy fails when proof docs and proof catalog drift apart

Status:

- closed
- `proof/proof-catalog.json` now anchors the canonical SaaS, content, ops, reference-app, and workspace proof surfaces
- migration and rollout docs now point to proof catalog entries and benchmark reference surfaces instead of generic adoption language
- `bun run proof:policy` now enforces the market-ready proof layer as a product contract

## Implementation Order

1. Stage 1: Navigation / Hydration Hardening
2. Stage 2: Reactive Diagnostics / Devtools
3. Stage 3: Wider CI / Support Matrix
4. Stage 4: Compiler Platform Closure
5. Stage 5: Fixture-App / Adapter / Plugin Conformance
6. Stage 6: Performance Evidence on Realistic Apps
7. Stage 7: DX / CLI Product Closure
8. Stage 8: Market-Ready Proof

Rationale:

- correctness first
- observability second
- support breadth after correctness and observability
- platform closure after runtime expectations are stable
- ecosystem conformance after core contracts are explicit
- performance gates last, so they measure the right architecture

## Non-Goals

- chasing parity with every ecosystem pattern
- adding multiple competing ways to solve the same core task
- reintroducing heavy dependencies or VDOM-centric architecture
- broadening the framework faster than it can be hardened
