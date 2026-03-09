import { describe, test, expect } from "bun:test"
import { generateFlyConfig, generateFlyDockerfile } from "../../src/deploy/fly.ts"

describe("fly-deep", () => {
  const config = generateFlyConfig("test-app")
  const dockerfile = generateFlyDockerfile()

  test("config includes app name", () => {
    expect(config).toContain('app = "test-app"')
  })

  test("config has primary_region", () => {
    expect(config).toContain('primary_region = "iad"')
  })

  test("config has health check path /api/health", () => {
    expect(config).toContain('path = "/api/health"')
  })

  test("config has auto_stop_machines", () => {
    expect(config).toContain('auto_stop_machines = "stop"')
  })

  test("config has concurrency limits", () => {
    expect(config).toContain("hard_limit = 250")
    expect(config).toContain("soft_limit = 200")
  })

  test("config has NODE_ENV production", () => {
    expect(config).toContain('NODE_ENV = "production"')
  })

  test("config declares APP_ORIGIN placeholder", () => {
    expect(config).toContain('APP_ORIGIN = "REPLACE_WITH_APP_ORIGIN"')
    expect(dockerfile).toContain("ENV APP_ORIGIN=REPLACE_WITH_APP_ORIGIN")
  })

  test("config uses correct port 3000", () => {
    expect(config).toContain("internal_port = 3000")
  })

  test("Dockerfile has multi-stage build", () => {
    expect(dockerfile).toContain("FROM oven/bun:1 AS builder")
    expect(dockerfile).toContain("FROM oven/bun:1-slim")
  })

  test("Dockerfile has HEALTHCHECK", () => {
    expect(dockerfile).toContain("HEALTHCHECK")
    expect(dockerfile).toContain("curl -f http://localhost:3000/api/health")
  })

  test("Dockerfile exposes port 3000", () => {
    expect(dockerfile).toContain("EXPOSE 3000")
  })
})
