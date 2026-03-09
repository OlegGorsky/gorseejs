import { describe, expect, test } from "bun:test"
import {
  createProjectContext,
  resolveProjectPaths,
  resolveRuntimeEnv,
} from "../../src/runtime/project.ts"

describe("runtime project context", () => {
  test("resolveProjectPaths builds shared layout for cli and runtime", () => {
    const paths = resolveProjectPaths("/tmp/app")
    expect(paths.routesDir).toBe("/tmp/app/routes")
    expect(paths.clientDir).toBe("/tmp/app/dist/client")
    expect(paths.gorseeDir).toBe("/tmp/app/.gorsee")
  })

  test("createProjectContext honors explicit cwd and env", () => {
    const env = { PORT: "4123", LOG_LEVEL: "debug" } as NodeJS.ProcessEnv
    const ctx = createProjectContext({ cwd: "/tmp/app", env })
    expect(ctx.cwd).toBe("/tmp/app")
    expect(ctx.env).toBe(env)
    expect(ctx.paths.publicDir).toBe("/tmp/app/public")
  })

  test("resolveRuntimeEnv normalizes server config from env", () => {
    const config = resolveRuntimeEnv({
      PORT: "4123",
      LOG_LEVEL: "debug",
      RATE_LIMIT: "77",
      RATE_WINDOW: "5m",
      NODE_ENV: "production",
    })
    expect(config.port).toBe(4123)
    expect(config.logLevel).toBe("debug")
    expect(config.rateLimit).toBe(77)
    expect(config.rateWindow).toBe("5m")
    expect(config.isProduction).toBe(true)
  })
})
