import { describe, expect, test } from "bun:test"
import { matchRoute } from "../../src/router/matcher.ts"
import type { Route } from "../../src/router/scanner.ts"

const staticRoute: Route = {
  path: "/about",
  pattern: /^\/about$/,
  filePath: "/tmp/about.tsx",
  isDynamic: false,
  params: [],
  layoutPath: null,
  layoutPaths: [],
  middlewarePath: null,
  middlewarePaths: [],
  errorPath: null,
  loadingPath: null,
}

const dynamicRoute: Route = {
  path: "/users/[id]",
  pattern: /^\/users\/([^/]+)$/,
  filePath: "/tmp/users/[id].tsx",
  isDynamic: true,
  params: ["id"],
  layoutPath: null,
  layoutPaths: [],
  middlewarePath: null,
  middlewarePaths: [],
  errorPath: null,
  loadingPath: null,
}

describe("router normalization fuzz", () => {
  test("collapses duplicate slashes for static routes", () => {
    for (const pathname of ["/about//", "///about", "//about///"]) {
      const result = matchRoute([staticRoute], pathname)
      expect(result?.route.path).toBe("/about")
    }
  })

  test("normalizes backslashes in route matching", () => {
    const result = matchRoute([dynamicRoute], "\\users\\42\\")
    expect(result?.route.path).toBe("/users/[id]")
    expect(result?.params.id).toBe("42")
  })

  test("keeps malformed percent-encoding fail-safe", () => {
    const result = matchRoute([dynamicRoute], "/users/%E0%A4%A")
    expect(result?.params.id).toBe("%E0%A4%A")
  })
})
