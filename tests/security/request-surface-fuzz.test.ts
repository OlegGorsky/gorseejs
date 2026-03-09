import { describe, expect, test } from "bun:test"
import { createRuntimeRequestPlan } from "../../src/server/request-surface.ts"

describe("request surface classification fuzz", () => {
  test("treats only exact HMR path as HMR surface", () => {
    expect(createRuntimeRequestPlan({
      pathname: "/__gorsee_hmr/",
      hasRouteMatch: false,
      allowHMR: true,
    })).not.toEqual(["hmr"])

    expect(createRuntimeRequestPlan({
      pathname: "/__gorsee_hmr?x=1",
      hasRouteMatch: false,
      allowHMR: true,
    })).not.toEqual(["hmr"])
  })

  test("only strict RPC id format matches rpc surface", () => {
    for (const pathname of [
      "/api/_rpc/abc-123",
      "/api/_rpc/../secret",
      "/api/_rpc/%2e%2e",
      "/api/_rpc/abc/def",
    ]) {
      expect(createRuntimeRequestPlan({
        pathname,
        hasRouteMatch: false,
      })).not.toEqual(["rpc"])
    }
  })

  test("bundle prefix wins over static and route surfaces", () => {
    expect(createRuntimeRequestPlan({
      pathname: "/_gorsee/chunks/app.js",
      hasRouteMatch: true,
      allowPrerendered: true,
    })).toEqual(["bundle", "not-found"])
  })
})
