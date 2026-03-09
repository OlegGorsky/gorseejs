import { describe, test, expect } from "bun:test"
import { drizzlePlugin, generateDrizzleConfig, getDrizzle } from "../../src/plugins/drizzle.ts"

describe("drizzle plugin deep", () => {
  test("drizzlePlugin returns GorseePlugin shape", () => {
    const p = drizzlePlugin({ schema: "./s.ts", out: "./d", dialect: "sqlite" })
    expect(p.name).toBe("gorsee-drizzle")
    expect(typeof p.setup).toBe("function")
    expect(typeof p.teardown).toBe("function")
  })

  test("getDrizzle throws before setup", () => {
    // Ensure teardown was called from previous tests
    const p = drizzlePlugin({ schema: "./s.ts", out: "./d", dialect: "sqlite" })
    // force teardown to clear state
    p.teardown!()
    expect(() => getDrizzle()).toThrow("Drizzle not initialized")
  })

  test("generateDrizzleConfig includes schema path", () => {
    const cfg = generateDrizzleConfig({ schema: "./db/schema.ts", out: "./out", dialect: "sqlite" })
    expect(cfg).toContain('schema: "./db/schema.ts"')
  })

  test("generateDrizzleConfig includes out path", () => {
    const cfg = generateDrizzleConfig({ schema: "./s.ts", out: "./migrations", dialect: "sqlite" })
    expect(cfg).toContain('out: "./migrations"')
  })

  test("generateDrizzleConfig includes dialect", () => {
    const cfg = generateDrizzleConfig({ schema: "./s.ts", out: "./d", dialect: "postgres" })
    expect(cfg).toContain('dialect: "postgres"')
  })

  test("generateDrizzleConfig sqlite uses url credential", () => {
    const cfg = generateDrizzleConfig({ schema: "./s.ts", out: "./d", dialect: "sqlite" })
    expect(cfg).toContain("url:")
  })

  test("generateDrizzleConfig postgres uses connectionString", () => {
    const cfg = generateDrizzleConfig({
      schema: "./s.ts", out: "./d", dialect: "postgres",
      connectionUrl: "postgres://localhost/db",
    })
    expect(cfg).toContain("connectionString")
    expect(cfg).toContain("postgres://localhost/db")
  })

  test("generateDrizzleConfig mysql uses connectionString", () => {
    const cfg = generateDrizzleConfig({
      schema: "./s.ts", out: "./d", dialect: "mysql",
      connectionUrl: "mysql://localhost/db",
    })
    expect(cfg).toContain("connectionString")
  })

  test("generateDrizzleConfig imports defineConfig", () => {
    const cfg = generateDrizzleConfig({ schema: "./s.ts", out: "./d", dialect: "sqlite" })
    expect(cfg).toContain('import { defineConfig } from "drizzle-kit"')
  })

  test("generateDrizzleConfig default sqlite url is ./data.db", () => {
    const cfg = generateDrizzleConfig({ schema: "./s.ts", out: "./d", dialect: "sqlite" })
    expect(cfg).toContain("./data.db")
  })
})
