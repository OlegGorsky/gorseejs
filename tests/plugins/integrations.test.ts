import { describe, test, expect } from "bun:test"
import { drizzlePlugin, generateDrizzleConfig } from "../../src/plugins/drizzle.ts"
import { prismaPlugin, generatePrismaSchema } from "../../src/plugins/prisma.ts"
import { tailwindPlugin, generateTailwindConfig, generateTailwindCSS } from "../../src/plugins/tailwind.ts"
import { s3Plugin, getStorage } from "../../src/plugins/s3.ts"
import { resendPlugin, getMailer } from "../../src/plugins/resend.ts"
import { stripePlugin, getStripe } from "../../src/plugins/stripe.ts"
import { luciaPlugin, getLucia } from "../../src/plugins/lucia.ts"
import { validatePluginConformance } from "../../src/testing/index.ts"

describe("drizzlePlugin", () => {
  test("has correct name", () => {
    const p = drizzlePlugin({ schema: "./schema.ts", out: "./drizzle", dialect: "sqlite" })
    expect(p.name).toBe("gorsee-drizzle")
  })

  test("has setup and teardown", () => {
    const p = drizzlePlugin({ schema: "./schema.ts", out: "./drizzle", dialect: "sqlite" })
    expect(p.setup).toBeFunction()
    expect(p.teardown).toBeFunction()
  })

  test("generateDrizzleConfig produces valid config for sqlite", () => {
    const config = generateDrizzleConfig({ schema: "./db/schema.ts", out: "./drizzle", dialect: "sqlite" })
    expect(config).toContain('schema: "./db/schema.ts"')
    expect(config).toContain('dialect: "sqlite"')
    expect(config).toContain("defineConfig")
  })

  test("generateDrizzleConfig produces valid config for postgres", () => {
    const config = generateDrizzleConfig({
      schema: "./schema.ts", out: "./drizzle", dialect: "postgres",
      connectionUrl: "postgres://localhost/mydb",
    })
    expect(config).toContain('dialect: "postgres"')
    expect(config).toContain("connectionString")
  })
})

describe("prismaPlugin", () => {
  test("has correct name", () => {
    const p = prismaPlugin()
    expect(p.name).toBe("gorsee-prisma")
  })

  test("has setup and teardown", () => {
    const p = prismaPlugin({ datasourceUrl: "file:./test.db" })
    expect(p.setup).toBeFunction()
    expect(p.teardown).toBeFunction()
  })

  test("generatePrismaSchema produces valid schema", () => {
    const schema = generatePrismaSchema({ datasourceUrl: "file:./dev.db" })
    expect(schema).toContain("generator client")
    expect(schema).toContain('provider = "sqlite"')
    expect(schema).toContain("datasource db")
  })

  test("generatePrismaSchema detects postgres provider", () => {
    const schema = generatePrismaSchema({ datasourceUrl: "postgresql://localhost/db" })
    expect(schema).toContain('provider = "postgresql"')
  })
})

describe("tailwindPlugin", () => {
  test("has correct name", () => {
    const p = tailwindPlugin()
    expect(p.name).toBe("gorsee-tailwind")
  })

  test("has buildPlugins", () => {
    const p = tailwindPlugin()
    expect(p.buildPlugins).toBeFunction()
    const plugins = p.buildPlugins!()
    expect(plugins).toHaveLength(1)
    expect(plugins[0]!.name).toBe("gorsee-tailwind-transform")
  })

  test("satisfies plugin conformance through shared harness", async () => {
    await expect(validatePluginConformance(tailwindPlugin(), {
      middlewareCount: 0,
      routePaths: [],
      buildPluginNames: ["gorsee-tailwind-transform"],
      capabilities: ["build", "runtime", "styling"],
      pluginOrder: ["gorsee-tailwind"],
    })).resolves.toEqual({
      middlewareCount: 0,
      routePaths: [],
      buildPluginNames: ["gorsee-tailwind-transform"],
      capabilities: ["build", "runtime", "styling"],
      pluginOrder: ["gorsee-tailwind"],
      descriptors: [
        {
          name: "gorsee-tailwind",
          version: undefined,
          capabilities: ["build", "runtime", "styling"],
          dependsOn: [],
          before: [],
          after: [],
        },
      ],
    })
  })

  test("generateTailwindConfig produces valid config", () => {
    const config = generateTailwindConfig()
    expect(config).toContain("content:")
    expect(config).toContain("routes/**/*.{tsx,ts}")
    expect(config).toContain("components/**/*.{tsx,ts}")
  })

  test("generateTailwindCSS produces directives", () => {
    const css = generateTailwindCSS()
    expect(css).toContain("@tailwind base")
    expect(css).toContain("@tailwind components")
    expect(css).toContain("@tailwind utilities")
  })
})

describe("s3Plugin", () => {
  test("has correct name", () => {
    const p = s3Plugin({ bucket: "test-bucket" })
    expect(p.name).toBe("gorsee-s3")
  })

  test("provides storage after setup", async () => {
    const p = s3Plugin({ bucket: "my-bucket", region: "eu-west-1" })
    await p.setup!({ addMiddleware: () => {}, addRoute: () => {}, config: {} })
    const storage = getStorage()
    expect(storage.upload).toBeFunction()
    expect(storage.download).toBeFunction()
    expect(storage.delete).toBeFunction()
    expect(storage.list).toBeFunction()
    await p.teardown!()
  })
})

describe("resendPlugin", () => {
  test("has correct name", () => {
    const p = resendPlugin({ apiKey: "re_test_123" })
    expect(p.name).toBe("gorsee-resend")
  })

  test("provides mailer after setup", async () => {
    const p = resendPlugin({ apiKey: "re_test_123", from: "test@example.com" })
    await p.setup!({ addMiddleware: () => {}, addRoute: () => {}, config: {} })
    const mailer = getMailer()
    expect(mailer.send).toBeFunction()
    await p.teardown!()
  })
})

describe("stripePlugin", () => {
  test("has correct name", () => {
    const p = stripePlugin({ secretKey: "sk_test_123" })
    expect(p.name).toBe("gorsee-stripe")
  })

  test("provides stripe client after setup", async () => {
    const p = stripePlugin({ secretKey: "sk_test_123" })
    await p.setup!({ addMiddleware: () => {}, addRoute: () => {}, config: {} })
    const stripe = getStripe()
    expect(stripe.createCheckoutSession).toBeFunction()
    expect(stripe.verifyWebhook).toBeFunction()
    await p.teardown!()
  })

  test("registers webhook route when webhookSecret provided", async () => {
    await expect(validatePluginConformance(
      stripePlugin({ secretKey: "sk_test_123", webhookSecret: "whsec_123" }),
      {
        middlewareCount: 0,
        routePaths: ["/api/stripe/webhook"],
        buildPluginNames: [],
        capabilities: ["payments", "routes", "runtime"],
        pluginOrder: ["gorsee-stripe"],
      },
    )).resolves.toEqual({
      middlewareCount: 0,
      routePaths: ["/api/stripe/webhook"],
      buildPluginNames: [],
      capabilities: ["payments", "routes", "runtime"],
      pluginOrder: ["gorsee-stripe"],
      descriptors: [
        {
          name: "gorsee-stripe",
          version: undefined,
          capabilities: ["payments", "routes", "runtime"],
          dependsOn: [],
          before: [],
          after: [],
        },
      ],
    })
  })
})

describe("luciaPlugin", () => {
  test("has correct name", () => {
    const p = luciaPlugin({ adapter: "sqlite" })
    expect(p.name).toBe("gorsee-lucia")
  })

  test("has middleware for session validation", () => {
    const p = luciaPlugin({ adapter: "sqlite" })
    expect(p.middleware).toBeFunction()
  })

  test("satisfies middleware conformance through shared harness", async () => {
    await expect(validatePluginConformance(luciaPlugin({ adapter: "sqlite" }), {
      middlewareCount: 1,
      routePaths: [],
      buildPluginNames: [],
      capabilities: ["auth", "middleware", "runtime"],
      pluginOrder: ["gorsee-lucia"],
    })).resolves.toEqual({
      middlewareCount: 1,
      routePaths: [],
      buildPluginNames: [],
      capabilities: ["auth", "middleware", "runtime"],
      pluginOrder: ["gorsee-lucia"],
      descriptors: [
        {
          name: "gorsee-lucia",
          version: undefined,
          capabilities: ["auth", "middleware", "runtime"],
          dependsOn: [],
          before: [],
          after: [],
        },
      ],
    })
    void getLucia
  })
})
