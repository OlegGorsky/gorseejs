import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import { createRouter } from "../../src/router/scanner.ts"
import { matchRoute, buildStaticMap } from "../../src/router/matcher.ts"
import { join } from "node:path"
import { mkdir, writeFile, rm } from "node:fs/promises"

const TMP_DIR = join(process.cwd(), ".tmp-routes-groups")

describe("Route groups and error boundaries", () => {
  beforeAll(async () => {
    // Create route structure:
    // routes/
    //   index.tsx
    //   (auth)/
    //     login.tsx
    //     register.tsx
    //   (dashboard)/
    //     _layout.tsx
    //     _error.tsx
    //     settings.tsx
    //   users/
    //     [id].tsx
    await rm(TMP_DIR, { recursive: true, force: true })
    await mkdir(join(TMP_DIR, "(auth)"), { recursive: true })
    await mkdir(join(TMP_DIR, "(dashboard)"), { recursive: true })
    await mkdir(join(TMP_DIR, "users"), { recursive: true })

    await writeFile(join(TMP_DIR, "index.tsx"), "export default () => 'home'")
    await writeFile(join(TMP_DIR, "(auth)", "login.tsx"), "export default () => 'login'")
    await writeFile(join(TMP_DIR, "(auth)", "register.tsx"), "export default () => 'register'")
    await writeFile(join(TMP_DIR, "(dashboard)", "_layout.tsx"), "export default (p: any) => p.children")
    await writeFile(join(TMP_DIR, "(dashboard)", "_error.tsx"), "export default (p: any) => 'Error: ' + p.error.message")
    await writeFile(join(TMP_DIR, "(dashboard)", "settings.tsx"), "export default () => 'settings'")
    await writeFile(join(TMP_DIR, "users", "[id].tsx"), "export default (p: any) => 'user:' + p.params.id")
  })

  afterAll(async () => {
    await rm(TMP_DIR, { recursive: true, force: true })
  })

  test("route group dirs don't add to URL path", async () => {
    const routes = await createRouter(TMP_DIR)
    const paths = routes.map((r) => r.path).sort()

    expect(paths).toContain("/")
    expect(paths).toContain("/login")
    expect(paths).toContain("/register")
    expect(paths).toContain("/settings")
    expect(paths).toContain("/users/[id]")

    // Should NOT have (auth) or (dashboard) in path
    expect(paths.some((p) => p.includes("(auth)"))).toBe(false)
    expect(paths.some((p) => p.includes("(dashboard)"))).toBe(false)
  })

  test("routes in groups match correctly", async () => {
    const routes = await createRouter(TMP_DIR)
    const staticMap = buildStaticMap(routes)

    const loginMatch = matchRoute(routes, "/login", staticMap)
    expect(loginMatch).not.toBeNull()
    expect(loginMatch!.route.path).toBe("/login")

    const settingsMatch = matchRoute(routes, "/settings", staticMap)
    expect(settingsMatch).not.toBeNull()
    expect(settingsMatch!.route.path).toBe("/settings")
  })

  test("group routes inherit layout from group dir", async () => {
    const routes = await createRouter(TMP_DIR)
    const settings = routes.find((r) => r.path === "/settings")
    expect(settings).toBeDefined()
    expect(settings!.layoutPath).not.toBeNull()
    expect(settings!.layoutPath).toContain("_layout.tsx")
  })

  test("group routes inherit error boundary from group dir", async () => {
    const routes = await createRouter(TMP_DIR)
    const settings = routes.find((r) => r.path === "/settings")
    expect(settings).toBeDefined()
    expect(settings!.errorPath).not.toBeNull()
    expect(settings!.errorPath).toContain("_error.tsx")
  })

  test("dynamic routes still work", async () => {
    const routes = await createRouter(TMP_DIR)
    const match = matchRoute(routes, "/users/42")
    expect(match).not.toBeNull()
    expect(match!.params.id).toBe("42")
  })

  test("routes have errorPath property", async () => {
    const routes = await createRouter(TMP_DIR)
    for (const route of routes) {
      expect(route).toHaveProperty("errorPath")
    }
  })
})
