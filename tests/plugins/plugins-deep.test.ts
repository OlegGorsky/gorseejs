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
})
