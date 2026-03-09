import { describe, test, expect } from "bun:test"
import { resendPlugin, getMailer } from "../../src/plugins/resend.ts"

const pluginCtx = { addMiddleware: () => {}, addRoute: () => {}, config: {} }

describe("resend plugin deep", () => {
  test("resendPlugin returns GorseePlugin", () => {
    const p = resendPlugin({ apiKey: "re_test" })
    expect(p.name).toBe("gorsee-resend")
  })

  test("resendPlugin has setup and teardown", () => {
    const p = resendPlugin({ apiKey: "re_test" })
    expect(typeof p.setup).toBe("function")
    expect(typeof p.teardown).toBe("function")
  })

  test("getMailer throws before setup", async () => {
    const p = resendPlugin({ apiKey: "re_test" })
    await p.teardown!()
    expect(() => getMailer()).toThrow("Resend not initialized")
  })

  test("after setup, getMailer returns client", async () => {
    const p = resendPlugin({ apiKey: "re_test" })
    await p.setup!(pluginCtx)
    const mailer = getMailer()
    expect(mailer).toBeDefined()
    await p.teardown!()
  })

  test("client has send method", async () => {
    const p = resendPlugin({ apiKey: "re_test" })
    await p.setup!(pluginCtx)
    expect(typeof getMailer().send).toBe("function")
    await p.teardown!()
  })

  test("teardown clears client", async () => {
    const p = resendPlugin({ apiKey: "re_test" })
    await p.setup!(pluginCtx)
    await p.teardown!()
    expect(() => getMailer()).toThrow()
  })

  test("resendPlugin with custom from address", async () => {
    const p = resendPlugin({ apiKey: "re_test", from: "no-reply@example.com" })
    await p.setup!(pluginCtx)
    expect(getMailer()).toBeDefined()
    await p.teardown!()
  })

  test("multiple setup/teardown cycles work", async () => {
    const p = resendPlugin({ apiKey: "re_test" })
    await p.setup!(pluginCtx)
    expect(getMailer()).toBeDefined()
    await p.teardown!()
    expect(() => getMailer()).toThrow()
    await p.setup!(pluginCtx)
    expect(getMailer()).toBeDefined()
    await p.teardown!()
  })
})
