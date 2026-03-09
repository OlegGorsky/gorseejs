import { afterEach, describe, expect, test } from "bun:test"
import { useFormAction } from "../../src/runtime/form.ts"

const originalFetch = globalThis.fetch
const originalLocation = globalThis.location

afterEach(() => {
  globalThis.fetch = originalFetch
  Object.defineProperty(globalThis, "location", {
    configurable: true,
    value: originalLocation,
  })
})

describe("useFormAction", () => {
  test("captures success result and status", async () => {
    globalThis.fetch = ((async () => new Response(JSON.stringify({ ok: true, status: 200, data: { ok: true } }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })) as unknown) as typeof fetch
    Object.defineProperty(globalThis, "location", {
      configurable: true,
      value: { pathname: "/submit" },
    })

    const form = useFormAction<{ ok: boolean }>()
    const result = await form.submit({ email: "user@example.com" })

    expect(result.ok).toBe(true)
    expect(result.status).toBe(200)
    expect(result.data).toEqual({ ok: true })
    expect(form.status()).toBe("success")
    expect(form.data()).toEqual({ ok: true })
  })

  test("captures field/form errors from action responses", async () => {
    globalThis.fetch = ((async () => new Response(JSON.stringify({
      ok: false,
      status: 400,
      error: "Validation failed",
      fieldErrors: { email: ["Email is required"] },
      formErrors: ["Try again"],
    }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })) as unknown) as typeof fetch
    Object.defineProperty(globalThis, "location", {
      configurable: true,
      value: { pathname: "/submit" },
    })

    const form = useFormAction()
    const result = await form.submit({ email: "" })

    expect(result.ok).toBe(false)
    expect(result.status).toBe(400)
    expect(result.error).toBe("Validation failed")
    expect(form.status()).toBe("error")
    expect(form.fieldErrors()).toEqual({ email: ["Email is required"] })
    expect(form.formErrors()).toEqual(["Try again"])
  })
})
