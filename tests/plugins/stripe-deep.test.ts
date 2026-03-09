import { describe, test, expect } from "bun:test"
import { stripePlugin, getStripe } from "../../src/plugins/stripe.ts"

const pluginCtx = { addMiddleware: () => {}, addRoute: () => {}, config: {} }

describe("stripe plugin deep", () => {
  test("stripePlugin returns GorseePlugin", () => {
    const p = stripePlugin({ secretKey: "sk_test" })
    expect(p.name).toBe("gorsee-stripe")
  })

  test("stripePlugin has setup and teardown", () => {
    const p = stripePlugin({ secretKey: "sk_test" })
    expect(typeof p.setup).toBe("function")
    expect(typeof p.teardown).toBe("function")
  })

  test("getStripe throws before setup", async () => {
    const p = stripePlugin({ secretKey: "sk_test" })
    await p.teardown!()
    expect(() => getStripe()).toThrow("Stripe not initialized")
  })

  test("after setup, getStripe returns client", async () => {
    const p = stripePlugin({ secretKey: "sk_test" })
    await p.setup!(pluginCtx)
    expect(getStripe()).toBeDefined()
    await p.teardown!()
  })

  test("client has createCheckoutSession method", async () => {
    const p = stripePlugin({ secretKey: "sk_test" })
    await p.setup!(pluginCtx)
    expect(typeof getStripe().createCheckoutSession).toBe("function")
    await p.teardown!()
  })

  test("client has verifyWebhook method", async () => {
    const p = stripePlugin({ secretKey: "sk_test" })
    await p.setup!(pluginCtx)
    expect(typeof getStripe().verifyWebhook).toBe("function")
    await p.teardown!()
  })

  test("webhook route registered when webhookSecret provided", async () => {
    const routes: string[] = []
    const ctx = {
      addMiddleware: () => {},
      addRoute: (path: string) => { routes.push(path) },
      config: {},
    }
    const p = stripePlugin({ secretKey: "sk_test", webhookSecret: "whsec_123" })
    await p.setup!(ctx)
    expect(routes).toContain("/api/stripe/webhook")
    await p.teardown!()
  })

  test("no webhook route when webhookSecret not provided", async () => {
    const routes: string[] = []
    const ctx = {
      addMiddleware: () => {},
      addRoute: (path: string) => { routes.push(path) },
      config: {},
    }
    const p = stripePlugin({ secretKey: "sk_test" })
    await p.setup!(ctx)
    expect(routes).toHaveLength(0)
    await p.teardown!()
  })

  test("teardown clears client", async () => {
    const p = stripePlugin({ secretKey: "sk_test" })
    await p.setup!(pluginCtx)
    await p.teardown!()
    expect(() => getStripe()).toThrow()
  })

  test("multiple setup/teardown cycles", async () => {
    const p = stripePlugin({ secretKey: "sk_test" })
    await p.setup!(pluginCtx)
    expect(getStripe()).toBeDefined()
    await p.teardown!()
    await p.setup!(pluginCtx)
    expect(getStripe()).toBeDefined()
    await p.teardown!()
  })
})
