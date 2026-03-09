import { describe, test, expect, beforeAll } from "bun:test"
import { createRouter, type Route } from "../../src/router/scanner.ts"
import { matchRoute } from "../../src/router/matcher.ts"
import { join } from "node:path"

const ROUTES_DIR = join(import.meta.dir, "../../routes")

describe("createRouter", () => {
  let routes: Route[]

  beforeAll(async () => {
    routes = await createRouter(ROUTES_DIR)
  })

  test("scans routes directory", () => {
    expect(routes.length).toBeGreaterThan(0)
  })

  test("finds index route", () => {
    const index = routes.find((r) => r.path === "/")
    expect(index).toBeDefined()
  })

  test("finds static nested route", () => {
    const usersIndex = routes.find((r) => r.path === "/users")
    expect(usersIndex).toBeDefined()
  })

  test("finds dynamic route", () => {
    const userById = routes.find((r) => r.isDynamic && r.params.includes("id"))
    expect(userById).toBeDefined()
    expect(userById!.path).toBe("/users/[id]")
  })

  test("finds API route", () => {
    const health = routes.find((r) => r.path === "/api/health")
    expect(health).toBeDefined()
  })

  test("static routes come before dynamic", () => {
    const staticRoutes = routes.filter((r) => !r.isDynamic)
    const dynamicRoutes = routes.filter((r) => r.isDynamic)
    if (staticRoutes.length > 0 && dynamicRoutes.length > 0) {
      const lastStaticIdx = routes.indexOf(staticRoutes[staticRoutes.length - 1]!)
      const firstDynamicIdx = routes.indexOf(dynamicRoutes[0]!)
      expect(lastStaticIdx).toBeLessThan(firstDynamicIdx)
    }
  })
})

describe("matchRoute", () => {
  let routes: Route[]

  beforeAll(async () => {
    routes = await createRouter(ROUTES_DIR)
  })

  test("matches root path", () => {
    const result = matchRoute(routes, "/")
    expect(result).not.toBeNull()
    expect(result!.route.path).toBe("/")
  })

  test("matches static nested path", () => {
    const result = matchRoute(routes, "/users")
    expect(result).not.toBeNull()
    expect(result!.route.path).toBe("/users")
  })

  test("matches dynamic path and extracts params", () => {
    const result = matchRoute(routes, "/users/42")
    expect(result).not.toBeNull()
    expect(result!.params.id).toBe("42")
  })

  test("matches API route", () => {
    const result = matchRoute(routes, "/api/health")
    expect(result).not.toBeNull()
    expect(result!.route.path).toBe("/api/health")
  })

  test("returns null for unknown path", () => {
    const result = matchRoute(routes, "/nonexistent")
    expect(result).toBeNull()
  })

  test("handles trailing slash", () => {
    const result = matchRoute(routes, "/users/")
    expect(result).not.toBeNull()
    expect(result!.route.path).toBe("/users")
  })
})
