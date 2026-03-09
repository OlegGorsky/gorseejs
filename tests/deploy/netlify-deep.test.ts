import { describe, test, expect } from "bun:test"
import {
  generateNetlifyConfig,
  generateNetlifyFunction,
} from "../../src/deploy/netlify.ts"

describe("netlify-deep", () => {
  const config = generateNetlifyConfig()
  const fn = generateNetlifyFunction()

  test("config has build command", () => {
    expect(config).toContain('command = "bun run build"')
  })

  test("config has publish directory", () => {
    expect(config).toContain('publish = "dist/client"')
  })

  test("config has edge functions section", () => {
    expect(config).toContain("[[edge_functions]]")
    expect(config).toContain('function = "gorsee-handler"')
  })

  test("config has edge function for all paths", () => {
    expect(config).toContain('path = "/*"')
  })

  test("config has redirects for SPA fallback", () => {
    expect(config).toContain("[[redirects]]")
    expect(config).toContain("status = 200")
  })

  test("config has cache headers for static assets", () => {
    expect(config).toContain("[[headers]]")
    expect(config).toContain('for = "/_gorsee/*"')
    expect(config).toContain("max-age=31536000")
  })

  test("config has NODE_VERSION env", () => {
    expect(config).toContain('NODE_VERSION = "20"')
  })

  test("config declares APP_ORIGIN env", () => {
    expect(config).toContain('APP_ORIGIN = "REPLACE_WITH_APP_ORIGIN"')
  })

  test("edge function has handler export", () => {
    expect(fn).toContain("export default async function handler")
  })

  test("edge function receives Request and Context", () => {
    expect(fn).toContain("request: Request")
    expect(fn).toContain("context: Context")
  })

  test("edge function exports config with path", () => {
    expect(fn).toContain('export const config = { path: "/*" }')
  })

  test("edge function skips static assets", () => {
    expect(fn).toContain("context.next()")
    expect(fn).toContain("/_gorsee/")
  })

  test("edge function imports from Netlify edge", () => {
    expect(fn).toContain('from "https://edge.netlify.com"')
  })

  test("edge function forwards explicit RPC policy to server handler", () => {
    expect(fn).toContain("const rpcPolicy = {")
    expect(fn).toContain("middlewares: []")
    expect(fn).toContain("handleRequest(request, { netlifyContext: context }, { rpcPolicy })")
    expect(fn).toContain('Netlify.env.get("APP_ORIGIN")')
  })
})
