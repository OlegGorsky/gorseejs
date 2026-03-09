import { describe, test, expect } from "bun:test"
import {
  tailwindPlugin,
  generateTailwindConfig,
  generateTailwindCSS,
} from "../../src/plugins/tailwind.ts"

describe("tailwind plugin deep", () => {
  test("tailwindPlugin returns GorseePlugin", () => {
    const p = tailwindPlugin()
    expect(p.name).toBe("gorsee-tailwind")
  })

  test("tailwindPlugin has buildPlugins function", () => {
    const p = tailwindPlugin()
    expect(typeof p.buildPlugins).toBe("function")
  })

  test("buildPlugins returns backend-neutral build plugin descriptors", () => {
    const p = tailwindPlugin()
    const plugins = p.buildPlugins!()
    expect(Array.isArray(plugins)).toBe(true)
    expect(plugins).toHaveLength(1)
    expect(plugins[0]!.name).toBe("gorsee-tailwind-transform")
    expect(plugins[0]!.bun?.name).toBe("gorsee-tailwind-transform")
  })

  test("generateTailwindConfig returns string", () => {
    const cfg = generateTailwindConfig()
    expect(typeof cfg).toBe("string")
  })

  test("generateTailwindConfig includes default content paths", () => {
    const cfg = generateTailwindConfig()
    expect(cfg).toContain("routes/**/*.{tsx,ts}")
    expect(cfg).toContain("components/**/*.{tsx,ts}")
  })

  test("generateTailwindConfig with custom content paths", () => {
    const cfg = generateTailwindConfig({ content: ["./pages/**/*.tsx", "./lib/**/*.ts"] })
    expect(cfg).toContain("pages/**/*.tsx")
    expect(cfg).toContain("lib/**/*.ts")
    expect(cfg).not.toContain("routes/**")
  })

  test("generateTailwindConfig with custom theme", () => {
    const cfg = generateTailwindConfig({ theme: { colors: { brand: "#ff0" } } })
    expect(cfg).toContain("brand")
    expect(cfg).toContain("#ff0")
  })

  test("generateTailwindCSS includes @tailwind base", () => {
    const css = generateTailwindCSS()
    expect(css).toContain("@tailwind base;")
  })

  test("generateTailwindCSS includes @tailwind components", () => {
    const css = generateTailwindCSS()
    expect(css).toContain("@tailwind components;")
  })

  test("generateTailwindCSS includes @tailwind utilities", () => {
    const css = generateTailwindCSS()
    expect(css).toContain("@tailwind utilities;")
  })

  test("tailwindPlugin has setup function", () => {
    const p = tailwindPlugin()
    expect(typeof p.setup).toBe("function")
  })
})
