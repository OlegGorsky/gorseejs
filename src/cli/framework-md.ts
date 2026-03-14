// Generates FRAMEWORK.md -- AI context file optimized for LLM consumption

export function generateFrameworkMD(projectName: string): string {
  return `# ${projectName} -- Gorsee.js Framework Reference

> This file is auto-generated. It provides complete context for AI assistants.
> Include this file in your AI context window for best results.

## Product Identity

Gorsee is an AI-first application platform designed for deterministic collaboration between humans and coding agents across frontend, fullstack, and server systems.

Treat it as a mature product framework:

- not a pet project
- not a toy runtime
- not a loose collection of optional recipes

The framework prefers one clear path, strict contracts, and product-grade discipline over flexibility for its own sake.

Canonical modes:

- \`frontend\` for browser-first prerendered apps
- \`fullstack\` for the canonical UI + server path
- \`server\` for API-first and service-oriented systems

## Quick Reference

\`\`\`
Runtime: Bun | Language: TypeScript + JSX | Reactivity: Signals (no VDOM)
\`\`\`

## Project Structure

\`\`\`
routes/          Page and API routes (file-based routing)
  index.ts       / (home page)
  about.tsx      /about
  users/
    index.tsx    /users
    [id].tsx     /users/:id (dynamic)
  api/
    health.ts    API endpoint (no UI)
  _layout.tsx    Layout wrapper for folder
  _middleware.ts Middleware for folder
shared/          Shared types and utilities
middleware/      Global middleware
migrations/      Database migrations (SQL)
public/          Static files
app.config.ts    Configuration
\`\`\`

## Imports

\`\`\`typescript
// Browser-safe route code
import { createSignal, createComputed, createEffect, createResource, createStore } from "gorsee/client"

// Server runtime contracts
import { server, middleware, type Context } from "gorsee/server"

// Domain-focused server surfaces
import { createDB } from "gorsee/db"
import { createAuth } from "gorsee/auth"
import { cors } from "gorsee/security"
import { log } from "gorsee/log"
\`\`\`

## Import Boundaries

- \`gorsee/client\` for route components, islands, navigation, forms, and reactive primitives
- \`gorsee/server\` for middleware, \`load\`, \`action\`, RPC, cache, and route execution
- prefer scoped subpaths such as \`gorsee/auth\`, \`gorsee/db\`, \`gorsee/security\`, \`gorsee/env\`, and \`gorsee/log\` when the concern is already domain-specific
- Root \`gorsee\` is compatibility-only and should not be used in new code
- \`gorsee/compat\` is available as an explicit legacy migration entrypoint

## Engineering Doctrine

- Prefer deterministic architecture over multiple equivalent patterns.
- Prefer built-in framework guarantees over handwritten recipes.
- Preserve fine-grained reactivity and avoid VDOM-style architectural drift.
- Treat security, deploy assumptions, and AI diagnostics as part of the framework contract.
- If a pattern must exist, it should be easy for both humans and agents to infer from structure and docs.

## Adapter Recipes

\`\`\`typescript
import { createClient } from "redis"
import {
  createRedisSessionStore,
  createRedisCacheStore,
  createNodeRedisLikeClient,
  routeCache,
} from "gorsee/server"
import { createAuth } from "gorsee/auth"
import { createCSRFMiddleware } from "gorsee/security"

const redis = createClient({ url: process.env.REDIS_URL })
await redis.connect()
const redisClient = createNodeRedisLikeClient(redis)

const auth = createAuth({
  secret: process.env.SESSION_SECRET!,
  store: createRedisSessionStore(redisClient, { prefix: "app:sessions" }),
})

export const cache = routeCache({
  maxAge: 60,
  staleWhileRevalidate: 300,
  mode: "public", // default mode is private/auth-aware
  store: createRedisCacheStore(redisClient, {
    prefix: "app:cache",
    maxEntryAgeMs: 360_000,
  }),
})
\`\`\`

- SQLite adapters are the default persistent single-node path
- Redis adapters are the default multi-instance path
- Set \`runtime.topology = "multi-instance"\` in \`app.config.ts\` when replicas share traffic; production then requires an explicit distributed \`security.rateLimit.limiter\`
- Use \`createRedisJobQueue()\` for durable cross-replica job execution; when the Redis client exposes sorted-set primitives Gorsee uses indexed due scans and renews long-running execution leases, while \`createMemoryJobQueue()\` remains single-node only
- Queue instances expose \`get(id)\`, \`peek(limit)\`, and \`cancel(id)\` for operator-facing inspection and pre-run cancellation of queued jobs
- Queue instances also expose bounded terminal history via \`recent(limit)\`, dead-letter inspection via \`failures(limit)\`, and controlled recovery with \`retryFailed(id)\`
- Queue lifecycle emits structured AI events: \`job.enqueue\`, \`job.start\`, \`job.retry\`, \`job.complete\`, \`job.fail\`, \`job.cancel\`, and \`job.dead-letter.retry\`
- Use \`defineWorkerService()\` + \`runWorkerService()\` for long-running server-mode workers with explicit ready/heartbeat/stop semantics
- \`createNodeRedisLikeClient()\` and \`createIORedisLikeClient()\` normalize real Redis SDK clients to the framework adapter contract
- \`routeCache()\` defaults to \`mode: "private"\` and varies by \`Cookie\`, \`Authorization\`, \`Accept\`, and \`X-Gorsee-Navigate\`
- Use \`mode: "public"\` or \`mode: "shared"\` only for intentionally non-personalized cache entries
- RPC handlers remain process-local by design; do not try to distribute closures through Redis

## RPC Security

\`\`\`typescript
import { handleRPCRequestWithPolicy } from "gorsee/server"
import { createAuth } from "gorsee/auth"
import { createCSRFMiddleware } from "gorsee/security"

const auth = createAuth({ secret: process.env.SESSION_SECRET! })

const rpcResponse = await handleRPCRequestWithPolicy(request, {
  middlewares: [
    auth.protect(),
    createCSRFMiddleware(process.env.SESSION_SECRET!),
  ],
})
\`\`\`

- RPC is \`POST\`-only
- RPC uses a versioned envelope over \`application/vnd.gorsee-rpc+json\`
- Route \`_middleware.ts\` does not automatically protect \`/api/_rpc/*\`
- Apply auth/CSRF policy explicitly at the RPC boundary

## AI Observability

\`\`\`typescript
export default {
  ai: {
    enabled: true,
    jsonlPath: ".gorsee/ai-events.jsonl",
    diagnosticsPath: ".gorsee/ai-diagnostics.json",
    sessionPack: {
      enabled: true,
      outDir: ".gorsee/agent",
      triggerKinds: ["diagnostic.issue", "request.error", "build.summary", "check.summary"],
    },
    bridge: {
      url: "http://127.0.0.1:4318/gorsee/ai-events",
      timeoutMs: 250,
      events: ["diagnostic.issue", "check.summary", "build.summary", "request.error"],
    },
  },
}
\`\`\`

- AI observability is opt-in and must not change app behavior when disabled
- \`.gorsee/ai-events.jsonl\` is the canonical machine-readable event stream for agents and IDE tooling
- \`.gorsee/ai-diagnostics.json\` keeps the latest error/warning snapshot for fast IDE polling
- \`.gorsee/ide/diagnostics.json\`, \`.gorsee/ide/events.json\`, and \`.gorsee/ide/context.md\` are editor-facing projections produced by \`gorsee ai ide-sync\`
- \`.gorsee/ide/events.json\` now includes \`artifactRegressions\` plus event-level \`artifact\` / \`version\` metadata for release/deploy/build drift
- \`.gorsee/agent/latest.json\` and \`.gorsee/agent/latest.md\` are session packs for agents; \`.gorsee/agent/deploy-summary.json\`, \`.gorsee/agent/release-brief.json\`, \`.gorsee/agent/incident-brief.json\`, and \`.gorsee/agent/incident-snapshot.json\` are grounded operational artifacts written alongside them
- \`gorsee ai doctor\` clusters repeated failures by trace/request/file/route so agents can spot systemic regressions quickly
- \`gorsee ai doctor\` and \`gorsee ai export\` also surface artifact regressions, so agents can reason about broken tarballs, VSIX files, build outputs, and deploy configs without separate tooling
- Bridge delivery is best-effort only; a dead IDE bridge must never fail the request/build/check path
- In multi-instance deployments, keep local \`.gorsee/*\` artifacts for node-local triage and add \`ai.bridge.url\` for fleet-level aggregation
- Event schema carries \`requestId\`, \`traceId\`, \`spanId\`, \`route\`, \`code\`, \`file\`, \`line\`, and \`durationMs\`
- Prefer AI events over scraped console logs when automating analysis
- Use \`gorsee ai export --bundle\` when an agent needs a compact context packet plus root-cause-ranked code snippets
- Use \`gorsee ai pack\` when you want the latest context bundle written to disk for another tool to pick up
- Use \`bun run ai:package:vscode\` to stage and package the VS Code/Cursor extension consumer from \`integrations/vscode-gorsee-ai\`
- Use \`bun run release:extension\` to build a version-locked VSIX release artifact
- In the VS Code/Cursor extension, use \`Gorsee AI: Show Context\` for the full context packet and \`Gorsee AI: Show Artifact Regressions\` for release/deploy/build drift

## Failure References

- Use \`docs/RUNTIME_FAILURES.md\` for common production/runtime failures
- Use \`docs/RUNTIME_TRIAGE.md\` for operator triage flow
- Use \`docs/CACHE_INVALIDATION.md\` before widening cache scope
- Use \`docs/STREAMING_HYDRATION_FAILURES.md\` when streaming or hydration behavior drifts
- Use \`docs/STARTER_FAILURES.md\` for common scaffold/setup mistakes

## AI Workflow References

- Use \`docs/AI_WORKFLOWS.md\` for the overall human + agent operating model
- Use \`docs/AI_IDE_SYNC_WORKFLOW.md\` for editor projections
- Use \`docs/AI_MCP_WORKFLOW.md\` for MCP consumers
- Use \`docs/AI_BRIDGE_WORKFLOW.md\` for local bridge ingestion
- Use \`docs/AI_TOOL_BUILDERS.md\` when building external consumers
- Use \`docs/AI_SURFACE_STABILITY.md\` before changing AI-facing contracts
- Use \`docs/AI_SESSION_PACKS.md\` for cross-session handoff
- Use \`docs/AI_DEBUGGING_WORKFLOWS.md\` for diagnostics-first debugging

## Product DX References

- Use \`docs/STARTER_ONBOARDING.md\` to choose the right app class
- Use \`docs/APPLICATION_MODES.md\` when choosing or changing \`app.mode\`
- Use \`docs/MIGRATION_GUIDE.md\` when cleaning up compatibility imports
- Use \`docs/UPGRADE_PLAYBOOK.md\` before release-channel or contract upgrades
- Use \`docs/DEPLOY_TARGET_GUIDE.md\` before committing to a deploy target
- Use \`docs/FIRST_PRODUCTION_ROLLOUT.md\` for the first real launch
- Use \`docs/AUTH_CACHE_DATA_PATHS.md\` to choose auth/cache/data defaults by app class
- Use \`docs/RECIPE_BOUNDARIES.md\` when a recipe looks stretched beyond its intended shape
- Use \`docs/WORKSPACE_ADOPTION.md\` for monorepo/workspace layouts
- Use \`docs/TEAM_FAILURES.md\` for common team-level adoption mistakes

## Patterns

### Page Route

\`\`\`typescript
// routes/users/index.tsx
import { ssrJsx as h } from "gorsee/runtime"
import { SafeSQL } from "gorsee/types"
import { createDB } from "gorsee/db"

const db = createDB()

export default function UsersPage() {
  const users = db.all<User>(SafeSQL\`SELECT * FROM users\`)
  return h("ul", {
    children: users.map(u => h("li", { children: u.name }))
  })
}
\`\`\`

### Dynamic Route

\`\`\`typescript
// routes/users/[id].tsx
export default function UserPage(props: { params: { id: string } }) {
  const user = db.get<User>(SafeSQL\`SELECT * FROM users WHERE id = \${Number(props.params.id)}\`)
  if (!user) return h("div", { children: "Not found" })
  return h("h1", { children: user.name })
}
\`\`\`

### API Route

\`\`\`typescript
// routes/api/users.ts
import type { Context } from "gorsee/server"

export function GET(ctx: Context): Response {
  return Response.json({ users: [] })
}

export function POST(ctx: Context): Response {
  return Response.json({ created: true }, { status: 201 })
}
\`\`\`

### Route Action

\`\`\`typescript
// routes/users/new.tsx
import { defineForm, defineFormAction } from "gorsee/forms"

const userForm = defineForm<{ name: string }>([
  { name: "name", rules: { required: true }, label: "Name" },
])

export const action = defineFormAction(userForm, async ({ data }) => {
  await db.run(SafeSQL\`INSERT INTO users (name) VALUES (\${data.name})\`)
  return { ok: true, data: { created: true } }
})
\`\`\`

### Middleware

\`\`\`typescript
// routes/_middleware.ts
import { middleware } from "gorsee/server"

export default middleware(async (ctx, next) => {
  const session = ctx.cookies.get("session")
  if (!session) return ctx.redirect("/login")
  ctx.locals.user = await getUser(session)
  return next()
})
\`\`\`

### Signals

\`\`\`typescript
const [count, setCount] = createSignal(0)        // reactive value
const doubled = createComputed(() => count() * 2) // derived
createEffect(() => console.log(count()))          // side effect
const [data] = createResource(fetchData)          // async resource
const [store, setStore] = createStore({ a: 1 })   // reactive object
\`\`\`

### SafeSQL (prevents SQL injection at compile time)

\`\`\`typescript
// OK:
db.get(SafeSQL\`SELECT * FROM users WHERE id = \${id}\`)

// COMPILE ERROR -- string not assignable to SafeSQL:
db.get(\`SELECT * FROM users WHERE id = \${id}\`)
db.get("SELECT * FROM users WHERE id = " + id)
\`\`\`

## Configuration (app.config.ts)

\`\`\`typescript
export default {
  port: 3000,
  db: { driver: "sqlite", url: "./data.sqlite" },
  log: "info",  // off | error | info | verbose | debug
  security: {
    origin: process.env.APP_ORIGIN ?? "https://app.example.com",
    proxy: {
      preset: "none",
      trustForwardedHeaders: false,
      trustedForwardedHops: 1,
    },
    csp: true,
    hsts: true,
    csrf: true,
    rateLimit: { maxRequests: 100, window: "1m" },
  },
  // RPC is a separate boundary from route _middleware.ts
  // security: { rpc: { middlewares: [auth.protect(), createCSRFMiddleware(process.env.SESSION_SECRET!)] } },
  deploy: { target: "bun" },  // bun | cloudflare | deno | node
}
\`\`\`

- Replace placeholder origins in deploy configs and \`security.origin\` before production rollout.
- \`gorsee check --strict\` escalates floating runtime dependency versions and placeholder origin values to errors.

## Security Docs

- \`SECURITY.md\` defines disclosure policy, reporting path, and the rule that security bugs are treated as broken framework invariants.
- \`docs/PRODUCT_VISION.md\` defines the product position and market thesis.
- \`docs/FRAMEWORK_DOCTRINE.md\` defines non-negotiable engineering principles.
- \`docs/TOP_TIER_ROADMAP.md\` defines the maturity roadmap to top-tier framework quality.
- \`docs/CANONICAL_RECIPES.md\` defines the recommended production paths for secure SaaS apps, content sites, internal tools, and workspace-based apps.
- \`docs/API_STABILITY.md\` defines stable, compatibility, experimental, and internal API tiers.
- \`docs/AI_ARTIFACT_CONTRACT.md\` defines versioned AI packet, IDE projection, and session-pack artifact expectations.
- \`docs/SUPPORT_MATRIX.md\` defines what the product currently supports and validates.
- \`docs/DEPRECATION_POLICY.md\` defines how public behavior is deprecated and migrated.
- \`docs/SECURITY_MODEL.md\` defines framework guarantees around request ordering, canonical origin, internal/public boundaries, cache expectations, RPC, and adapter assumptions.
- \`docs/SECURE_PATTERNS.md\` lists preferred and unsafe usage patterns for auth, redirects, cache, RPC, origins, proxy headers, provider presets, dev server exposure, and file serving.
- \`docs/ADAPTER_SECURITY.md\` documents provider-specific deploy assumptions for Vercel, Cloudflare, Netlify, Fly.io, and Docker.
- \`docs/RELEASE_POLICY.md\` defines stable/canary/rc channel rules and the intended release train for security-sensitive changes.
- \`docs/RELEASE_CHECKLIST.md\` defines the operator-facing stable/canary/rc checklist and the invariants that must hold before publishing.
- \`docs/CI_POLICY.md\` defines the required CI gates, change-sensitive rules, release-train validation, and the exact Bun contract used in automation.

## CLI

\`\`\`
gorsee dev          Start dev server
gorsee build        Production build
gorsee check        Type + safety + structure check
gorsee worker       Run canonical server-mode worker entry
gorsee check --rewrite-imports --rewrite-loaders
                    Normalize canonical imports and loader aliases before auditing
gorsee ai init      Scaffold local AI rules, operator guide, and checkpoints
gorsee ai framework Export canonical framework context for cold-start agents
gorsee ai tail      Inspect recent structured AI events
gorsee ai doctor    Summarize AI diagnostics and incidents
gorsee ai replay    Reconstruct recent correlated AI event timeline
gorsee ai export    Export a compact agent-ready context packet
gorsee ai pack      Write the latest grounded AI session pack to disk
gorsee ai checkpoint
                    Record an explicit named AI workflow checkpoint
gorsee ai ide-sync  Write IDE-friendly diagnostics/events/context files
gorsee ai bridge    Accept trusted local AI event ingestion
gorsee ai mcp       Expose local AI state as a stdio MCP server
gorsee routes       List all routes
gorsee migrate      Run database migrations
gorsee generate X   Generate CRUD for entity X
\`\`\`

- For installed apps, prefer \`gorsee upgrade\` for the full version bump + rewrite + verification flow.
- Use \`gorsee upgrade --check --report docs/upgrade-report.json\` for a dry-run audit without installation.
- When AI workflows are enabled, run \`gorsee ai init\` once and tailor \`.gorsee/rules.md\` before the first tracked session.

## Error Codes

| Code | Category | Description |
|------|----------|-------------|
| E001 | SafeSQL | Raw string in SQL query |
| E002 | SafeHTML | Unsanitized HTML |
| E003 | Server | Closure captures client variable |
| E004 | URL | Invalid URL |
| E005 | URL | Disallowed protocol |

## Security (enabled by default)

- CSP with nonce (no inline scripts except framework)
- HSTS (production)
- CSRF tokens (auto for POST)
- Rate limiting (100 req/min default)
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
`
}
