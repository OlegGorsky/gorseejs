import { describe, it, expect } from "bun:test"

import { generateVercelConfig, generateVercelServerlessEntry, generateVercelBuildOutput } from "../../src/deploy/vercel.ts"
import { generateFlyConfig, generateFlyDockerfile } from "../../src/deploy/fly.ts"
import { generateWranglerConfig, generateCloudflareEntry, generateCloudflareStaticAssets } from "../../src/deploy/cloudflare.ts"
import { generateNetlifyConfig, generateNetlifyFunction } from "../../src/deploy/netlify.ts"
import { generateDockerfile, generateDockerignore } from "../../src/deploy/dockerfile.ts"

describe("Vercel adapter", () => {
  it("generates correct config structure", () => {
    const config = generateVercelConfig()
    expect(config.version).toBe(2)
    expect(config.framework).toBeNull()
    expect(config.buildCommand).toBe("bun run build")
    expect(config.outputDirectory).toBe(".vercel/output")
    expect(config.routes.length).toBeGreaterThan(0)
  })

  it("serverless entry contains export default", () => {
    const entry = generateVercelServerlessEntry()
    expect(entry).toContain("export default")
    expect(entry).toContain("async function handler")
    expect(entry).toContain("../dist/server-handler-node.js")
    expect(entry).toContain("handleRequest(request, { vercel: true }, { rpcPolicy })")
  })

  it("build output contains static and dynamic routes", () => {
    const output = generateVercelBuildOutput(["/", "/about"])
    expect(output.version).toBe(3)
    expect(output.routes.some((r) => r.src.includes("_gorsee"))).toBe(true)
    expect(output.routes.some((r) => r.dest?.includes("functions"))).toBe(true)
  })
})

describe("Fly.io adapter", () => {
  it("fly.toml contains app name", () => {
    const config = generateFlyConfig("my-gorsee-app")
    expect(config).toContain('app = "my-gorsee-app"')
    expect(config).toContain('primary_region = "iad"')
  })

  it("fly.toml has health check", () => {
    const config = generateFlyConfig("test-app")
    expect(config).toContain("/api/health")
    expect(config).toContain("http_service.checks")
  })

  it("Dockerfile has multi-stage build and HEALTHCHECK", () => {
    const dockerfile = generateFlyDockerfile()
    expect(dockerfile).toContain("FROM oven/bun:1 AS builder")
    expect(dockerfile).toContain("FROM oven/bun:1-slim")
    expect(dockerfile).toContain("HEALTHCHECK")
    expect(dockerfile).toContain("FLY_ALLOC_ID")
  })

  it("Node runtime profile emits a Node production entrypoint", () => {
    const dockerfile = generateFlyDockerfile("node")
    expect(dockerfile).toContain("FROM node:20-bookworm-slim")
    expect(dockerfile).toContain('CMD ["node", "dist/prod-node.js"]')
    expect(dockerfile).not.toContain("/app/routes")
  })
})

describe("Cloudflare adapter", () => {
  it("wrangler.toml has compatibility flags", () => {
    const config = generateWranglerConfig("my-worker")
    expect(config).toContain('name = "my-worker"')
    expect(config).toContain('compatibility_flags = ["nodejs_compat"]')
    expect(config).toContain("compatibility_date")
  })

  it("worker entry has fetch handler", () => {
    const entry = generateCloudflareEntry()
    expect(entry).toContain("export default")
    expect(entry).toContain("async fetch(")
    expect(entry).toContain("request: Request")
  })

  it("static assets config excludes known paths", () => {
    const routes = generateCloudflareStaticAssets()
    expect(routes.version).toBe(1)
    expect(routes.include).toContain("/*")
    expect(routes.exclude).toContain("/_gorsee/*")
  })
})

describe("Netlify adapter", () => {
  it("netlify.toml has build config", () => {
    const config = generateNetlifyConfig()
    expect(config).toContain("[build]")
    expect(config).toContain('command = "bun run build"')
    expect(config).toContain('publish = "dist/client"')
  })

  it("edge function has handler", () => {
    const fn = generateNetlifyFunction()
    expect(fn).toContain("export default async function handler")
    expect(fn).toContain("context: Context")
    expect(fn).toContain("context.next()")
  })
})

describe("Docker adapter (existing)", () => {
  it("Dockerfile has multi-stage build", () => {
    const dockerfile = generateDockerfile()
    expect(dockerfile).toContain("FROM oven/bun:1 AS builder")
    expect(dockerfile).toContain("FROM oven/bun:1-slim")
    expect(dockerfile).toContain("bun run build")
  })

  it("dockerignore excludes node_modules", () => {
    const ignore = generateDockerignore()
    expect(ignore).toContain("node_modules")
    expect(ignore).toContain(".git")
  })

  it("Dockerfile supports a Node runtime profile", () => {
    const dockerfile = generateDockerfile("node")
    expect(dockerfile).toContain("FROM node:20-bookworm-slim")
    expect(dockerfile).toContain('CMD ["node", "dist/prod-node.js"]')
    expect(dockerfile).not.toContain("/app/routes")
  })
})
