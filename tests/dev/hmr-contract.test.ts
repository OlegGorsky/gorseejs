import { describe, expect, test } from "bun:test"
import { createHMRUpdate, HMR_CLIENT_SCRIPT, serializeHMRUpdate } from "../../src/dev/hmr.ts"
import type { BuildResult } from "../../src/build/client.ts"
import type { Route } from "../../src/router/index.ts"

function createRoute(path: string, filePath: string, options: Partial<Route> = {}): Route {
  return {
    path,
    pattern: /^$/,
    filePath,
    isDynamic: false,
    params: [],
    layoutPath: null,
    layoutPaths: [],
    middlewarePath: null,
    middlewarePaths: [],
    errorPath: null,
    loadingPath: null,
    ...options,
  }
}

describe("dev HMR contract", () => {
  test("route module changes become route-refresh updates with entry scripts", () => {
    const routes = [
      createRoute("/", "/repo/routes/index.tsx"),
      createRoute("/about", "/repo/routes/about.tsx"),
    ]
    const clientBuild: BuildResult = {
      entryMap: new Map([
        ["/", "index.js"],
        ["/about", "about.js"],
      ]),
    }

    const update = createHMRUpdate({
      changedPath: "/repo/routes/about.tsx",
      routesDir: "/repo/routes",
      sharedDir: "/repo/shared",
      middlewareDir: "/repo/middleware",
      routes,
      clientBuild,
    })

    expect(update.kind).toBe("route-refresh")
    expect(update.routePaths).toEqual(["/about"])
    expect(update.entryScripts).toEqual(["/_gorsee/about.js"])
    expect(update.refreshCurrentRoute).toBe(true)
  })

  test("shared CSS changes become css-update events without blind reload fallback", () => {
    const update = createHMRUpdate({
      changedPath: "/repo/shared/theme.css",
      routesDir: "/repo/routes",
      sharedDir: "/repo/shared",
      middlewareDir: "/repo/middleware",
      routes: [],
      clientBuild: { entryMap: new Map() },
    })

    expect(update.kind).toBe("css-update")
    expect(update.reason).toBe("shared dependency changed")
    expect(update.refreshCurrentRoute).toBe(true)
  })

  test("serialized updates stay machine-readable for the browser HMR client", () => {
    const payload = serializeHMRUpdate({
      kind: "route-refresh",
      changedPath: "/repo/routes/index.tsx",
      timestamp: 123,
      entryScripts: ["/_gorsee/index.js"],
    })

    expect(JSON.parse(payload)).toEqual({
      kind: "route-refresh",
      changedPath: "/repo/routes/index.tsx",
      timestamp: 123,
      entryScripts: ["/_gorsee/index.js"],
    })
    expect(HMR_CLIENT_SCRIPT).toContain("__gorseeHandleHMR")
    expect(HMR_CLIENT_SCRIPT).not.toContain('if (e.data === "reload") location.reload();')
  })
})
