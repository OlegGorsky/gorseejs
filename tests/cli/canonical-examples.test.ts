import { describe, expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

const ROOT = process.cwd()

describe("canonical examples", () => {
  test("examples README defines the public example surface", async () => {
    const readme = await readFile(join(ROOT, "examples", "README.md"), "utf-8")
    expect(readme).toContain("Canonical Examples")
    expect(readme).toContain("examples/secure-saas")
    expect(readme).toContain("examples/content-site")
    expect(readme).toContain("examples/agent-aware-ops")
    expect(readme).toContain("examples/workspace-monorepo")
    expect(readme).toContain("product-grade reference apps")
  })

  test("secure saas example preserves canonical protected-app imports", async () => {
    const pkg = await readFile(join(ROOT, "examples", "secure-saas", "package.json"), "utf-8")
    const config = await readFile(join(ROOT, "examples", "secure-saas", "app.config.ts"), "utf-8")
    const auth = await readFile(join(ROOT, "examples", "secure-saas", "auth-shared.ts"), "utf-8")
    const middleware = await readFile(join(ROOT, "examples", "secure-saas", "routes", "app", "_middleware.ts"), "utf-8")
    const page = await readFile(join(ROOT, "examples", "secure-saas", "routes", "index.tsx"), "utf-8")
    const dashboard = await readFile(join(ROOT, "examples", "secure-saas", "routes", "app", "dashboard.tsx"), "utf-8")
    const team = await readFile(join(ROOT, "examples", "secure-saas", "routes", "app", "team.tsx"), "utf-8")

    expect(pkg).toContain('"gorsee": "file:../../"')
    expect(config).toContain("rpc")
    expect(auth).toContain('from "gorsee/auth"')
    expect(auth).toContain("createAuth")
    expect(middleware).toContain("routeCache")
    expect(middleware).toContain("auth.protect")
    expect(page).toContain('from "gorsee/client"')
    expect(page).toContain("/app/team")
    expect(dashboard).toContain("Operating Metrics")
    expect(dashboard).toContain("Refresh via protected RPC")
    expect(team).toContain('from "gorsee/forms"')
    expect(team).toContain("defineFormAction")
    expect(team).toContain("Owner invites require explicit approval.")
    expect(team).toContain("APAC access must be scoped")
  })

  test("content site example preserves canonical public-content imports", async () => {
    const pkg = await readFile(join(ROOT, "examples", "content-site", "package.json"), "utf-8")
    const middleware = await readFile(join(ROOT, "examples", "content-site", "routes", "_middleware.ts"), "utf-8")
    const index = await readFile(join(ROOT, "examples", "content-site", "routes", "index.tsx"), "utf-8")
    const blog = await readFile(join(ROOT, "examples", "content-site", "routes", "blog", "[slug].tsx"), "utf-8")

    expect(pkg).toContain('"gorsee": "file:../../"')
    expect(middleware).toContain('from "gorsee/server"')
    expect(middleware).toContain('mode: "public"')
    expect(middleware).toContain("includeAuthHeaders: false")
    expect(index).toContain('from "gorsee/client"')
    expect(index).toContain("prerender = true")
    expect(blog).toContain("Public Article")
  })

  test("agent-aware ops example preserves canonical AI workflow imports", async () => {
    const pkg = await readFile(join(ROOT, "examples", "agent-aware-ops", "package.json"), "utf-8")
    const config = await readFile(join(ROOT, "examples", "agent-aware-ops", "app.config.ts"), "utf-8")
    const readme = await readFile(join(ROOT, "examples", "agent-aware-ops", "README.md"), "utf-8")
    const index = await readFile(join(ROOT, "examples", "agent-aware-ops", "routes", "index.tsx"), "utf-8")
    const ops = await readFile(join(ROOT, "examples", "agent-aware-ops", "routes", "ops.tsx"), "utf-8")

    expect(pkg).toContain('"gorsee": "file:../../"')
    expect(config).toContain("enabled: true")
    expect(config).toContain("sessionPack")
    expect(config).toContain("bridge")
    expect(readme).toContain("gorsee ai ide-sync")
    expect(readme).toContain("gorsee ai mcp")
    expect(index).toContain('from "gorsee/client"')
    expect(ops).toContain('from "gorsee/server"')
    expect(ops).toContain("gorsee ai pack")
  })

  test("workspace monorepo example preserves canonical workspace imports", async () => {
    const rootPkg = await readFile(join(ROOT, "examples", "workspace-monorepo", "package.json"), "utf-8")
    const appPkg = await readFile(join(ROOT, "examples", "workspace-monorepo", "apps", "web", "package.json"), "utf-8")
    const index = await readFile(join(ROOT, "examples", "workspace-monorepo", "apps", "web", "routes", "index.tsx"), "utf-8")
    const api = await readFile(join(ROOT, "examples", "workspace-monorepo", "apps", "web", "routes", "api", "session.ts"), "utf-8")
    const shared = await readFile(join(ROOT, "examples", "workspace-monorepo", "packages", "shared", "index.ts"), "utf-8")

    expect(rootPkg).toContain('"workspaces": ["apps/*", "packages/*"]')
    expect(appPkg).toContain('"gorsee": "file:../../../../"')
    expect(appPkg).toContain('"@example/shared": "workspace:*"')
    expect(index).toContain('from "@example/shared"')
    expect(index).toContain('from "gorsee/client"')
    expect(api).toContain('from "gorsee/auth"')
    expect(shared).toContain("workspace-example-ready")
  })
})
