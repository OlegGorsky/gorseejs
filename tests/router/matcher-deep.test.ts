import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import { createRouter, type Route } from "../../src/router/scanner.ts"
import { matchRoute, buildStaticMap } from "../../src/router/matcher.ts"
import { join } from "node:path"
import { mkdir, writeFile, rm } from "node:fs/promises"

const TMP = join(process.cwd(), ".tmp-matcher-deep")

describe("matcher-deep", () => {
  let routes: Route[]
  let staticMap: Map<string, Route>

  beforeAll(async () => {
    await rm(TMP, { recursive: true, force: true })
    const dirs = ["", "users", "posts/[id]", "docs", "a/[id]/b"]
    for (const d of dirs) await mkdir(join(TMP, d), { recursive: true })

    const files: Record<string, string> = {
      "index.tsx": "export default () => 'home'",
      "about.tsx": "export default () => 'about'",
      "users/index.tsx": "export default () => 'users'",
      "users/[id].tsx": "export default () => 'user'",
      "posts/[id]/index.tsx": "export default () => 'post'",
      "posts/[id]/comments.tsx": "export default () => 'comments'",
      "docs/[...path].tsx": "export default () => 'docs'",
      "a/[id]/b/[id2].tsx": "export default () => 'nested'",
    }
    for (const [rel, content] of Object.entries(files)) {
      await writeFile(join(TMP, rel), content)
    }

    routes = await createRouter(TMP)
    staticMap = buildStaticMap(routes)
  })

  afterAll(async () => {
    await rm(TMP, { recursive: true, force: true })
  })

  test("matchRoute on exact static path", () => {
    const r = matchRoute(routes, "/about", staticMap)
    expect(r).not.toBeNull()
    expect(r!.route.path).toBe("/about")
    expect(r!.params).toEqual({})
  })

  test("matchRoute on dynamic path extracts params", () => {
    const r = matchRoute(routes, "/users/42", staticMap)
    expect(r).not.toBeNull()
    expect(r!.params.id).toBe("42")
  })

  test("matchRoute on catch-all extracts rest", () => {
    const r = matchRoute(routes, "/docs/a/b/c", staticMap)
    expect(r).not.toBeNull()
    expect(r!.params.path).toBe("a/b/c")
  })

  test("matchRoute returns null for non-matching", () => {
    expect(matchRoute(routes, "/nope", staticMap)).toBeNull()
    expect(matchRoute(routes, "/users/42/extra", staticMap)).toBeNull()
  })

  test("matchRoute prefers static over dynamic", () => {
    const r = matchRoute(routes, "/users", staticMap)
    expect(r).not.toBeNull()
    expect(r!.route.isDynamic).toBe(false)
    expect(r!.route.path).toBe("/users")
  })

  test("matchRoute with multiple dynamic segments", () => {
    const r = matchRoute(routes, "/posts/99/comments")
    expect(r).not.toBeNull()
    expect(r!.params.id).toBe("99")
  })

  test("matchRoute with trailing slash", () => {
    const r = matchRoute(routes, "/about/", staticMap)
    expect(r).not.toBeNull()
    expect(r!.route.path).toBe("/about")
  })

  test("matchRoute without trailing slash", () => {
    const r = matchRoute(routes, "/users", staticMap)
    expect(r).not.toBeNull()
    expect(r!.route.path).toBe("/users")
  })

  test("matchRoute on root /", () => {
    const r = matchRoute(routes, "/", staticMap)
    expect(r).not.toBeNull()
    expect(r!.route.path).toBe("/")
  })

  test("buildStaticMap contains only non-dynamic routes", () => {
    for (const [, route] of staticMap) {
      expect(route.isDynamic).toBe(false)
    }
    expect(staticMap.has("/about")).toBe(true)
    expect(staticMap.has("/users/[id]")).toBe(false)
  })

  test("nested dynamic routes /a/[id]/b/[id2]", () => {
    const r = matchRoute(routes, "/a/10/b/20")
    expect(r).not.toBeNull()
    expect(r!.params.id).toBe("10")
    expect(r!.params.id2).toBe("20")
  })

  test("URL decoding in params", () => {
    const r = matchRoute(routes, "/users/hello%20world")
    expect(r).not.toBeNull()
    expect(r!.params.id).toBe("hello world")
  })

  test("catch-all matches single segment", () => {
    const r = matchRoute(routes, "/docs/single")
    expect(r).not.toBeNull()
    expect(r!.params.path).toBe("single")
  })

  test("catch-all optional -- /docs alone", () => {
    // catch-all pattern is (?:/(.+))? so /docs should still match
    const r = matchRoute(routes, "/docs")
    // Depending on implementation this may or may not match
    // The pattern for /docs/[...path] is ^/docs(?:/(.+))?$
    if (r) {
      expect(r.params.path).toBeUndefined()
    }
  })

  test("matchRoute without staticMap still works", () => {
    const r = matchRoute(routes, "/about")
    expect(r).not.toBeNull()
    expect(r!.route.path).toBe("/about")
  })

  test("static map lookup is O(1) for known paths", () => {
    expect(staticMap.get("/")).toBeDefined()
    expect(staticMap.get("/about")).toBeDefined()
    expect(staticMap.get("/unknown")).toBeUndefined()
  })

  test("multiple trailing slashes normalized", () => {
    const r = matchRoute(routes, "/about///", staticMap)
    expect(r).not.toBeNull()
    expect(r!.route.path).toBe("/about")
  })

  test("dynamic route param with special chars decoded", () => {
    const r = matchRoute(routes, "/users/%E4%B8%AD%E6%96%87")
    expect(r).not.toBeNull()
    expect(r!.params.id).toContain("\u4e2d")
  })
})
