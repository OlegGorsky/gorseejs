import { describe, test, expect } from "bun:test"
import {
  generateVercelConfig,
  generateVercelServerlessEntry,
  generateVercelBuildOutput,
} from "../../src/deploy/vercel.ts"

describe("vercel-deep", () => {
  const config = generateVercelConfig()

  test("config has version 2", () => {
    expect(config.version).toBe(2)
  })

  test("config has correct build command", () => {
    expect(config.buildCommand).toBe("bun run build")
  })

  test("config has routes array with entries", () => {
    expect(Array.isArray(config.routes)).toBe(true)
    expect(config.routes.length).toBeGreaterThanOrEqual(2)
  })

  test("config routes include static asset caching", () => {
    const assetRoute = config.routes.find((r) => r.src.includes("_gorsee"))
    expect(assetRoute).toBeDefined()
    expect(assetRoute!.headers!["Cache-Control"]).toContain("immutable")
  })

  test("config routes include catch-all to serverless", () => {
    const catchAll = config.routes.find((r) => r.dest?.includes("api/index"))
    expect(catchAll).toBeDefined()
  })

  test("config outputDirectory is .vercel/output", () => {
    expect(config.outputDirectory).toBe(".vercel/output")
  })

  test("config framework is null", () => {
    expect(config.framework).toBeNull()
  })

  test("serverless entry has export default", () => {
    const entry = generateVercelServerlessEntry()
    expect(entry).toContain("export default")
  })

  test("serverless entry handles Request", () => {
    const entry = generateVercelServerlessEntry()
    expect(entry).toContain("request: Request")
    expect(entry).toContain("Promise<Response>")
  })

  test("serverless entry forwards explicit RPC policy to built server handler", () => {
    const entry = generateVercelServerlessEntry()
    expect(entry).toContain("../dist/server-handler-node.js")
    expect(entry).toContain("handleRequest(request, { vercel: true }, { rpcPolicy })")
    expect(entry).toContain("middlewares: []")
    expect(entry).toContain('process.env.APP_ORIGIN')
  })

  test("build output config version is 3", () => {
    const output = generateVercelBuildOutput(["/", "/about"])
    expect(output.version).toBe(3)
  })

  test("build output has static asset routing", () => {
    const output = generateVercelBuildOutput(["/"])
    const staticRoute = output.routes.find((r) => r.src.includes("_gorsee"))
    expect(staticRoute).toBeDefined()
    expect(staticRoute!.dest).toContain("static")
  })
})
