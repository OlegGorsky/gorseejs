# app

Built with Gorsee.js — AI-first reactive full-stack TypeScript framework.

This project inherits Gorsee's product model:

- deterministic collaboration between humans and coding agents
- strict client/server boundaries
- reactive runtime without VDOM baggage
- security and deploy behavior treated as framework contracts

Treat this app as a product codebase, not as a disposable scaffold.

## Getting Started

```bash
bun install
bun run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Choose Your App Class

- Secure SaaS App
- Content / Marketing Site
- Agent-Aware Internal Tool
- Workspace / Monorepo App

Use the Gorsee docs to pick one clear path before expanding architecture.

## Commands

| Command | Description |
|---------|-------------|
| `bun run dev` | Start dev server with HMR |
| `bun run build` | Production build |
| `bun run start` | Start production server |
| `bun run check` | Type check + safety audit |
| `bunx gorsee ai doctor` | Summarize AI diagnostics and incidents |
| `bunx gorsee ai tail --limit 20` | Inspect recent structured AI events |
| `bunx gorsee ai export --format markdown` | Generate a compact AI context packet |
| `bunx gorsee ai export --bundle --format markdown` | Generate an AI packet with focused code snippets |
| `bunx gorsee ai ide-sync` | Write IDE-friendly diagnostics/events/context files |
| `bunx gorsee routes` | Show route table |
| `bunx gorsee generate <entity>` | CRUD scaffold |
| `bunx gorsee typegen` | Generate typed routes |
| `bunx gorsee migrate` | Run DB migrations |

## Import Boundaries

- Use `gorsee/client` for route components, islands, links, forms, and reactive primitives.
- Use `gorsee/server` for loaders, middleware, auth, db, cache, RPC, security, env, and logging.
- Do not use root `gorsee` in new code. It exists only as a compatibility entrypoint.

## Security Notes

- `routeCache()` varies by `Cookie` and `Authorization` by default. Disable that only for explicitly public responses.
- `/api/_rpc/*` is a separate boundary. Protect it through `security.rpc.middlewares` in `app.config.ts` or via programmatic server options.
- Replace any `APP_ORIGIN` placeholders in deploy configs before shipping. `gorsee check --strict` flags placeholder origins and floating runtime dependency versions.

## AI Notes

- AI observability is opt-in. Enable `ai.enabled` in `app.config.ts` when you want machine-readable runtime/build/check events.
- The default local sink is `.gorsee/ai-events.jsonl`. This is the stable source for agents, IDE tooling, and later summarization.
- Versioned AI packet, IDE projection, and session-pack expectations are documented in `docs/AI_ARTIFACT_CONTRACT.md` in the Gorsee repository.
- `ai.bridge.url` is optional. Use it only for a trusted local IDE/agent bridge; bridge failures never block the main app.
- `bunx gorsee ai mcp` starts a local stdio MCP server over the same AI state, so agents can read diagnostics without scraping logs.
- `bunx gorsee ai doctor` groups repeated failures into incident clusters so you can distinguish one-off errors from systemic regressions.
- `bunx gorsee ai ide-sync` writes `.gorsee/ide/diagnostics.json`, `.gorsee/ide/events.json`, and `.gorsee/ide/context.md` for editor integrations.
- `bunx gorsee ai ide-sync --watch` keeps those files fresh for live IDE diagnostics.
- `bunx gorsee ai pack` writes the latest agent-ready session pack to `.gorsee/agent/latest.{json,md}`.
- `bun run ai:package:vscode` stages and packages the VS Code/Cursor extension consumer.
- `bun run release:extension` emits a version-locked VSIX artifact for editor release/distribution.

## Project Structure

```
routes/          → pages and API routes (file-based routing)
  index.tsx      → /
  about.tsx      → /about
  api/health.ts  → /api/health (JSON API)
  _layout.tsx    → wraps all pages
  _error.tsx     → error boundary
  404.tsx        → custom 404
shared/          → shared modules (imported by routes)
middleware/      → global middleware
migrations/      → SQL migration files
public/          → static assets (served as-is)
```

## Learn More

See `FRAMEWORK.md` for the full API reference (AI-friendly).

Use `docs/CANONICAL_RECIPES.md` in the Gorsee repository when you want the recommended production path for SaaS apps, content sites, internal tools, or workspace-based apps.

For common runtime/setup mistakes, also use `docs/RUNTIME_FAILURES.md`, `docs/RUNTIME_TRIAGE.md`, `docs/CACHE_INVALIDATION.md`, and `docs/STARTER_FAILURES.md` in the Gorsee repository.

For AI-first team workflows, also use `docs/AI_WORKFLOWS.md`, `docs/AI_IDE_SYNC_WORKFLOW.md`, `docs/AI_MCP_WORKFLOW.md`, `docs/AI_BRIDGE_WORKFLOW.md`, `docs/AI_SESSION_PACKS.md`, and `docs/AI_DEBUGGING_WORKFLOWS.md` in the Gorsee repository.

For adoption and rollout guidance, also use `docs/STARTER_ONBOARDING.md`, `docs/MIGRATION_GUIDE.md`, `docs/UPGRADE_PLAYBOOK.md`, `docs/DEPLOY_TARGET_GUIDE.md`, `docs/FIRST_PRODUCTION_ROLLOUT.md`, `docs/AUTH_CACHE_DATA_PATHS.md`, `docs/RECIPE_BOUNDARIES.md`, `docs/WORKSPACE_ADOPTION.md`, and `docs/TEAM_FAILURES.md` in the Gorsee repository.
