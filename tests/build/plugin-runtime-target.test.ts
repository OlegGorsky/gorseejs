import { describe, expect, test } from "bun:test"
import { defineBuildPlugin, resolveBuildPluginsForTarget } from "../../src/build/plugin.ts"

describe("build plugin runtime target contract", () => {
  test("selects only Bun-compatible plugin implementations for bun backend", () => {
    const plugins = [
      defineBuildPlugin({
        name: "dual",
        bun: { name: "dual-bun", setup() {} },
        rolldown: { name: "dual-rolldown" },
      }),
      defineBuildPlugin({
        name: "rolldown-only",
        rolldown: { name: "rolldown-only" },
      }),
    ]

    const resolved = resolveBuildPluginsForTarget(plugins, "bun")
    expect(resolved).toHaveLength(1)
    expect(resolved[0]!.name).toBe("dual-bun")
  })

  test("selects only Rolldown-compatible plugin implementations for rolldown backend", () => {
    const plugins = [
      defineBuildPlugin({
        name: "dual",
        bun: { name: "dual-bun", setup() {} },
        rolldown: { name: "dual-rolldown" },
      }),
      defineBuildPlugin({
        name: "bun-only",
        bun: { name: "bun-only", setup() {} },
      }),
    ]

    const resolved = resolveBuildPluginsForTarget(plugins, "rolldown")
    expect(resolved).toHaveLength(1)
    expect(resolved[0]!.name).toBe("dual-rolldown")
  })
})
