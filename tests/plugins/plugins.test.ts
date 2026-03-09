import { describe, test, expect, mock } from "bun:test"
import {
  definePlugin,
  createPluginRunner,
  type GorseePlugin,
} from "../../src/plugins/index.ts"
import type { MiddlewareFn, Context } from "../../src/server/middleware.ts"

describe("definePlugin", () => {
  test("returns the same plugin object", () => {
    const plugin: GorseePlugin = { name: "test-plugin" }
    const result = definePlugin(plugin)
    expect(result).toBe(plugin)
    expect(result.name).toBe("test-plugin")
  })

  test("preserves all plugin fields", () => {
    const mw: MiddlewareFn = async (_ctx, next) => next()
    const plugin = definePlugin({
      name: "full-plugin",
      middleware: mw,
      setup: async () => {},
      teardown: async () => {},
      buildPlugins: () => [],
      capabilities: ["build"],
      dependsOn: ["base"],
      order: { after: ["base"] },
      configSchema: () => [],
      lifecycle: { dev: async () => {} },
    })
    expect(plugin.middleware).toBe(mw)
    expect(plugin.setup).toBeDefined()
    expect(plugin.teardown).toBeDefined()
    expect(plugin.buildPlugins).toBeDefined()
    expect(plugin.capabilities).toEqual(["build"])
    expect(plugin.dependsOn).toEqual(["base"])
    expect(plugin.order?.after).toEqual(["base"])
    expect(plugin.configSchema).toBeDefined()
    expect(plugin.lifecycle?.dev).toBeDefined()
  })
})

describe("createPluginRunner", () => {
  test("register adds plugins", () => {
    const runner = createPluginRunner()
    runner.register(definePlugin({ name: "a" }))
    runner.register(definePlugin({ name: "b" }))
    // No error means plugins registered
    expect(runner.getMiddlewares()).toHaveLength(0)
  })

  test("register rejects duplicate plugin names", () => {
    const runner = createPluginRunner()
    runner.register(definePlugin({ name: "dup" }))
    expect(() => runner.register(definePlugin({ name: "dup" }))).toThrow('Plugin "dup" is already registered.')
  })

  test("setupAll calls setup on each plugin in order", async () => {
    const order: string[] = []
    const runner = createPluginRunner({ key: "value" })

    runner.register(definePlugin({
      name: "first",
      setup: async (app) => {
        order.push("first")
        expect(app.config.key).toBe("value")
      },
    }))
    runner.register(definePlugin({
      name: "second",
      setup: async () => { order.push("second") },
    }))

    await runner.setupAll()
    expect(order).toEqual(["first", "second"])
  })

  test("setupAll respects dependency and order graph", async () => {
    const order: string[] = []
    const runner = createPluginRunner()
    runner.register(definePlugin({ name: "tail", setup: async () => { order.push("tail") } }))
    runner.register(definePlugin({
      name: "base",
      order: { before: ["tail"] },
      setup: async () => { order.push("base") },
    }))
    runner.register(definePlugin({
      name: "auth",
      dependsOn: ["base"],
      setup: async () => { order.push("auth") },
    }))

    await runner.setupAll()
    expect(order).toEqual(["base", "auth", "tail"])
  })

  test("teardownAll calls teardown in reverse order", async () => {
    const order: string[] = []
    const runner = createPluginRunner()

    runner.register(definePlugin({
      name: "first",
      teardown: async () => { order.push("first") },
    }))
    runner.register(definePlugin({
      name: "second",
      teardown: async () => { order.push("second") },
    }))

    await runner.teardownAll()
    expect(order).toEqual(["second", "first"])
  })

  test("getMiddlewares returns registered middlewares", () => {
    const runner = createPluginRunner()
    const mw1: MiddlewareFn = async (_ctx, next) => next()
    const mw2: MiddlewareFn = async (_ctx, next) => next()

    runner.register(definePlugin({ name: "p1", middleware: mw1 }))
    runner.register(definePlugin({ name: "p2", middleware: mw2 }))

    const middlewares = runner.getMiddlewares()
    expect(middlewares).toHaveLength(2)
    expect(middlewares[0]).toBe(mw1)
    expect(middlewares[1]).toBe(mw2)
  })

  test("getMiddlewares includes middlewares added via setup", async () => {
    const runner = createPluginRunner()
    const mw: MiddlewareFn = async (_ctx, next) => next()

    runner.register(definePlugin({
      name: "dynamic",
      setup: async (app) => { app.addMiddleware(mw) },
    }))

    await runner.setupAll()
    const middlewares = runner.getMiddlewares()
    expect(middlewares).toContain(mw)
  })

  test("getBuildPlugins aggregates from all plugins", () => {
    const runner = createPluginRunner()
    const bp1 = { name: "bp1", setup() {} }
    const bp2 = { name: "bp2", setup() {} }

    runner.register(definePlugin({ name: "p1", buildPlugins: () => [bp1] }))
    runner.register(definePlugin({ name: "p2", buildPlugins: () => [bp2] }))
    runner.register(definePlugin({ name: "p3" })) // no buildPlugins

    const plugins = runner.getBuildPlugins()
    expect(plugins).toHaveLength(2)
    expect(plugins[0]!.name).toBe("bp1")
    expect(plugins[1]!.name).toBe("bp2")
  })

  test("runPhase executes explicit lifecycle hooks", async () => {
    const seen: string[] = []
    const runner = createPluginRunner()
    runner.register(definePlugin({
      name: "phaseful",
      lifecycle: {
        build: async () => { seen.push("build") },
        test: async () => { seen.push("test") },
      },
    }))

    await runner.runPhase("build")
    await runner.runPhase("test")
    expect(seen).toEqual(["build", "test"])
  })

  test("getRoutes returns programmatically added routes", async () => {
    const runner = createPluginRunner()
    const handler = async () => new Response("ok")

    runner.register(definePlugin({
      name: "route-plugin",
      setup: async (app) => {
        app.addRoute("/api/custom", handler)
        app.addRoute("/api/other", handler)
      },
    }))

    await runner.setupAll()
    const routes = runner.getRoutes()
    expect(routes.size).toBe(2)
    expect(routes.has("/api/custom")).toBe(true)
    expect(routes.has("/api/other")).toBe(true)
  })

  test("getMiddlewares returns a copy, not internal array", () => {
    const runner = createPluginRunner()
    const mw: MiddlewareFn = async (_ctx, next) => next()
    runner.register(definePlugin({ name: "p1", middleware: mw }))

    const a = runner.getMiddlewares()
    const b = runner.getMiddlewares()
    expect(a).not.toBe(b)
    expect(a).toEqual(b)
  })

  test("getPluginDescriptors and capabilities expose normalized metadata", () => {
    const runner = createPluginRunner()
    runner.register(definePlugin({
      name: "meta",
      capabilities: ["db"],
      middleware: async (_ctx, next) => next(),
      buildPlugins: () => [{ name: "bp", setup() {} }],
    }))

    expect(runner.getCapabilities()).toEqual(["build", "db", "middleware"])
    expect(runner.getPluginDescriptors()).toEqual([
      {
        name: "meta",
        version: undefined,
        capabilities: ["build", "db", "middleware"],
        dependsOn: [],
        before: [],
        after: [],
      },
    ])
  })
})
