import { describe, expect, test } from "bun:test"
import { createRuntimeRequestPlan } from "../../src/server/request-surface.ts"

describe("request surface contract", () => {
  test("hmr endpoint resolves to the dedicated internal surface only", () => {
    expect(createRuntimeRequestPlan({
      pathname: "/__gorsee_hmr",
      hasRouteMatch: false,
      allowHMR: true,
    })).toEqual(["hmr"])
  })

  test("rpc endpoint resolves to the dedicated rpc surface only", () => {
    expect(createRuntimeRequestPlan({
      pathname: "/api/_rpc/abc123",
      hasRouteMatch: false,
    })).toEqual(["rpc"])
  })

  test("client bundle paths prioritize bundle serving before fallback", () => {
    expect(createRuntimeRequestPlan({
      pathname: "/_gorsee/index.js",
      hasRouteMatch: false,
    })).toEqual(["bundle", "not-found"])
  })

  test("non-root production paths preserve static then prerendered then route then not-found order", () => {
    expect(createRuntimeRequestPlan({
      pathname: "/about",
      hasRouteMatch: true,
      allowPrerendered: true,
    })).toEqual(["static", "prerendered", "route", "not-found"])
  })

  test("root route skips static and prerendered checks", () => {
    expect(createRuntimeRequestPlan({
      pathname: "/",
      hasRouteMatch: true,
      allowPrerendered: true,
    })).toEqual(["route", "not-found"])
  })

  test("route misses still preserve static and not-found fallback order", () => {
    expect(createRuntimeRequestPlan({
      pathname: "/missing",
      hasRouteMatch: false,
      allowPrerendered: true,
    })).toEqual(["static", "prerendered", "not-found"])
  })
})
