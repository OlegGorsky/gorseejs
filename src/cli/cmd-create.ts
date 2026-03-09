// gorsee create <name> -- scaffold a new project

import { copyFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises"
import { join, relative } from "node:path"
import { fileURLToPath } from "node:url"
import { generateFrameworkMD } from "./framework-md.ts"
import { createProjectContext, type RuntimeOptions } from "../runtime/project.ts"

const DIRS = [
  "routes",
  "routes/api",
  "shared",
  "middleware",
  "migrations",
  "public",
]

const INDEX_ROUTE = `import { createSignal, Head, Link } from "gorsee/client"

export default function HomePage() {
  const [count, setCount] = createSignal(0)

  return (
    <div>
      <Head>
        <title>My Gorsee App</title>
        <meta name="description" content="Built with Gorsee.js" />
      </Head>
      <h1>My Gorsee App</h1>
      <p>Edit routes/index.tsx to get started.</p>
      <nav>
        <Link href="/">Home</Link> | <Link href="/about">About</Link>
      </nav>
      <div>
        <button on:click={() => setCount((c: number) => c + 1)}>Count: {count}</button>
      </div>
    </div>
  )
}
`

const ABOUT_ROUTE = `import { Head, Link } from "gorsee/client"

export default function AboutPage() {
  return (
    <div>
      <Head>
        <title>About - My Gorsee App</title>
      </Head>
      <h1>About</h1>
      <p>This app is built with <strong>Gorsee.js</strong> — a full-stack TypeScript framework.</p>
      <Link href="/">Back to Home</Link>
    </div>
  )
}
`

const LAYOUT = `export default function RootLayout(props: { children: unknown }) {
  return (
    <div class="layout">
      <header>
        <nav class="main-nav">
          <strong>Gorsee App</strong>
        </nav>
      </header>
      <main>{props.children}</main>
      <footer>
        <p>Built with Gorsee.js</p>
      </footer>
    </div>
  )
}
`

const ERROR_PAGE = `export default function ErrorPage(props: { error: Error }) {
  return (
    <div class="error-page">
      <h1>Something went wrong</h1>
      <p>{props.error.message}</p>
      <a href="/">Go back home</a>
    </div>
  )
}
`

const NOT_FOUND_PAGE = `import { Head, Link } from "gorsee/client"

export default function NotFoundPage() {
  return (
    <div>
      <Head><title>404 - Not Found</title></Head>
      <h1>404</h1>
      <p>The page you're looking for doesn't exist.</p>
      <Link href="/">Go back home</Link>
    </div>
  )
}
`

const HEALTH_API = `import type { Context } from "gorsee/server"

export function GET(_ctx: Context): Response {
  return Response.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  })
}
`

const DEFAULT_CSS = `*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,-apple-system,sans-serif;line-height:1.6;color:#1a1a1a;max-width:800px;margin:0 auto;padding:2rem 1rem}
h1{margin-bottom:.5rem}p{margin-bottom:.5rem}
a{color:#2563eb;text-decoration:none}a:hover{text-decoration:underline}
button{background:#2563eb;color:#fff;border:none;padding:.4rem 1rem;border-radius:4px;cursor:pointer;font-size:.9rem}
button:hover{background:#1d4ed8}
.layout{min-height:100vh;display:flex;flex-direction:column}
.layout main{flex:1}
.layout footer{margin-top:2rem;padding-top:1rem;border-top:1px solid #e5e7eb;color:#6b7280;font-size:.85rem}
`

const ENV_EXAMPLE = `# App
PORT=3000
NODE_ENV=development
APP_ORIGIN=http://localhost:3000

# Auth (generate with: openssl rand -hex 32)
SESSION_SECRET=change-me-in-production

# Database
DATABASE_URL=./data.sqlite

# Public vars (exposed to client)
PUBLIC_APP_NAME=My Gorsee App
`

const APP_CONFIG = `export default {
  port: 3000,

  db: {
    driver: "sqlite" as const,
    url: "./data.sqlite",
  },

  log: "info" as const,

  ai: {
    enabled: false,
    // Writes structured events for AI agents and IDE tooling.
    jsonlPath: ".gorsee/ai-events.jsonl",
    diagnosticsPath: ".gorsee/ai-diagnostics.json",
    sessionPack: {
      enabled: true,
      outDir: ".gorsee/agent",
      triggerKinds: ["diagnostic.issue", "request.error", "build.summary", "check.summary"],
    },
    bridge: {
      // Point this at a local IDE bridge or MCP helper when you want live diagnostics.
      url: "http://127.0.0.1:4318/gorsee/ai-events",
      timeoutMs: 250,
      events: ["diagnostic.issue", "check.summary", "build.summary", "request.error"],
    },
  },

  security: {
    // Canonical application origin used for redirect and origin-sensitive checks.
    origin: process.env.APP_ORIGIN ?? "http://localhost:3000",
    proxy: {
      // Use "vercel", "netlify", "fly", or "reverse-proxy" when deployed behind a trusted proxy hop.
      preset: "none" as const,
      trustForwardedHeaders: false,
      trustedForwardedHops: 1,
    },
    csp: true,
    hsts: true,
    csrf: true,
    rateLimit: {
      requests: 100,
      window: "1m",
    },
    rpc: {
      // Add auth/CSRF middleware here when server() calls need protection.
      // Example:
      // middlewares: [auth.protect(), createCSRFMiddleware(process.env.SESSION_SECRET!)],
      middlewares: [],
    },
  },

  deploy: {
    target: "bun" as const,
  },
}
`

const TSCONFIG = `{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "preserve",
    "jsxImportSource": "gorsee",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "types": ["bun"]
  },
  "include": ["routes/**/*.ts", "routes/**/*.tsx", "shared/**/*.ts", "middleware/**/*.ts"]
}
`

const GITIGNORE = `node_modules/
dist/
.gorsee/
.env
.env.local
*.sqlite
*.db
.DS_Store
`

const PACKAGE_MANAGER = "bun@1.3.9"

const CREATE_TEMPLATES = ["basic", "secure-saas", "content-site", "agent-aware-ops", "workspace-monorepo"] as const
type CreateTemplate = typeof CREATE_TEMPLATES[number]

type TemplateDefinition = {
  sourceDir: string
  readmeDescription: string
  readmeHighlights: string[]
  postCreate?: (dir: string, name: string) => Promise<void>
}

const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url))

const TEMPLATE_DEFINITIONS: Record<Exclude<CreateTemplate, "basic">, TemplateDefinition> = {
  "secure-saas": {
    sourceDir: join(REPO_ROOT, "examples/secure-saas"),
    readmeDescription: "Authenticated SaaS starter with protected route groups, explicit auth middleware, and private cache semantics.",
    readmeHighlights: [
      "protected `/app/*` route group with canonical auth middleware",
      "shared auth surface in `auth-shared.ts`",
      "RPC boundary ready for authenticated server workflows",
    ],
  },
  "content-site": {
    sourceDir: join(REPO_ROOT, "examples/content-site"),
    readmeDescription: "Public content starter with prerendered entry pages, explicit public cache policy, and article routes.",
    readmeHighlights: [
      "public cache middleware with explicit auth-header policy",
      "prerendered landing page",
      "blog route shape for content collections",
    ],
  },
  "agent-aware-ops": {
    sourceDir: join(REPO_ROOT, "examples/agent-aware-ops"),
    readmeDescription: "Internal operations starter where AI diagnostics, IDE sync, session packs, and MCP workflows are part of the product surface.",
    readmeHighlights: [
      "`ai.enabled` configured in `app.config.ts`",
      "ops route focused on agent-facing workflows",
      "diagnostics-first baseline for internal tooling",
    ],
  },
  "workspace-monorepo": {
    sourceDir: join(REPO_ROOT, "examples/workspace-monorepo"),
    readmeDescription: "Workspace starter with one Gorsee app package and one shared package, keeping runtime ownership explicit.",
    readmeHighlights: [
      "root workspace with `apps/*` and `packages/*`",
      "web app in `apps/web` using canonical `gorsee` scripts",
      "shared package isolated from runtime ownership",
    ],
    postCreate: async (dir, name) => {
      await writeFile(join(dir, ".gitignore"), GITIGNORE)
      const rootPackageJson = {
        name,
        private: true,
        packageManager: PACKAGE_MANAGER,
        workspaces: ["apps/*", "packages/*"],
      }
      await writeFile(join(dir, "package.json"), JSON.stringify(rootPackageJson, null, 2) + "\n")

      const webPackagePath = join(dir, "apps/web/package.json")
      const webPackageJson = JSON.parse(await readFile(webPackagePath, "utf-8")) as {
        dependencies?: Record<string, string>
        scripts?: Record<string, string>
        name?: string
        private?: boolean
        type?: string
        packageManager?: string
      }
      webPackageJson.name = "@workspace/web"
      webPackageJson.private = true
      webPackageJson.type = "module"
      webPackageJson.packageManager = PACKAGE_MANAGER
      webPackageJson.scripts = createPackageScripts()
      webPackageJson.dependencies = {
        gorsee: "latest",
        "@workspace/shared": "workspace:*",
      }
      await writeFile(webPackagePath, JSON.stringify(webPackageJson, null, 2) + "\n")

      const sharedPackagePath = join(dir, "packages/shared/package.json")
      const sharedPackageJson = JSON.parse(await readFile(sharedPackagePath, "utf-8")) as Record<string, unknown>
      sharedPackageJson.name = "@workspace/shared"
      sharedPackageJson.version = "0.0.0"
      sharedPackageJson.type = "module"
      sharedPackageJson.exports = "./index.ts"
      await writeFile(sharedPackagePath, JSON.stringify(sharedPackageJson, null, 2) + "\n")

      const routePath = join(dir, "apps/web/routes/index.tsx")
      const routeSource = await readFile(routePath, "utf-8")
      await writeFile(routePath, routeSource.replaceAll("@example/shared", "@workspace/shared"))
    },
  },
}

function createPackageScripts() {
  return {
    dev: "gorsee dev",
    build: "gorsee build",
    start: "gorsee start",
    check: "gorsee check",
  }
}

function normalizePackageName(name: string) {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return normalized || "gorsee-app"
}

function parseCreateArgs(args: string[]) {
  let template: CreateTemplate = "basic"
  const positional: string[] = []

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]
    if (!arg) continue

    if (arg === "--template" || arg === "-t") {
      const value = args[i + 1]
      if (!value) {
        printCreateUsageAndExit("Missing value for --template")
      }
      template = parseTemplateValue(value)
      i += 1
      continue
    }

    if (arg.startsWith("--template=")) {
      template = parseTemplateValue(arg.slice("--template=".length))
      continue
    }

    positional.push(arg)
  }

  const name = positional[0]
  if (!name) {
    printCreateUsageAndExit()
  }

  return { name, template }
}

function parseTemplateValue(value: string): CreateTemplate {
  if (CREATE_TEMPLATES.includes(value as CreateTemplate)) {
    return value as CreateTemplate
  }
  printCreateUsageAndExit(`Unknown template: ${value}`)
}

function printCreateUsageAndExit(message?: string): never {
  if (message) {
    console.error(message)
  }
  console.error(`Usage: gorsee create <project-name> [--template ${CREATE_TEMPLATES.join("|")}]`)
  process.exit(1)
}

async function copyTemplateTree(sourceDir: string, targetDir: string) {
  await mkdir(targetDir, { recursive: true })
  const entries = await readdir(sourceDir, { withFileTypes: true })

  for (const entry of entries) {
    if (shouldSkipTemplateEntry(entry.name)) {
      continue
    }

    const sourcePath = join(sourceDir, entry.name)
    const targetPath = join(targetDir, entry.name)

    if (entry.isDirectory()) {
      await copyTemplateTree(sourcePath, targetPath)
      continue
    }

    if (entry.isFile()) {
      await copyFile(sourcePath, targetPath)
    }
  }
}

function shouldSkipTemplateEntry(name: string) {
  return name === ".gorsee" || name === "dist" || name === "node_modules" || name === "bun.lock"
}

async function normalizeSinglePackageManifest(packageJsonPath: string, packageName: string) {
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf-8")) as {
    dependencies?: Record<string, string>
    scripts?: Record<string, string>
    name?: string
    version?: string
    private?: boolean
    type?: string
    packageManager?: string
  }
  packageJson.name = packageName
  packageJson.version = "0.1.0"
  packageJson.private = true
  packageJson.type = "module"
  packageJson.packageManager = PACKAGE_MANAGER
  packageJson.scripts = createPackageScripts()
  packageJson.dependencies = {
    ...(packageJson.dependencies ?? {}),
    gorsee: "latest",
  }
  await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2) + "\n")
}

function generateTemplateReadme(name: string, template: Exclude<CreateTemplate, "basic">): string {
  const definition = TEMPLATE_DEFINITIONS[template]
  const highlightLines = definition.readmeHighlights.map((item) => `- ${item}`).join("\n")
  const workspaceHint =
    template === "workspace-monorepo"
      ? `\n## Workspace Commands\n\nRun the app package commands from \`apps/web\`.\n`
      : ""

  return `# ${name}

Built with Gorsee.js — AI-first reactive full-stack TypeScript framework.

Template: \`${template}\`

${definition.readmeDescription}

## Included Shape

${highlightLines}

## Getting Started

\`\`\`bash
bun install
${template === "workspace-monorepo" ? "cd apps/web\nbun run dev" : "bun run dev"}
\`\`\`

Open [http://localhost:3000](http://localhost:3000).
${workspaceHint}
## Reproducibility

- Keep \`bun.lock\` in version control after the first \`bun install\`.
- Use \`bun install --frozen-lockfile\` in CI and deploy automation once the lockfile exists.

## Commands

${template === "workspace-monorepo" ? "- Root: workspace orchestration and shared packages\n- `apps/web`: `bun run dev`, `bun run build`, `bun run start`, `bun run check`" : "- `bun run dev`\n- `bun run build`\n- `bun run start`\n- `bun run check`"}

## Product Rule

This starter is a first-party product baseline. Keep client/server boundaries explicit, replace placeholder origins before shipping, and use \`FRAMEWORK.md\` plus the Gorsee docs as the canonical extension surface.
`
}

async function createBasicProject(dir: string, name: string) {
  for (const d of DIRS) {
    await mkdir(join(dir, d), { recursive: true })
  }

  await writeFile(join(dir, "routes/index.tsx"), INDEX_ROUTE)
  await writeFile(join(dir, "routes/about.tsx"), ABOUT_ROUTE)
  await writeFile(join(dir, "routes/_layout.tsx"), LAYOUT)
  await writeFile(join(dir, "routes/_error.tsx"), ERROR_PAGE)
  await writeFile(join(dir, "routes/404.tsx"), NOT_FOUND_PAGE)
  await writeFile(join(dir, "routes/api/health.ts"), HEALTH_API)
  await writeFile(join(dir, "public/styles.css"), DEFAULT_CSS)
  await writeFile(join(dir, "app.config.ts"), APP_CONFIG)
  await writeFile(join(dir, "tsconfig.json"), TSCONFIG)
  await writeFile(join(dir, ".gitignore"), GITIGNORE)
  await writeFile(join(dir, ".env.example"), ENV_EXAMPLE)
  await writeFile(join(dir, ".env"), ENV_EXAMPLE)
  await writeFile(join(dir, "README.md"), generateReadme(name))

  await writeFile(
    join(dir, "package.json"),
    JSON.stringify(
      {
        name: normalizePackageName(name),
        version: "0.1.0",
        type: "module",
        packageManager: PACKAGE_MANAGER,
        scripts: createPackageScripts(),
        dependencies: {
          gorsee: "latest",
        },
        devDependencies: {
          "@types/bun": "1.3.10",
        },
      },
      null,
      2
    ) + "\n"
  )
}

async function createTemplateProject(dir: string, name: string, template: Exclude<CreateTemplate, "basic">) {
  const definition = TEMPLATE_DEFINITIONS[template]
  await copyTemplateTree(definition.sourceDir, dir)
  await writeFile(join(dir, "README.md"), generateTemplateReadme(name, template))
  if (template !== "workspace-monorepo") {
    await writeFile(join(dir, ".gitignore"), GITIGNORE)
    await normalizeSinglePackageManifest(join(dir, "package.json"), normalizePackageName(name))
  }
  if (definition.postCreate) {
    await definition.postCreate(dir, name)
  }
}

function generateReadme(name: string): string {
  return `# ${name}

Built with Gorsee.js — AI-first reactive full-stack TypeScript framework.

This project inherits Gorsee's product model:

- deterministic collaboration between humans and coding agents
- strict client/server boundaries
- reactive runtime without VDOM baggage
- security and deploy behavior treated as framework contracts

Treat this app as a product codebase, not as a disposable scaffold.

## Getting Started

\`\`\`bash
bun install
bun run dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000).

## Reproducibility

- Keep \`bun.lock\` in version control after the first \`bun install\`.
- Use \`bun install --frozen-lockfile\` in CI and deploy automation once the lockfile exists.

## Choose Your App Class

- Secure SaaS App
- Content / Marketing Site
- Agent-Aware Internal Tool
- Workspace / Monorepo App

Use the Gorsee docs to pick one clear path before expanding architecture.

## Commands

| Command | Description |
|---------|-------------|
| \`bun run dev\` | Start dev server with HMR |
| \`bun run build\` | Production build |
| \`bun run start\` | Start production server |
| \`bun run check\` | Type check + safety audit |
| \`bunx gorsee ai doctor\` | Summarize AI diagnostics and incidents |
| \`bunx gorsee ai tail --limit 20\` | Inspect recent structured AI events |
| \`bunx gorsee ai export --format markdown\` | Generate a compact AI context packet |
| \`bunx gorsee ai export --bundle --format markdown\` | Generate an AI packet with focused code snippets |
| \`bunx gorsee ai ide-sync\` | Write IDE-friendly diagnostics/events/context files |
| \`bunx gorsee routes\` | Show route table |
| \`bunx gorsee generate <entity>\` | CRUD scaffold |
| \`bunx gorsee typegen\` | Generate typed routes |
| \`bunx gorsee migrate\` | Run DB migrations |

## Import Boundaries

- Use \`gorsee/client\` for route components, islands, links, forms, and reactive primitives.
- Use \`gorsee/server\` for \`load\`, \`action\`, middleware, cache, RPC, and route execution.
- Use scoped entrypoints such as \`gorsee/auth\`, \`gorsee/db\`, \`gorsee/security\`, \`gorsee/env\`, and \`gorsee/log\` when the concern is domain-specific.
- Do not use root \`gorsee\` in new code. It exists only as a compatibility entrypoint.

## Security Notes

- \`routeCache()\` varies by \`Cookie\` and \`Authorization\` by default. Disable that only for explicitly public responses.
- \`/api/_rpc/*\` is a separate boundary. Protect it through \`security.rpc.middlewares\` in \`app.config.ts\` or via programmatic server options.
- Replace any \`APP_ORIGIN\` placeholders in deploy configs before shipping. \`gorsee check --strict\` flags placeholder origins and floating runtime dependency versions.

## AI Notes

- AI observability is opt-in. Enable \`ai.enabled\` in \`app.config.ts\` when you want machine-readable runtime/build/check events.
- The default local sink is \`.gorsee/ai-events.jsonl\`. This is the stable source for agents, IDE tooling, and later summarization.
- Versioned AI packet, IDE projection, and session-pack expectations are documented in \`docs/AI_ARTIFACT_CONTRACT.md\` in the Gorsee repository.
- \`ai.bridge.url\` is optional. Use it only for a trusted local IDE/agent bridge; bridge failures never block the main app.
- \`bunx gorsee ai mcp\` starts a local stdio MCP server over the same AI state, so agents can read diagnostics without scraping logs.
- \`bunx gorsee ai doctor\` groups repeated failures into incident clusters so you can distinguish one-off errors from systemic regressions.
- \`bunx gorsee ai ide-sync\` writes \`.gorsee/ide/diagnostics.json\`, \`.gorsee/ide/events.json\`, and \`.gorsee/ide/context.md\` for editor integrations.
- \`bunx gorsee ai ide-sync --watch\` keeps those files fresh for live IDE diagnostics.
- \`bunx gorsee ai pack\` writes the latest agent-ready session pack to \`.gorsee/agent/latest.{json,md}\`.
- \`bun run ai:package:vscode\` stages and packages the VS Code/Cursor extension consumer.
- \`bun run release:extension\` emits a version-locked VSIX artifact for editor release/distribution.

## Project Structure

\`\`\`
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
\`\`\`

## Learn More

See \`FRAMEWORK.md\` for the full API reference (AI-friendly).

Use \`docs/CANONICAL_RECIPES.md\` in the Gorsee repository when you want the recommended production path for SaaS apps, content sites, internal tools, or workspace-based apps.

For common runtime/setup mistakes, also use \`docs/RUNTIME_FAILURES.md\`, \`docs/RUNTIME_TRIAGE.md\`, \`docs/CACHE_INVALIDATION.md\`, and \`docs/STARTER_FAILURES.md\` in the Gorsee repository.

For AI-first team workflows, also use \`docs/AI_WORKFLOWS.md\`, \`docs/AI_IDE_SYNC_WORKFLOW.md\`, \`docs/AI_MCP_WORKFLOW.md\`, \`docs/AI_BRIDGE_WORKFLOW.md\`, \`docs/AI_SESSION_PACKS.md\`, and \`docs/AI_DEBUGGING_WORKFLOWS.md\` in the Gorsee repository.

For adoption and rollout guidance, also use \`docs/STARTER_ONBOARDING.md\`, \`docs/MIGRATION_GUIDE.md\`, \`docs/UPGRADE_PLAYBOOK.md\`, \`docs/DEPLOY_TARGET_GUIDE.md\`, \`docs/FIRST_PRODUCTION_ROLLOUT.md\`, \`docs/AUTH_CACHE_DATA_PATHS.md\`, \`docs/RECIPE_BOUNDARIES.md\`, \`docs/WORKSPACE_ADOPTION.md\`, and \`docs/TEAM_FAILURES.md\` in the Gorsee repository.
`
}

export interface CreateCommandOptions extends RuntimeOptions {}

export async function createProject(args: string[], options: CreateCommandOptions = {}) {
  const { name, template } = parseCreateArgs(args)

  const { cwd } = createProjectContext(options)
  const dir = join(cwd, name)
  const location = relative(cwd, dir) || name
  console.log(`\n  Creating ${name} (${template})...\n`)

  await mkdir(dir, { recursive: true })
  if (template === "basic") {
    await createBasicProject(dir, name)
  } else {
    await createTemplateProject(dir, name, template)
  }

  const frameworkMD = generateFrameworkMD(name)
  await writeFile(join(dir, "FRAMEWORK.md"), frameworkMD)

  console.log("  Created:")
  if (template === "basic") {
    console.log("    routes/index.tsx          home page with counter")
    console.log("    routes/about.tsx          about page")
    console.log("    routes/_layout.tsx        root layout (header + footer)")
    console.log("    routes/_error.tsx         error boundary")
    console.log("    routes/404.tsx            custom 404")
    console.log("    routes/api/health.ts      health check API")
    console.log("    public/styles.css         default styles")
    console.log("    app.config.ts             configuration")
    console.log("    .env / .env.example       environment variables")
    console.log("    README.md                 project readme")
    console.log("    FRAMEWORK.md              AI context file")
    console.log("    tsconfig.json")
    console.log("    package.json")
  } else if (template === "workspace-monorepo") {
    console.log("    apps/web                  Gorsee app package")
    console.log("    packages/shared           shared workspace package")
    console.log("    package.json              workspace root")
    console.log("    README.md                 template guide")
    console.log("    FRAMEWORK.md              AI context file")
  } else {
    console.log(`    template source           examples/${template}`)
    console.log("    routes/                   first-party starter routes")
    console.log("    app.config.ts             template configuration")
    console.log("    package.json              normalized package surface")
    console.log("    README.md                 template guide")
    console.log("    FRAMEWORK.md              AI context file")
  }
  console.log()
  console.log("  Next steps:")
  console.log()
  console.log(`    cd ${location}`)
  if (template === "workspace-monorepo") {
    console.log("    bun install")
    console.log("    cd apps/web")
    console.log("    bun run dev")
  } else {
    console.log("    bun install")
    console.log("    bun run dev")
  }
  console.log()
  console.log("  Then open http://localhost:3000")
  console.log()
}

/** @deprecated Use createProject() for programmatic access. */
export async function runCreate(args: string[], options: CreateCommandOptions = {}) {
  return createProject(args, options)
}
