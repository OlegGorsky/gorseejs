# Gorsee.js

AI-first reactive full-stack TypeScript framework and application platform for deterministic collaboration between humans and coding agents across frontend, fullstack, and server systems.

Gorsee is not a pet project, not a research toy, and not a bundle of optional recipes. It is a product-grade platform with strict runtime contracts, built-in security boundaries, fine-grained reactivity, and AI-native developer tooling.

## Product Direction

Gorsee is built around four non-negotiable product goals:

- AI-first development: the platform must be predictable for coding agents, not only ergonomic for humans.
- Deterministic architecture: one clear way beats many inconsistent ways.
- Reactive execution: fine-grained reactivity, islands, and minimal client JavaScript over VDOM-heavy legacy models.
- Built-in guarantees: auth, request policy, cache boundaries, diagnostics, and deploy contracts are framework properties, not scattered ecosystem recipes.

Read the strategic docs:

- [Product Vision](./docs/PRODUCT_VISION.md)
- [Framework Doctrine](./docs/FRAMEWORK_DOCTRINE.md)
- [Application Modes](./docs/APPLICATION_MODES.md)
- [Security Model](./docs/SECURITY_MODEL.md)
- [Top-Tier Roadmap](./docs/TOP_TIER_ROADMAP.md)
- [Canonical Language Plan](./docs/CANONICAL_LANGUAGE_PLAN.md)
- [Canonical Recipes](./docs/CANONICAL_RECIPES.md)
- [Canonical Examples](./examples/README.md)
- [Examples Policy](./docs/EXAMPLES_POLICY.md)
- [Reactive Runtime](./docs/REACTIVE_RUNTIME.md)
- [Reactive Benchmarks](./docs/REACTIVE_BENCHMARKS.md)
- [Reactive Patterns](./docs/REACTIVE_PATTERNS.md)
- [Reactive Hydration](./docs/REACTIVE_HYDRATION.md)
- [Reactive Debugging](./docs/REACTIVE_DEBUGGING.md)
- [Reactive Measurement Gaps](./docs/REACTIVE_MEASUREMENT_GAPS.md)
- [Benchmark Policy](./docs/BENCHMARK_POLICY.md)
- [Benchmark Contract](./docs/BENCHMARK_CONTRACT.json)
- [Benchmark Methodology](./docs/BENCHMARK_METHODOLOGY.md)
- [SSR Benchmark Proof](./docs/SSR_BENCHMARK_PROOF.md)
- [DOM Benchmark Proof](./docs/DOM_BENCHMARK_PROOF.md)
- [Benchmark Artifacts](./docs/BENCHMARK_ARTIFACTS.md)
- [Benchmark Release Discipline](./docs/BENCHMARK_RELEASE_DISCIPLINE.md)
- [Build Diagnostics](./docs/BUILD_DIAGNOSTICS.md)
- [Deploy Contract](./docs/DEPLOY_CONTRACT.json)
- [Diagnostics Contract](./docs/DIAGNOSTICS_CONTRACT.json)
- [Runtime Security Contract](./docs/RUNTIME_SECURITY_CONTRACT.json)
- [Runtime Failures](./docs/RUNTIME_FAILURES.md)
- [Cache Invalidation](./docs/CACHE_INVALIDATION.md)
- [Streaming and Hydration Failures](./docs/STREAMING_HYDRATION_FAILURES.md)
- [Runtime Triage](./docs/RUNTIME_TRIAGE.md)
- [Starter Failures](./docs/STARTER_FAILURES.md)
- [AI Workflows](./docs/AI_WORKFLOWS.md)
- [AI IDE Sync Workflow](./docs/AI_IDE_SYNC_WORKFLOW.md)
- [AI MCP Workflow](./docs/AI_MCP_WORKFLOW.md)
- [AI Bridge Workflow](./docs/AI_BRIDGE_WORKFLOW.md)
- [AI Tool Builders](./docs/AI_TOOL_BUILDERS.md)
- [AI Surface Stability](./docs/AI_SURFACE_STABILITY.md)
- [AI Session Packs](./docs/AI_SESSION_PACKS.md)
- [AI Debugging Workflows](./docs/AI_DEBUGGING_WORKFLOWS.md)
- [Starter Onboarding](./docs/STARTER_ONBOARDING.md)
- [Market-Ready Proof](./docs/MARKET_READY_PROOF.md)
- [Adoption Proof Manifest](./docs/ADOPTION_PROOF_MANIFEST.json)
- [Release Contract](./docs/RELEASE_CONTRACT.json)
- [Migration Guide](./docs/MIGRATION_GUIDE.md)
- [Upgrade Playbook](./docs/UPGRADE_PLAYBOOK.md)
- [Deploy Target Guide](./docs/DEPLOY_TARGET_GUIDE.md)
- [First Production Rollout](./docs/FIRST_PRODUCTION_ROLLOUT.md)
- [Auth / Cache / Data Paths](./docs/AUTH_CACHE_DATA_PATHS.md)
- [Recipe Boundaries](./docs/RECIPE_BOUNDARIES.md)
- [Workspace Adoption](./docs/WORKSPACE_ADOPTION.md)
- [Downstream Testing](./docs/DOWNSTREAM_TESTING.md)
- [Test Coverage Audit](./docs/TEST_COVERAGE_AUDIT.md)
- [Team Failures](./docs/TEAM_FAILURES.md)
- [Maturity Policy](./docs/MATURITY_POLICY.md)
- [Top-Tier Exit Gate](./docs/TOP_TIER_EXIT_GATE.md)
- [Dependency Policy](./docs/DEPENDENCY_POLICY.md)
- [Dependency Contract](./docs/DEPENDENCY_CONTRACT.json)
- [Compatibility Guardrails](./docs/COMPATIBILITY_GUARDRAILS.md)
- [Ambiguity Policy](./docs/AMBIGUITY_POLICY.md)
- [DX Feedback Loop](./docs/DX_FEEDBACK_LOOP.md)
- [Evidence Policy](./docs/EVIDENCE_POLICY.md)
- [Roadmap Completion Policy](./docs/ROADMAP_COMPLETION_POLICY.md)

## Canonical Modes

Gorsee ships one product with three canonical application modes:

- `frontend` for browser-first prerendered apps deployed to static-capable targets
- `fullstack` for the canonical Gorsee route/runtime model across UI + server execution
- `server` for API-first and service-oriented systems without mandatory browser surfaces

Set the mode explicitly in `app.config.ts`:

```ts
export default {
  app: {
    mode: "fullstack",
  },
}
```

`fullstack` remains the default when `app.mode` is omitted.

High-level mode guidance:

- `frontend` builds browser-first prerendered output and should prefer static-capable deploy targets.
- `fullstack` keeps the canonical Gorsee route/runtime model and can target Bun, Node, or worker-style deploy adapters.
- `server` focuses on API-first and service-oriented systems with process/runtime ownership kept explicit.
- `server` mode should prefer `gorsee worker` for canonical long-running worker and service entry execution.

## Quick Start

```bash
bunx gorsee create my-app --template secure-saas
cd my-app
bun install
bun run dev
```

Worker-first server path:

```bash
bunx gorsee create my-service --template worker-service
cd my-service
bun install
bun run worker
```

Canonical worker CLI path for server-mode apps:

```bash
gorsee worker
gorsee worker --entry workers/custom.ts
```

Alternative bootstrap paths:

```bash
npx create-gorsee my-app
npm create gorsee@latest my-app
```

Open [http://localhost:3000](http://localhost:3000).

For agent cold-start context:

```bash
bunx gorsee ai framework --format markdown
```

## Why Gorsee

Most modern frameworks optimize for flexibility, historical compatibility, or ecosystem breadth.
Gorsee optimizes for deterministic delivery by humans and AI agents working in the same codebase.

What that means in practice:

- strict client/server import boundaries
- explicit request classification and security policy
- fail-closed production origin model
- small reactive runtime without VDOM baggage
- route-scoped hydration through islands
- optimized image rendering with remote allowlists, srcset generation, and format-aware loaders
- structured form actions with field/form error handling and typed coercion
- explicit data queries and mutations with keyed invalidation over the reactive runtime
- typed route builders with params, query strings, and reusable route definitions
- locale negotiation, fallback dictionaries, Intl formatting, and locale-aware route helpers
- content collections with nested frontmatter parsing, schema validation, excerpts, block-scalar support, and locale-aware querying
- deterministic plugin platform with capabilities, dependency ordering, config validation, and conformance testing
- AI diagnostics, saved reactive-trace ingestion, context bundles, IDE projections, and MCP integration built into the framework lifecycle
- canonical cold-start framework packets via `gorsee ai framework`
- CLI enforcement through `gorsee check`, release gates, deploy contracts, and policy docs
- machine-readable public API stability enforcement through `bun run api:policy`
- machine-readable adoption and market-ready proof enforcement through `bun run adoption:policy`
- machine-readable dependency/runtime support enforcement through `bun run dependency:policy`
- machine-readable deploy/runtime profile enforcement through `bun run deploy:policy`
- machine-readable benchmark evidence enforcement through `bun run benchmarks:policy`
- machine-readable runtime/security contract enforcement through `bun run runtime:security:policy`
- machine-readable diagnostics and triage contract enforcement through `bun run runtime:policy`
- critical runtime/release regression enforcement through `bun run critical:surface` and `bun run test:critical-surface`
- repository-level coverage enforcement through `bun run coverage:audit`

Critical Surface Suite:

- `bun run critical:surface` keeps the documented regression gate aligned across package scripts, CI, support claims, and coverage docs.
- `bun run test:critical-surface` runs the highest-risk runtime/security/reactive/AI/publish regressions that must fail closed before release.

## Core Ideas

### AI-first development

The framework must be easy for an agent to reason about:

- deterministic project layout
- narrow public surfaces
- explicit runtime contracts
- strong defaults over open-ended composition
- observability artifacts that can be consumed by tools and models

### Reactive-first runtime

Gorsee follows a fine-grained reactive model closer to Solid than to React:

- signals instead of VDOM diffing
- direct SSR rendering
- explicit hydration model
- islands for minimal client JavaScript

```tsx
import { island, createSignal } from "gorsee/client"

export default island(function LikeButton() {
  const [count, setCount] = createSignal(0)
  return <button on:click={() => setCount((value) => value + 1)}>Like {count()}</button>
})
```

### Built-in guarantees

Capabilities are not bolt-on features. They are part of the framework contract:

- auth and session stores
- request policy and security validation
- route cache with explicit intent
- single-instance defaults plus explicit multi-instance runtime contracts
- type-safe route generation
- validated forms
- deploy adapters with provider assumptions
- AI observability and bridge tooling

## Canonical Route Grammar

For greenfield route modules, prefer this structure:

- `default export` for page UI
- `load` for route data reads
- `action` for page-bound mutations
- `cache` for declarative cache policy
- `middleware` for cross-cutting request policy
- `GET` / `POST` / other method handlers for raw HTTP endpoints
- route contracts from `gorsee/routes` for typed links and navigation

Compatibility note: `loader` remains supported as a migration alias, but canonical route modules should use `load`.

## Public Entrypoints

```tsx
import { createSignal, island, Link, Head } from "gorsee/client"
import { createAuth } from "gorsee/auth"
import { createDB } from "gorsee/db"
import { cors } from "gorsee/security"
import { log } from "gorsee/log"
import { defineForm, useFormAction } from "gorsee/forms"
import { createTypedRoute } from "gorsee/routes"
```

```tsx
const userRoute = createTypedRoute("/users/[id]")

<Link href={userRoute} params={{ id: "42" }}>Profile</Link>
```

- Use `gorsee/client` for route components and browser-safe APIs.
- Use `gorsee/server` for `load`, `action`, middleware, API routes, cache, request policy, and server runtime orchestration.
- Prefer scoped stable subpaths such as `gorsee/auth`, `gorsee/db`, `gorsee/security`, `gorsee/ai`, `gorsee/forms`, `gorsee/routes`, `gorsee/i18n`, and `gorsee/content` when the concern is already clear.
- Keep root `gorsee` only for compatibility. New code should not depend on it.
- Use `gorsee/compat` only for explicit legacy migration semantics.
- `Link` prefetch is explicit: `prefetch={true}` is eager, `prefetch="hover"` is pointer/focus triggered, and `prefetch="viewport"` is IntersectionObserver-driven. Links without `prefetch` do not prefetch implicitly.

## Multi-Instance Runtime

- Gorsee defaults remain safe for single-node apps, but multi-instance deployments must be declared explicitly with `runtime.topology = "multi-instance"` in `app.config.ts`.
- In multi-instance mode, production runtime fails closed unless `security.rateLimit.limiter` is configured with a distributed backend such as `createRedisRateLimiter(...)`.
- Use `createRedisSessionStore(...)`, `createRedisCacheStore(...)`, and `createRedisJobQueue(...)` for session/cache/jobs when replicas must share state.
- Keep `.gorsee/*` local artifacts for node-local triage, and add `ai.bridge.url` when fleet-level AI event aggregation is required.

## Package Distribution

- workspace development stays Bun-first and source-first
- production build output includes `dist/prod.js` for Bun, `dist/prod-node.js` for Node, and matching Bun/Node server-handler entries for adapter runtimes
- process deploy generators keep Bun-first defaults while also supporting explicit Node runtime profiles for Docker and Fly
- published packages are normalized at `npm pack` / publish time to compiled `dist-pkg/*.js` and `dist-pkg/*.d.ts` artifacts
- packed `gorsee` validates CLI install, starter creation, `check`, `typegen`, `docs`, `build`, and deploy generator paths before release
- published runtime dependencies are treated as product surface and must stay pinned exactly

## Starter Templates

`gorsee create` ships with canonical starters for each official mode:

- `frontend` for browser-first prerendered apps
- `basic` for the minimal canonical scaffold
- `secure-saas` for authenticated SaaS apps with protected route groups
- `content-site` for public content and marketing sites
- `agent-aware-ops` for internal tools with AI-first workflows enabled
- `workspace-monorepo` for workspace layouts with one app package and one shared package
- `server-api` for API-first and service-oriented server apps

Examples:

```bash
bunx gorsee create my-frontend --template frontend
bunx gorsee create my-saas --template secure-saas
bunx gorsee create my-site --template content-site
bunx gorsee create my-ops --template agent-aware-ops
bunx gorsee create my-workspace --template workspace-monorepo
bunx gorsee create my-service --template server-api
npx create-gorsee my-app
npm create gorsee@latest my-app
```

## CLI

| Command | Description |
|---------|-------------|
| `gorsee create <name> [--template <name>]` | Scaffold a new project from the canonical starter set |
| `gorsee dev` | Start development server with HMR |
| `gorsee build` | Build client and server output |
| `gorsee start` | Start production runtime |
| `gorsee start --runtime node` | Start the built Node production runtime entry |
| `gorsee check [--rewrite-imports] [--rewrite-loaders]` | Type, structure, TSX contract, and safety audit, with optional canonical autofix |
| `gorsee routes` | Show route table |
| `gorsee generate <entity>` | Generate CRUD scaffold with typed routes, validated forms, and inferred `memory|sqlite|postgres` data mode |
| `gorsee docs --format json --contracts` | Emit machine-readable route/docs contract artifact |
| `gorsee upgrade` | Upgrade to the latest published Gorsee version, rewrite obvious migration drift, write `docs/upgrade-report.json`, and run verification |
| `gorsee typegen` | Generate typed routes |
| `gorsee migrate` | Run database migrations |
| `gorsee deploy` | Generate deploy config for supported targets, with `--runtime bun|node` on process-based adapters |
| `gorsee ai` | AI diagnostics, bridge, IDE sync, export, and MCP tooling |

Runtime debugging surface:

- `createRuntimeDevtoolsSnapshot()` for a versioned inspector snapshot spanning router, hydration, and reactive diagnostics
- `renderRuntimeDevtoolsHTML()` / `renderRuntimeDevtoolsOverlay()` for a human-readable devtools view built from the same canonical artifacts

Migration ergonomics:

- `gorsee check --rewrite-imports --rewrite-loaders` can normalize obvious scoped-import and `loader -> load` drift before the audit runs.
- `gorsee upgrade` is the canonical end-to-end upgrade flow for installed apps.
- `gorsee upgrade --check --report docs/upgrade-report.json` is the dry-run migration audit flow when you want review before installation.

## Product Standards

- Production behavior must remain deterministic across dev and prod.
- Security-sensitive behavior must be explicit, testable, and fail-closed.
- New APIs must strengthen the framework contract, not widen ambiguity.
- Performance claims must be backed by benchmarks and reproducible examples.
- Gorsee is developed as a mature product. Regressions in policy, runtime contracts, or release discipline are product failures.

## Additional References

- [API Stability Policy](./docs/API_STABILITY.md)
- [AI Artifact Contract](./docs/AI_ARTIFACT_CONTRACT.md)
- [Reactive Runtime](./docs/REACTIVE_RUNTIME.md)
- [Reactive Benchmarks](./docs/REACTIVE_BENCHMARKS.md)
- [Reactive Patterns](./docs/REACTIVE_PATTERNS.md)
- [Reactive Hydration](./docs/REACTIVE_HYDRATION.md)
- [Reactive Debugging](./docs/REACTIVE_DEBUGGING.md)
- [Reactive Measurement Gaps](./docs/REACTIVE_MEASUREMENT_GAPS.md)
- [Benchmark Policy](./docs/BENCHMARK_POLICY.md)
- [Benchmark Methodology](./docs/BENCHMARK_METHODOLOGY.md)
- [SSR Benchmark Proof](./docs/SSR_BENCHMARK_PROOF.md)
- [DOM Benchmark Proof](./docs/DOM_BENCHMARK_PROOF.md)
- [Benchmark Artifacts](./docs/BENCHMARK_ARTIFACTS.md)
- [Benchmark Release Discipline](./docs/BENCHMARK_RELEASE_DISCIPLINE.md)
- [Build Diagnostics](./docs/BUILD_DIAGNOSTICS.md)
- [Runtime Failures](./docs/RUNTIME_FAILURES.md)
- [Cache Invalidation](./docs/CACHE_INVALIDATION.md)
- [Streaming and Hydration Failures](./docs/STREAMING_HYDRATION_FAILURES.md)
- [Runtime Triage](./docs/RUNTIME_TRIAGE.md)
- [Starter Failures](./docs/STARTER_FAILURES.md)
- [AI Workflows](./docs/AI_WORKFLOWS.md)
- [AI IDE Sync Workflow](./docs/AI_IDE_SYNC_WORKFLOW.md)
- [AI MCP Workflow](./docs/AI_MCP_WORKFLOW.md)
- [AI Bridge Workflow](./docs/AI_BRIDGE_WORKFLOW.md)
- [AI Tool Builders](./docs/AI_TOOL_BUILDERS.md)
- [AI Surface Stability](./docs/AI_SURFACE_STABILITY.md)
- [AI Session Packs](./docs/AI_SESSION_PACKS.md)
- [AI Debugging Workflows](./docs/AI_DEBUGGING_WORKFLOWS.md)
- [Starter Onboarding](./docs/STARTER_ONBOARDING.md)
- [Migration Guide](./docs/MIGRATION_GUIDE.md)
- [Upgrade Playbook](./docs/UPGRADE_PLAYBOOK.md)
- [Deploy Target Guide](./docs/DEPLOY_TARGET_GUIDE.md)
- [First Production Rollout](./docs/FIRST_PRODUCTION_ROLLOUT.md)
- [Auth / Cache / Data Paths](./docs/AUTH_CACHE_DATA_PATHS.md)
- [Recipe Boundaries](./docs/RECIPE_BOUNDARIES.md)
- [Workspace Adoption](./docs/WORKSPACE_ADOPTION.md)
- [Downstream Testing](./docs/DOWNSTREAM_TESTING.md)
- [Team Failures](./docs/TEAM_FAILURES.md)
- [Maturity Policy](./docs/MATURITY_POLICY.md)
- [Dependency Policy](./docs/DEPENDENCY_POLICY.md)
- [Compatibility Guardrails](./docs/COMPATIBILITY_GUARDRAILS.md)
- [Ambiguity Policy](./docs/AMBIGUITY_POLICY.md)
- [DX Feedback Loop](./docs/DX_FEEDBACK_LOOP.md)
- [Evidence Policy](./docs/EVIDENCE_POLICY.md)
- [Roadmap Completion Policy](./docs/ROADMAP_COMPLETION_POLICY.md)
- [Canonical Recipes](./docs/CANONICAL_RECIPES.md)
- [Canonical Examples](./examples/README.md)
- [Examples Policy](./docs/EXAMPLES_POLICY.md)
- [Support Matrix](./docs/SUPPORT_MATRIX.md)
- [Deprecation Policy](./docs/DEPRECATION_POLICY.md)
- [Secure Patterns](./docs/SECURE_PATTERNS.md)
- [Adapter Security](./docs/ADAPTER_SECURITY.md)
- [CI Policy](./docs/CI_POLICY.md)
- [Release Policy](./docs/RELEASE_POLICY.md)
- [Release Checklist](./docs/RELEASE_CHECKLIST.md)
