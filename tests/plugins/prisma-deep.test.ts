import { describe, test, expect } from "bun:test"
import { prismaPlugin, generatePrismaSchema, getPrisma } from "../../src/plugins/prisma.ts"

describe("prisma plugin deep", () => {
  test("prismaPlugin returns GorseePlugin shape", () => {
    const p = prismaPlugin()
    expect(p.name).toBe("gorsee-prisma")
    expect(typeof p.setup).toBe("function")
    expect(typeof p.teardown).toBe("function")
  })

  test("getPrisma throws before setup", async () => {
    const p = prismaPlugin()
    await p.teardown!()
    expect(() => getPrisma()).toThrow("Prisma not initialized")
  })

  test("generatePrismaSchema returns string", () => {
    const schema = generatePrismaSchema({})
    expect(typeof schema).toBe("string")
  })

  test("generatePrismaSchema includes datasource block", () => {
    const schema = generatePrismaSchema({})
    expect(schema).toContain("datasource db")
  })

  test("generatePrismaSchema includes generator block", () => {
    const schema = generatePrismaSchema({})
    expect(schema).toContain("generator client")
    expect(schema).toContain("prisma-client-js")
  })

  test("generatePrismaSchema with custom URL", () => {
    const schema = generatePrismaSchema({ datasourceUrl: "postgres://host/db" })
    expect(schema).toContain("postgres://host/db")
    expect(schema).toContain('provider = "postgresql"')
  })

  test("generatePrismaSchema default is sqlite", () => {
    const schema = generatePrismaSchema({})
    expect(schema).toContain('provider = "sqlite"')
    expect(schema).toContain("file:./dev.db")
  })

  test("generatePrismaSchema mysql detection", () => {
    const schema = generatePrismaSchema({ datasourceUrl: "mysql://host/db" })
    expect(schema).toContain('provider = "mysql"')
  })

  test("prismaPlugin setup creates placeholder when @prisma/client unavailable", async () => {
    const p = prismaPlugin({ datasourceUrl: "file:./test.db" })
    await p.setup!({ addMiddleware: () => {}, addRoute: () => {}, config: {} })
    // getPrisma should return the placeholder (not throw)
    const client = getPrisma<{ _placeholder: boolean }>()
    expect(client._placeholder).toBe(true)
    await p.teardown!()
  })

  test("prismaPlugin teardown clears client", async () => {
    const p = prismaPlugin()
    await p.setup!({ addMiddleware: () => {}, addRoute: () => {}, config: {} })
    await p.teardown!()
    expect(() => getPrisma()).toThrow()
  })
})
