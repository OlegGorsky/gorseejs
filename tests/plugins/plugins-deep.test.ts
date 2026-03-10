import { describe, test, expect } from "bun:test"
import {
  definePlugin,
  createPluginRunner,
  type GorseePlugin,
  type PluginContext,
} from "../../src/plugins/index.ts"
import type { MiddlewareFn } from "../../src/server/middleware.ts"

describe("plugin system deep", () => {
  test("definePlugin returns identity", () => {
    const p: GorseePlugin = { name: "id" }
    expect(definePlugin(p)).toBe(p)
  })

  test("createPluginRunner with empty config", () => {
    const runner = createPluginRunner()
    expect(runner.getMiddlewares()).toEqual([])
    expect(runner.getBuildPlugins()).toEqual([])
    expect(runner.getRoutes().size).toBe(0)
  })

  test("register multiple plugins", () => {
    const runner = createPluginRunner()
    runner.register(definePlugin({ name: "a" }))
    runner.register(definePlugin({ name: "b" }))
    runner.register(definePlugin({ name: "c" }))
    // No error, no middlewares since none declared
    expect(runner.getMiddlewares()).toHaveLength(0)
  })

  test("missing dependency fails closed", () => {
    const runner = createPluginRunner()
    runner.register(definePlugin({ name: "dependent", dependsOn: ["missing"] }))
    expect(runner.setupAll()).rejects.toThrow('depends on missing plugin "missing"')
  })

  test("setupAll calls setup in registration order", async () => {
    const order: string[] = []
    const runner = createPluginRunner()
    runner.register(definePlugin({ name: "1st", setup: async () => { order.push("1") } }))
    runner.register(definePlugin({ name: "2nd", setup: async () => { order.push("2") } }))
    runner.register(definePlugin({ name: "3rd", setup: async () => { order.push("3") } }))
    await runner.setupAll()
    expect(order).toEqual(["1", "2", "3"])
  })

  test("teardownAll calls teardown in reverse order", async () => {
    const order: string[] = []
    const runner = createPluginRunner()
    runner.register(definePlugin({ name: "a", teardown: async () => { order.push("a") } }))
    runner.register(definePlugin({ name: "b", teardown: async () => { order.push("b") } }))
    runner.register(definePlugin({ name: "c", teardown: async () => { order.push("c") } }))
    await runner.teardownAll()
    expect(order).toEqual(["c", "b", "a"])
  })

  test("plugin middleware registered on register()", () => {
    const mw: MiddlewareFn = async (_ctx, next) => next()
    const runner = createPluginRunner()
    runner.register(definePlugin({ name: "mw-test", middleware: mw }))
    expect(runner.getMiddlewares()).toContain(mw)
  })

  test("addMiddleware in setup adds to list", async () => {
    const mw: MiddlewareFn = async (_ctx, next) => next()
    const runner = createPluginRunner()
    runner.register(definePlugin({
      name: "dyn",
      setup: async (app) => { app.addMiddleware(mw) },
    }))
    await runner.setupAll()
    expect(runner.getMiddlewares()).toContain(mw)
  })

  test("addRoute in setup registers route", async () => {
    const handler = async () => new Response("ok")
    const runner = createPluginRunner()
    runner.register(definePlugin({
      name: "route",
      setup: async (app) => { app.addRoute("/test", handler) },
    }))
    await runner.setupAll()
    expect(runner.getRoutes().has("/test")).toBe(true)
  })

  test("getBuildPlugins aggregates from all plugins", () => {
    const bp = { name: "bp", setup() {} }
    const runner = createPluginRunner()
    runner.register(definePlugin({ name: "a", buildPlugins: () => [bp] }))
    runner.register(definePlugin({ name: "b", buildPlugins: () => [bp] }))
    runner.register(definePlugin({ name: "c" })) // no buildPlugins
    expect(runner.getBuildPlugins()).toHaveLength(2)
  })

  test("cyclic plugin ordering fails closed", async () => {
    const runner = createPluginRunner()
    runner.register(definePlugin({ name: "a", order: { after: ["b"] } }))
    runner.register(definePlugin({ name: "b", order: { after: ["a"] } }))
    await expect(runner.setupAll()).rejects.toThrow("Plugin ordering contains a cycle.")
  })

  test("getRoutes returns Map", async () => {
    const runner = createPluginRunner()
    const routes = runner.getRoutes()
    expect(routes).toBeInstanceOf(Map)
  })

  test("plugin with no setup/teardown is fine", async () => {
    const runner = createPluginRunner()
    runner.register(definePlugin({ name: "bare" }))
    await runner.setupAll()
    await runner.teardownAll()
    // no error
  })

  test("plugin with only middleware", () => {
    const mw: MiddlewareFn = async (_ctx, next) => next()
    const runner = createPluginRunner()
    runner.register(definePlugin({ name: "mw-only", middleware: mw }))
    expect(runner.getMiddlewares()).toHaveLength(1)
    expect(runner.getBuildPlugins()).toHaveLength(0)
  })

  test("plugin with only buildPlugins", () => {
    const bp = { name: "bp", setup() {} }
    const runner = createPluginRunner()
    runner.register(definePlugin({ name: "bp-only", buildPlugins: () => [bp] }))
    expect(runner.getMiddlewares()).toHaveLength(0)
    expect(runner.getBuildPlugins()).toHaveLength(1)
  })

  test("register same plugin object twice is rejected by name", () => {
    const mw: MiddlewareFn = async (_ctx, next) => next()
    const plugin = definePlugin({ name: "dup", middleware: mw })
    const runner = createPluginRunner()
    runner.register(plugin)
    expect(() => runner.register(plugin)).toThrow('Plugin "dup" is already registered.')
  })

  test("config passed to plugin context in setup", async () => {
    let receivedConfig: Record<string, unknown> = {}
    const runner = createPluginRunner({ db: "sqlite", port: 3000 })
    runner.register(definePlugin({
      name: "cfg",
      setup: async (app) => { receivedConfig = app.config },
    }))
    await runner.setupAll()
    expect(receivedConfig.db).toBe("sqlite")
    expect(receivedConfig.port).toBe(3000)
  })

  test("config schema validation runs on register", () => {
    const runner = createPluginRunner({ provider: "sqlite" })
    expect(() => runner.register(definePlugin({
      name: "validated",
      configSchema(config) {
        if (config.provider !== "postgres") {
          return [{ path: "provider", message: "must be postgres" }]
        }
        return []
      },
    }))).toThrow('Plugin "validated" config validation failed: provider: must be postgres')
  })

  test("getRoutes returns copy, not internal map", async () => {
    const runner = createPluginRunner()
    const handler = async () => new Response("ok")
    runner.register(definePlugin({
      name: "r",
      setup: async (app) => { app.addRoute("/x", handler) },
    }))
    await runner.setupAll()
    const a = runner.getRoutes()
    const b = runner.getRoutes()
    expect(a).not.toBe(b)
    expect(a.size).toBe(b.size)
  })

  test("getMiddlewares returns copy", () => {
    const runner = createPluginRunner()
    const a = runner.getMiddlewares()
    const b = runner.getMiddlewares()
    expect(a).not.toBe(b)
  })

  test("unknown order.after target fails closed", async () => {
    const runner = createPluginRunner()
    runner.register(definePlugin({ name: "a", order: { after: ["missing"] } }))
    await expect(runner.setupAll()).rejects.toThrow('Plugin "a" declares unknown order.after target "missing"')
  })

  test("unknown order.before target fails closed", async () => {
    const runner = createPluginRunner()
    runner.register(definePlugin({ name: "a", order: { before: ["missing"] } }))
    await expect(runner.setupAll()).rejects.toThrow('Plugin "a" declares unknown order.before target "missing"')
  })

  test("duplicate capabilities are normalized and sorted", () => {
    const runner = createPluginRunner()
    runner.register(definePlugin({
      name: "caps",
      capabilities: ["runtime", "build", "runtime", "db"],
      buildPlugins: () => [{ name: "bp", setup() {} }],
      setup: async () => {},
    }))

    expect(runner.getPluginDescriptors()).toEqual([
      {
        name: "caps",
        version: undefined,
        capabilities: ["build", "db", "runtime"],
        dependsOn: [],
        before: [],
        after: [],
      },
    ])
  })

  test("runPhase passes lifecycle metadata with normalized plugin descriptor", async () => {
    const seen: Array<{ phase: string; name: string; capabilities: string[] }> = []
    const runner = createPluginRunner()
    runner.register(definePlugin({
      name: "phase-meta",
      middleware: async (_ctx, next) => next(),
      lifecycle: {
        dev: async (app) => {
          seen.push({
            phase: app.phase,
            name: app.plugin.name,
            capabilities: app.plugin.capabilities,
          })
        },
      },
    }))

    await runner.runPhase("dev")

    expect(seen).toEqual([
      {
        phase: "dev",
        name: "phase-meta",
        capabilities: ["dev", "middleware"],
      },
    ])
  })

  test("setup runs before runtime lifecycle hook for the same plugin", async () => {
    const order: string[] = []
    const runner = createPluginRunner()
    runner.register(definePlugin({
      name: "runtime-order",
      setup: async () => { order.push("setup") },
      lifecycle: {
        runtime: async () => { order.push("runtime") },
      },
    }))

    await runner.setupAll()

    expect(order).toEqual(["setup", "runtime"])
  })

  test("setup failure stops later plugins and propagates the original error", async () => {
    const order: string[] = []
    const runner = createPluginRunner()
    runner.register(definePlugin({
      name: "first",
      setup: async () => {
        order.push("first")
        throw new Error("setup failed")
      },
    }))
    runner.register(definePlugin({
      name: "second",
      setup: async () => {
        order.push("second")
      },
    }))

    await expect(runner.setupAll()).rejects.toThrow("setup failed")
    expect(order).toEqual(["first"])
  })

  test("build plugins preserve plugin graph order across collisions", () => {
    const runner = createPluginRunner()
    runner.register(definePlugin({
      name: "base",
      buildPlugins: () => [{ name: "shared-build", bun: { name: "bun-shared", setup() {} } }],
    }))
    runner.register(definePlugin({
      name: "after-base",
      dependsOn: ["base"],
      buildPlugins: () => [{ name: "shared-build", bun: { name: "bun-after", setup() {} } }],
    }))

    expect(runner.getBuildPlugins().map((plugin) => plugin.name)).toEqual(["shared-build", "shared-build"])
    expect(runner.getBuildPlugins("bun").map((plugin) => plugin.name)).toEqual(["shared-build", "shared-build"])
  })

  test("getBuildPlugins(target) filters by build runtime target", () => {
    const runner = createPluginRunner()
    runner.register(definePlugin({
      name: "mixed-build",
      buildPlugins: () => [
        { name: "bun-only", bun: { name: "bun-only", setup() {} } },
        { name: "rolldown-only", rolldown: { name: "rolldown-only" } as never },
        { name: "dual", bun: { name: "dual-bun", setup() {} }, rolldown: { name: "dual-roll" } as never },
      ],
    }))

    expect(runner.getBuildPlugins("bun").map((plugin) => plugin.name)).toEqual(["bun-only", "dual"])
    expect(runner.getBuildPlugins("rolldown").map((plugin) => plugin.name)).toEqual(["rolldown-only", "dual"])
  })

  test("teardownAll continues reverse cleanup after a teardown failure and reports all failures", async () => {
    const order: string[] = []
    const runner = createPluginRunner()
    runner.register(definePlugin({
      name: "base",
      teardown: async () => {
        order.push("base")
      },
    }))
    runner.register(definePlugin({
      name: "middle",
      dependsOn: ["base"],
      teardown: async () => {
        order.push("middle")
        throw new Error("middle cleanup failed")
      },
    }))
    runner.register(definePlugin({
      name: "leaf",
      dependsOn: ["middle"],
      teardown: async () => {
        order.push("leaf")
        throw new Error("leaf cleanup failed")
      },
    }))

    await expect(runner.teardownAll()).rejects.toThrow(
      "Plugin teardown failed: leaf: leaf cleanup failed; middle: middle cleanup failed",
    )
    expect(order).toEqual(["leaf", "middle", "base"])
  })

  test("complex dependency graph preserves setup order and reverse teardown cleanup", async () => {
    const order: string[] = []
    const runner = createPluginRunner()
    runner.register(definePlugin({
      name: "base",
      setup: async () => { order.push("setup:base") },
      teardown: async () => { order.push("teardown:base") },
    }))
    runner.register(definePlugin({
      name: "auth",
      dependsOn: ["base"],
      setup: async () => { order.push("setup:auth") },
      teardown: async () => { order.push("teardown:auth") },
    }))
    runner.register(definePlugin({
      name: "payments",
      dependsOn: ["auth"],
      setup: async () => { order.push("setup:payments") },
      teardown: async () => { order.push("teardown:payments") },
    }))

    await runner.setupAll()
    await runner.teardownAll()

    expect(order).toEqual([
      "setup:base",
      "setup:auth",
      "setup:payments",
      "teardown:payments",
      "teardown:auth",
      "teardown:base",
    ])
  })
})
