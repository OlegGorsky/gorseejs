import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import { createRouter, type Route } from "../../src/router/scanner.ts"
import { join } from "node:path"
import { mkdir, writeFile, rm } from "node:fs/promises"

const TMP = join(process.cwd(), ".tmp-scanner-deep")

describe("scanner-deep", () => {
  beforeAll(async () => {
    await rm(TMP, { recursive: true, force: true })
    // Build a rich route tree:
    // index.tsx, about.tsx, _layout.tsx, _middleware.ts, _error.tsx, _loading.tsx
    // users/index.tsx, users/[id].tsx
    // blog/[slug]/index.tsx, blog/[slug]/comments.tsx
    // docs/[...path].tsx
    // (marketing)/pricing.tsx, (marketing)/landing.tsx
    // api/health.ts, api/users.ts
    // deep/a/b/c/page.tsx
    const dirs = [
      "", "users", "blog/[slug]", "docs", "(marketing)",
      "api", "deep/a/b/c",
    ]
    for (const d of dirs) {
      await mkdir(join(TMP, d), { recursive: true })
    }
    const files: Record<string, string> = {
      "index.tsx": "export default () => 'home'",
      "about.tsx": "export default () => 'about'",
      "_layout.tsx": "export default (p:any) => p.children",
      "_middleware.ts": "export default (c:any) => c.next()",
      "_error.tsx": "export default () => 'err'",
      "_loading.tsx": "export default () => 'loading'",
      "users/index.tsx": "export default () => 'users'",
      "users/[id].tsx": "export default () => 'user'",
      "blog/[slug]/index.tsx": "export default () => 'blog'",
      "blog/[slug]/comments.tsx": "export default () => 'comments'",
      "docs/[...path].tsx": "export default () => 'docs'",
      "(marketing)/pricing.tsx": "export default () => 'pricing'",
      "(marketing)/landing.tsx": "export default () => 'landing'",
      "api/health.ts": "export function GET() { return new Response('ok') }",
      "api/users.ts": "export function GET() { return new Response('[]') }",
      "deep/a/b/c/page.tsx": "export default () => 'deep'",
    }
    for (const [rel, content] of Object.entries(files)) {
      await writeFile(join(TMP, rel), content)
    }
  })

  afterAll(async () => {
    await rm(TMP, { recursive: true, force: true })
  })

  let routes: Route[]
  beforeAll(async () => {
    routes = await createRouter(TMP)
  })

  test("scans index.tsx as /", () => {
    expect(routes.find((r) => r.path === "/")).toBeDefined()
  })

  test("scans about.tsx as /about", () => {
    expect(routes.find((r) => r.path === "/about")).toBeDefined()
  })

  test("scans [id].tsx as dynamic route", () => {
    const r = routes.find((r) => r.path === "/users/[id]")
    expect(r).toBeDefined()
    expect(r!.isDynamic).toBe(true)
  })

  test("scans [...path].tsx as catch-all", () => {
    const r = routes.find((r) => r.path === "/docs/[...path]")
    expect(r).toBeDefined()
    expect(r!.params).toContain("path")
  })

  test("dynamic params extracted correctly", () => {
    const r = routes.find((r) => r.path === "/users/[id]")!
    expect(r.params).toEqual(["id"])
  })

  test("pattern regex matches correct paths", () => {
    const r = routes.find((r) => r.path === "/users/[id]")!
    expect(r.pattern.test("/users/42")).toBe(true)
    expect(r.pattern.test("/users/abc")).toBe(true)
  })

  test("pattern regex rejects wrong paths", () => {
    const r = routes.find((r) => r.path === "/users/[id]")!
    expect(r.pattern.test("/users")).toBe(false)
    expect(r.pattern.test("/users/42/extra")).toBe(false)
  })

  test("layout paths collected correctly", () => {
    const r = routes.find((r) => r.path === "/about")!
    expect(r.layoutPaths.length).toBeGreaterThan(0)
    expect(r.layoutPaths[0]).toContain("_layout.tsx")
  })

  test("middleware paths collected correctly", () => {
    const r = routes.find((r) => r.path === "/about")!
    expect(r.middlewarePaths.length).toBeGreaterThan(0)
    expect(r.middlewarePaths[0]).toContain("_middleware.ts")
  })

  test("error boundary path found", () => {
    const r = routes.find((r) => r.path === "/about")!
    expect(r.errorPath).not.toBeNull()
    expect(r.errorPath).toContain("_error.tsx")
  })

  test("loading path found", () => {
    const r = routes.find((r) => r.path === "/about")!
    expect(r.loadingPath).not.toBeNull()
    expect(r.loadingPath).toContain("_loading.tsx")
  })

  test("nested directory creates nested routes", () => {
    expect(routes.find((r) => r.path === "/users")).toBeDefined()
    expect(routes.find((r) => r.path === "/users/[id]")).toBeDefined()
  })

  test("route groups don't add prefix", () => {
    expect(routes.find((r) => r.path === "/pricing")).toBeDefined()
    expect(routes.find((r) => r.path === "/landing")).toBeDefined()
    expect(routes.every((r) => !r.path.includes("(marketing)"))).toBe(true)
  })

  test("API routes detected (.ts extension)", () => {
    expect(routes.find((r) => r.path === "/api/health")).toBeDefined()
    expect(routes.find((r) => r.path === "/api/users")).toBeDefined()
  })

  test("static routes come before dynamic", () => {
    const staticIdx = routes.findIndex((r) => r.path === "/about")
    const dynIdx = routes.findIndex((r) => r.path === "/users/[id]")
    expect(staticIdx).toBeLessThan(dynIdx)
  })

  test("specific dynamic before catch-all", () => {
    const dynIdx = routes.findIndex((r) => r.path === "/users/[id]")
    const catchIdx = routes.findIndex((r) => r.path === "/docs/[...path]")
    expect(dynIdx).toBeLessThan(catchIdx)
  })

  test("deep nesting (3+ levels)", () => {
    expect(routes.find((r) => r.path === "/deep/a/b/c/page")).toBeDefined()
  })

  test("catch-all pattern matches multiple segments", () => {
    const r = routes.find((r) => r.path === "/docs/[...path]")!
    expect(r.pattern.test("/docs/a/b/c")).toBe(true)
    expect(r.pattern.test("/docs/x")).toBe(true)
  })

  test("nested dynamic route has correct params", () => {
    const r = routes.find((r) => r.path === "/blog/[slug]/comments")!
    expect(r.params).toEqual(["slug"])
    expect(r.isDynamic).toBe(true)
  })

  test("routes sorted by specificity (static < dynamic < catch-all)", () => {
    const statics = routes.filter((r) => !r.isDynamic)
    const dynamics = routes.filter((r) => r.isDynamic && !r.path.includes("[..."))
    const catchAlls = routes.filter((r) => r.path.includes("[..."))
    if (statics.length && dynamics.length) {
      const lastS = routes.indexOf(statics[statics.length - 1]!)
      const firstD = routes.indexOf(dynamics[0]!)
      expect(lastS).toBeLessThan(firstD)
    }
    if (dynamics.length && catchAlls.length) {
      const lastD = routes.indexOf(dynamics[dynamics.length - 1]!)
      const firstC = routes.indexOf(catchAlls[0]!)
      expect(lastD).toBeLessThan(firstC)
    }
  })

  test("all routes have required properties", () => {
    for (const r of routes) {
      expect(r).toHaveProperty("path")
      expect(r).toHaveProperty("pattern")
      expect(r).toHaveProperty("filePath")
      expect(r).toHaveProperty("isDynamic")
      expect(r).toHaveProperty("params")
    }
  })

  test("empty / nonexistent directory returns empty routes", async () => {
    const result = await createRouter("/tmp/__nonexistent_dir_gorsee__")
    expect(result).toEqual([])
  })
})
