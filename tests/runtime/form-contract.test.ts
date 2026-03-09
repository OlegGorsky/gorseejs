import { describe, expect, test } from "bun:test"
import { defineFormAction, defineForm } from "../../src/forms/index.ts"
import { actionSuccess, handleAction } from "../../src/server/action.ts"
import { createContext } from "../../src/server/middleware.ts"

describe("defineFormAction", () => {
  test("returns structured validation failure when schema is invalid", async () => {
    const schema = defineForm<{ email: string }>([
      { name: "email", label: "Email", rules: { required: true } },
    ])
    const action = defineFormAction(schema, async () => actionSuccess({ ok: true }))
    const request = new Request("http://localhost/signup", {
      method: "POST",
      body: new URLSearchParams({ email: "" }),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    })

    const result = await handleAction(action, createContext(request))

    expect(result).toEqual({
      ok: false,
      status: 400,
      data: undefined,
      error: "Validation failed",
      fieldErrors: { email: ["Email is required"] },
      formErrors: [],
      values: { email: "" },
    })
  })

  test("passes validated data and ctx into the handler", async () => {
    const schema = defineForm<{ title: string }>([
      { name: "title", rules: { required: true, minLength: 2 } },
    ])
    const action = defineFormAction(schema, async ({ ctx, data, values, validation }) => {
      ctx.locals.created = true
      return actionSuccess({
        title: data.title,
        raw: values.title,
        valid: validation.valid,
      }, { status: 201 })
    })
    const request = new Request("http://localhost/posts/new", {
      method: "POST",
      body: new URLSearchParams({ title: "Hello" }),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    })
    const ctx = createContext(request)

    const result = await handleAction(action, ctx)

    expect(ctx.locals.created).toBe(true)
    expect(result).toEqual({
      ok: true,
      status: 201,
      data: { title: "Hello", raw: "Hello", valid: true },
      error: undefined,
      fieldErrors: undefined,
      formErrors: undefined,
      values: undefined,
    })
  })
})
