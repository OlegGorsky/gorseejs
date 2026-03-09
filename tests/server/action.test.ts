import { describe, test, expect } from "bun:test"
import { actionFailure, actionSuccess, defineAction, handleAction } from "../../src/server/action.ts"
import { createContext } from "../../src/server/middleware.ts"

describe("Server Actions", () => {
  function makeCtx(body?: string) {
    const request = new Request("http://localhost/test", {
      method: "POST",
      body,
    })
    return createContext(request)
  }

  test("defineAction returns the same function", () => {
    const fn = async () => ({ ok: true })
    expect(defineAction(fn)).toBe(fn)
  })

  test("handleAction returns data on success", async () => {
    const action = defineAction(async () => ({ message: "created" }))
    const ctx = makeCtx()
    const result = await handleAction(action, ctx)
    expect(result.ok).toBe(true)
    expect(result.status).toBe(200)
    expect(result.data).toEqual({ message: "created" })
    expect(result.error).toBeUndefined()
  })

  test("handleAction returns error on failure", async () => {
    const action = defineAction(async () => {
      throw new Error("Validation failed")
    })
    const ctx = makeCtx()
    const result = await handleAction(action, ctx)
    expect(result.ok).toBe(false)
    expect(result.status).toBe(500)
    expect(result.error).toBe("Validation failed")
    expect(result.data).toBeUndefined()
  })

  test("handleAction handles Response return", async () => {
    const action = defineAction(async () => {
      return new Response(null, { status: 201 })
    })
    const ctx = makeCtx()
    const result = await handleAction(action, ctx)
    expect(result.ok).toBe(true)
    expect(result.status).toBe(201)
  })

  test("handleAction preserves explicit structured action failures", async () => {
    const action = defineAction(async () =>
      actionFailure("Validation failed", {
        fieldErrors: { email: ["Email is required"] },
        formErrors: ["Try again"],
        values: { email: "" },
      }))
    const ctx = makeCtx()
    const result = await handleAction(action, ctx)
    expect(result).toEqual({
      ok: false,
      status: 400,
      error: "Validation failed",
      fieldErrors: { email: ["Email is required"] },
      formErrors: ["Try again"],
      values: { email: "" },
      data: undefined,
    })
  })

  test("actionSuccess creates canonical success envelopes", () => {
    expect(actionSuccess({ created: true })).toEqual({
      ok: true,
      status: 200,
      data: { created: true },
      error: undefined,
      fieldErrors: undefined,
      formErrors: undefined,
      values: undefined,
    })
  })
})
