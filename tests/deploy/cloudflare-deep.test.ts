import { describe, test, expect } from "bun:test"
import {
  generateWranglerConfig,
  generateCloudflareEntry,
  generateCloudflareStaticAssets,
} from "../../src/deploy/cloudflare.ts"

describe("cloudflare-deep", () => {
  const wrangler = generateWranglerConfig("my-worker")
  const entry = generateCloudflareEntry()
  const assets = generateCloudflareStaticAssets()

  test("wrangler config has name", () => {
    expect(wrangler).toContain('name = "my-worker"')
  })

  test("wrangler config has compatibility_flags", () => {
    expect(wrangler).toContain('compatibility_flags = ["nodejs_compat"]')
  })

  test("wrangler config has compatibility_date", () => {
    expect(wrangler).toMatch(/compatibility_date = "\d{4}-\d{2}-\d{2}"/)
  })

  test("wrangler config has build command", () => {
    expect(wrangler).toContain('command = "bun run build"')
  })

  test("wrangler config declares APP_ORIGIN", () => {
    expect(wrangler).toContain('APP_ORIGIN = "REPLACE_WITH_APP_ORIGIN"')
  })

  test("wrangler config has site bucket", () => {
    expect(wrangler).toContain('bucket = "./dist/client"')
  })

  test("worker entry has export default", () => {
    expect(entry).toContain("export default")
  })

  test("worker entry has fetch handler", () => {
    expect(entry).toContain("async fetch(")
    expect(entry).toContain("request: Request")
    expect(entry).toContain("env: Record<string, unknown>")
  })

  test("worker entry forwards explicit RPC policy to server handler", () => {
    expect(entry).toContain("const rpcPolicy = {")
    expect(entry).toContain("middlewares: []")
    expect(entry).toContain("handleRequest(request, env, { rpcPolicy })")
    expect(entry).toContain('./dist/server-handler.js')
    expect(entry).toContain("env.APP_ORIGIN")
  })

  test("worker entry serves static assets from /_gorsee/", () => {
    expect(entry).toContain('url.pathname.startsWith("/_gorsee/")')
    expect(entry).toContain("__STATIC_CONTENT")
  })

  test("static assets config excludes patterns", () => {
    expect(assets.exclude).toContain("/_gorsee/*")
    expect(assets.exclude).toContain("/favicon.ico")
    expect(assets.exclude).toContain("/*.png")
  })

  test("routes config is valid JSON structure", () => {
    expect(assets.version).toBe(1)
    expect(Array.isArray(assets.include)).toBe(true)
    expect(Array.isArray(assets.exclude)).toBe(true)
    expect(assets.include).toContain("/*")
  })
})
