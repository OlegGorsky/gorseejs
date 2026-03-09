import { afterEach, describe, expect, test } from "bun:test"
import {
  createFixtureAppHarness,
  createWorkspaceFixtureHarness,
  createPluginConformanceHarness,
} from "../../src/testing/index.ts"
import { definePlugin } from "../../src/plugins/index.ts"

const cleanups: Array<() => Promise<void>> = []

afterEach(async () => {
  while (cleanups.length > 0) {
    await cleanups.pop()?.()
  }
})

describe("downstream conformance harness", () => {
  test("fixture app harness materializes deterministic app files", async () => {
    const harness = await createFixtureAppHarness([
      { path: "routes/index.tsx", content: "export default function Page(){ return <main>ok</main> }\n" },
      { path: "package.json", content: '{ "name": "fixture-app" }\n' },
    ])
    cleanups.push(() => harness.cleanup())

    await harness.write()

    expect(await harness.listFiles()).toEqual(["package.json", "routes/index.tsx"])
    expect(await harness.read("package.json")).toContain('"fixture-app"')
  })

  test("workspace fixture harness materializes package-scoped files", async () => {
    const harness = await createWorkspaceFixtureHarness(
      [
        {
          path: "apps/web",
          files: [{ path: "package.json", content: '{ "name": "web" }\n' }],
        },
        {
          path: "packages/ui",
          files: [{ path: "index.ts", content: "export const Button = 'button'\n" }],
        },
      ],
      [{ path: "package.json", content: '{ "name": "workspace-root", "private": true }\n' }],
    )
    cleanups.push(() => harness.cleanup())

    await harness.write()

    expect(await harness.listFiles()).toEqual([
      "apps/web/package.json",
      "package.json",
      "packages/ui/index.ts",
    ])
  })

  test("plugin conformance harness captures middleware, routes, and build plugins", async () => {
    const harness = createPluginConformanceHarness({ feature: "enabled" })
    harness.register(definePlugin({
      name: "conformance-plugin",
      middleware: async (_ctx, next) => next(),
      buildPlugins: () => [{ name: "fixture-build-plugin", setup() {} }],
      setup: async (app) => {
        expect(app.config.feature).toBe("enabled")
        app.addRoute("/api/fixture", async () => new Response("fixture-ok"))
      },
    }))

    await harness.setupAll()
    const result = harness.getResult()
    const response = await harness.testRoute("/api/fixture")

    expect(result).toEqual({
      middlewareCount: 1,
      routePaths: ["/api/fixture"],
      buildPluginNames: ["fixture-build-plugin"],
      capabilities: ["build", "middleware", "runtime"],
      pluginOrder: ["conformance-plugin"],
      descriptors: [
        {
          name: "conformance-plugin",
          version: undefined,
          capabilities: ["build", "middleware", "runtime"],
          dependsOn: [],
          before: [],
          after: [],
        },
      ],
    })
    expect(await response.text()).toBe("fixture-ok")

    await harness.teardownAll()
  })
})
