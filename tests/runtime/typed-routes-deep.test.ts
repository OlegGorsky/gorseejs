import { afterEach, describe, test, expect } from "bun:test"
import { buildSearchParams, createTypedRoute, extractRouteParamKeys, typedLink, typedNavigate, typedPrefetch } from "../../src/runtime/typed-routes.ts"

const originalLocation = globalThis.location

afterEach(() => {
  Object.defineProperty(globalThis, "location", {
    configurable: true,
    value: originalLocation,
  })
})

describe("typedLink", () => {
  test("static path without params", () => {
    expect(typedLink("/about")).toBe("/about")
  })
  test("single [param] replacement", () => {
    expect(typedLink("/users/[id]", { id: "42" })).toBe("/users/42")
  })
  test("multiple [param] replacements", () => {
    expect(typedLink("/blog/[year]/[slug]", { year: "2025", slug: "hello" }))
      .toBe("/blog/2025/hello")
  })
  test("encodes special chars in [param]", () => {
    expect(typedLink("/search/[query]", { query: "hello world" }))
      .toBe("/search/hello%20world")
  })
  test("[...param] catch-all replacement", () => {
    expect(typedLink("/docs/[...path]", { path: "api/v2/users" }))
      .toBe("/docs/api/v2/users")
  })
  test("missing param yields empty string", () => {
    expect(typedLink("/users/[id]", {})).toBe("/users/")
    expect(typedLink("/users/[id]")).toBe("/users/")
  })
  test("no params needed, no params given", () => {
    expect(typedLink("/")).toBe("/")
  })
  test("mixed static and dynamic segments", () => {
    expect(typedLink("/app/[org]/settings", { org: "acme" }))
      .toBe("/app/acme/settings")
  })
  test("[...param] does NOT encode slashes", () => {
    const result = typedLink("/files/[...path]", { path: "a/b/c" })
    expect(result).toBe("/files/a/b/c")
  })
  test("default params is empty object", () => {
    // Should not throw
    expect(typedLink("/static")).toBe("/static")
  })
  test("builds query strings and hash fragments", () => {
    expect(typedLink("/search/[query]", {
      params: { query: "gorsee" },
      search: { page: 2, tags: ["framework", "ai"] },
      hash: "top",
    })).toBe("/search/gorsee?page=2&tags=framework&tags=ai#top")
  })
  test("extracts route param keys", () => {
    expect(extractRouteParamKeys("/blog/[year]/[slug]/[...rest]")).toEqual(["year", "slug", "rest"])
  })
  test("buildSearchParams omits nullish values", () => {
    expect(buildSearchParams({ q: "gorsee", page: 2, draft: false, ignored: undefined, empty: null }))
      .toBe("?q=gorsee&page=2&draft=false")
  })
  test("createTypedRoute builds strict urls", () => {
    const route = createTypedRoute("/org/[org]/users/[id]")
    expect(route.params()).toEqual(["org", "id"])
    expect(route.buildStrict({ params: { org: "acme", id: "42" }, search: { tab: "billing" } }))
      .toBe("/org/acme/users/42?tab=billing")
  })
  test("typedLink accepts route objects directly", () => {
    const route = createTypedRoute("/teams/[team]/members/[id]")
    expect(typedLink(route, { params: { team: "ops", id: "7" }, hash: "details" }))
      .toBe("/teams/ops/members/7#details")
  })
})

describe("typedNavigate", () => {
  test("is a function", () => {
    expect(typeof typedNavigate).toBe("function")
  })
  test("returns a Promise", () => {
    // typedNavigate tries to import router.ts which may fail in test env
    // but it should still return a promise
    const result = typedNavigate("/test")
    expect(result).toBeInstanceOf(Promise)
    // Suppress unhandled rejection from missing router module
    result.catch(() => {})
  })
  test("typedPrefetch returns a Promise", () => {
    const result = typedPrefetch("/prefetch")
    expect(result).toBeInstanceOf(Promise)
    result.catch(() => {})
  })
})
