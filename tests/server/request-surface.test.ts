import { describe, expect, test } from "bun:test"
import { createRuntimeRequestPlan } from "../../src/server/request-surface.ts"

describe("runtime request surface plan", () => {
  test("prioritizes HMR as an exclusive dev surface", () => {
    expect(createRuntimeRequestPlan({
      pathname: "/__gorsee_hmr",
      hasRouteMatch: false,
      allowHMR: true,
    })).toEqual(["hmr"])
  })

  test("treats RPC paths as a dedicated surface", () => {
    expect(createRuntimeRequestPlan({
      pathname: "/api/_rpc/abc123",
      hasRouteMatch: false,
      allowPrerendered: true,
    })).toEqual(["rpc"])
  })

  test("orders bundle, static, prerendered, and route surfaces deterministically", () => {
    expect(createRuntimeRequestPlan({
      pathname: "/about",
      hasRouteMatch: true,
      allowPrerendered: true,
    })).toEqual(["static", "prerendered", "route", "not-found"])

    expect(createRuntimeRequestPlan({
      pathname: "/_gorsee/app.js",
      hasRouteMatch: false,
    })).toEqual(["bundle", "not-found"])
  })
})
