import { describe, test, expect } from "bun:test"
import { actionFailure, actionSuccess, defineAction, handleAction, parseFormData } from "../../src/server/action.ts"
import { createContext } from "../../src/server/middleware.ts"

function makeCtx(body?: BodyInit, contentType?: string) {
  const headers: Record<string, string> = {}
  if (contentType) headers["Content-Type"] = contentType
  return createContext(new Request("http://localhost/action", {
    method: "POST",
    body,
    headers,
  }))
}

describe("defineAction", () => {
  test("returns the same function", () => {
    const fn = async () => "result"
    expect(defineAction(fn)).toBe(fn)
  })

  test("returned function is callable", async () => {
    const action = defineAction(async () => 42)
    const ctx = makeCtx()
    const result = await action(ctx)
    expect(result).toBe(42)
  })
})

describe("handleAction", () => {
  test("success returns data with status 200", async () => {
    const action = defineAction(async () => ({ id: 1, name: "test" }))
    const result = await handleAction(action, makeCtx())
    expect(result.ok).toBe(true)
    expect(result.status).toBe(200)
    expect(result.data).toEqual({ id: 1, name: "test" })
    expect(result.error).toBeUndefined()
  })

  test("error returns message with status 500", async () => {
    const action = defineAction(async () => { throw new Error("bad input") })
    const result = await handleAction(action, makeCtx())
    expect(result.ok).toBe(false)
    expect(result.status).toBe(500)
    expect(result.error).toBe("bad input")
    expect(result.data).toBeUndefined()
  })

  test("non-Error throw is stringified", async () => {
    const action = defineAction(async () => { throw "string error" })
    const result = await handleAction(action, makeCtx())
    expect(result.ok).toBe(false)
    expect(result.error).toBe("string error")
    expect(result.status).toBe(500)
  })

  test("Response return extracts status", async () => {
    const action = defineAction(async () => new Response(null, { status: 201 }))
    const result = await handleAction(action, makeCtx())
    expect(result.ok).toBe(true)
    expect(result.status).toBe(201)
    expect(result.data).toBeUndefined()
  })

  test("action receives context with request", async () => {
    const action = defineAction(async (ctx) => {
      return { method: ctx.request.method, path: ctx.url.pathname }
    })
    const result = await handleAction(action, makeCtx())
    expect(result.data).toEqual({ method: "POST", path: "/action" })
  })

  test("action can use ctx.locals", async () => {
    const action = defineAction(async (ctx) => {
      return { user: ctx.locals.user }
    })
    const ctx = makeCtx()
    ctx.locals.user = "Alice"
    const result = await handleAction(action, ctx)
    expect(result.data).toEqual({ user: "Alice" })
  })

  test("explicit actionSuccess result is preserved", async () => {
    const action = defineAction(async () => actionSuccess({ id: 7 }, { status: 202 }))
    const result = await handleAction(action, makeCtx())
    expect(result).toEqual({
      ok: true,
      status: 202,
      data: { id: 7 },
      error: undefined,
      fieldErrors: undefined,
      formErrors: undefined,
      values: undefined,
    })
  })

  test("explicit actionFailure result is preserved", async () => {
    const action = defineAction(async () => actionFailure("denied", { status: 403 }))
    const result = await handleAction(action, makeCtx())
    expect(result).toEqual({
      ok: false,
      status: 403,
      data: undefined,
      error: "denied",
      fieldErrors: undefined,
      formErrors: undefined,
      values: undefined,
    })
  })
})

describe("parseFormData", () => {
  test("extracts string fields from form data", async () => {
    const form = new FormData()
    form.set("name", "Alice")
    form.set("email", "alice@example.com")
    const req = new Request("http://localhost/", { method: "POST", body: form })
    const data = await parseFormData(req)
    expect(data.name).toBe("Alice")
    expect(data.email).toBe("alice@example.com")
  })

  test("multiple fields parsed correctly", async () => {
    const form = new FormData()
    form.set("a", "1")
    form.set("b", "2")
    form.set("c", "3")
    const req = new Request("http://localhost/", { method: "POST", body: form })
    const data = await parseFormData(req)
    expect(Object.keys(data)).toHaveLength(3)
  })

  test("empty form data returns empty object", async () => {
    const form = new FormData()
    const req = new Request("http://localhost/", { method: "POST", body: form })
    const data = await parseFormData(req)
    expect(Object.keys(data)).toHaveLength(0)
  })

  test("file upload fields are skipped", async () => {
    const form = new FormData()
    form.set("name", "test")
    form.set("file", new Blob(["content"]), "test.txt")
    const req = new Request("http://localhost/", { method: "POST", body: form })
    const data = await parseFormData(req)
    expect(data.name).toBe("test")
    expect(data.file).toBeUndefined()
  })

  test("special characters in values preserved", async () => {
    const form = new FormData()
    form.set("msg", "hello & goodbye <world>")
    const req = new Request("http://localhost/", { method: "POST", body: form })
    const data = await parseFormData(req)
    expect(data.msg).toBe("hello & goodbye <world>")
  })
})
