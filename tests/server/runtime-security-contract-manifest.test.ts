import { describe, expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { createRuntimeRequestPlan } from "../../src/server/request-surface.ts"
import type { RuntimeRequestSurface } from "../../src/server/request-surface.ts"
import { resolveRequestExecutionPolicy } from "../../src/server/request-policy.ts"

const ROOT = join(import.meta.dir, "../..")

describe("runtime security contract manifest", () => {
  test("request kinds in manifest match runtime execution policy", async () => {
    const manifest = JSON.parse(await readFile(join(ROOT, "docs", "RUNTIME_SECURITY_CONTRACT.json"), "utf-8")) as {
      requestKinds: Array<{
        kind: "page" | "partial" | "action" | "route-handler" | "rpc" | "static"
        visibility: string
        access: string
        mutation: string
        responseShape: string
        requiresTrustedOrigin: boolean
        allowedContentTypes?: string[]
      }>
    }

    for (const entry of manifest.requestKinds) {
      const runtimePolicy = resolveRequestExecutionPolicy(entry.kind)
      expect(runtimePolicy).toMatchObject({
        kind: entry.kind,
        visibility: entry.visibility,
        access: entry.access,
        mutation: entry.mutation,
        responseShape: entry.responseShape,
        requiresTrustedOrigin: entry.requiresTrustedOrigin,
      })
      expect(runtimePolicy.allowedContentTypes ?? []).toEqual(entry.allowedContentTypes ?? [])
    }
  })

  test("request surface ordering in manifest matches runtime planning", async () => {
    const manifest = JSON.parse(await readFile(join(ROOT, "docs", "RUNTIME_SECURITY_CONTRACT.json"), "utf-8")) as {
      requestSurfaceOrder: {
        hmrOnly: RuntimeRequestSurface[]
        rpcOnly: RuntimeRequestSurface[]
        bundleOnly: RuntimeRequestSurface[]
        routeWithPrerender: RuntimeRequestSurface[]
        rootRoute: RuntimeRequestSurface[]
      }
    }

    expect(createRuntimeRequestPlan({
      pathname: "/__gorsee_hmr",
      hasRouteMatch: false,
      allowHMR: true,
    })).toEqual(manifest.requestSurfaceOrder.hmrOnly)

    expect(createRuntimeRequestPlan({
      pathname: "/api/_rpc/abc123",
      hasRouteMatch: false,
    })).toEqual(manifest.requestSurfaceOrder.rpcOnly)

    expect(createRuntimeRequestPlan({
      pathname: "/_gorsee/index.js",
      hasRouteMatch: false,
    })).toEqual(manifest.requestSurfaceOrder.bundleOnly)

    expect(createRuntimeRequestPlan({
      pathname: "/about",
      hasRouteMatch: true,
      allowPrerendered: true,
    })).toEqual(manifest.requestSurfaceOrder.routeWithPrerender)

    expect(createRuntimeRequestPlan({
      pathname: "/",
      hasRouteMatch: true,
      allowPrerendered: true,
    })).toEqual(manifest.requestSurfaceOrder.rootRoute)
  })
})
