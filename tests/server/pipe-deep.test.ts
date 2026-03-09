import { describe, test, expect } from "bun:test"
import { pipe, when, forMethods, forPaths } from "../../src/server/pipe.ts"
import { createContext, type MiddlewareFn } from "../../src/server/middleware.ts"

const ok = async () => new Response("OK")

function makeCtx(url = "http://localhost/", method = "GET") {
  return createContext(new Request(url, { method }))
}

function tracker(label: string, log: string[]): MiddlewareFn {
  return async (_ctx, next) => { log.push(label); return next() }
}

describe("pipe", () => {
  test("single middleware passes through", async () => {
    const log: string[] = []
    const mw = pipe(tracker("a", log))
    await mw(makeCtx(), ok)
    expect(log).toEqual(["a"])
  })

  test("5 middleware in order", async () => {
    const log: string[] = []
    const mw = pipe(
      tracker("1", log), tracker("2", log), tracker("3", log),
      tracker("4", log), tracker("5", log),
    )
    await mw(makeCtx(), ok)
    expect(log).toEqual(["1", "2", "3", "4", "5"])
  })

  test("empty pipe passes through directly", async () => {
    const mw = pipe()
    const res = await mw(makeCtx(), ok)
    expect(await res.text()).toBe("OK")
  })

  test("preserves middleware order on response wrapping", async () => {
    const mw = pipe(
      async (_ctx, next) => {
        const res = await next()
        res.headers.set("X-Order", (res.headers.get("X-Order") ?? "") + "A")
        return res
      },
      async (_ctx, next) => {
        const res = await next()
        res.headers.set("X-Order", (res.headers.get("X-Order") ?? "") + "B")
        return res
      },
    )
    const res = await mw(makeCtx(), ok)
    // Inner (B) runs first on response, outer (A) second
    expect(res.headers.get("X-Order")).toBe("BA")
  })
})

describe("when", () => {
  test("true predicate -> middleware runs", async () => {
    const log: string[] = []
    const mw = when(() => true, tracker("ran", log))
    await mw(makeCtx(), ok)
    expect(log).toEqual(["ran"])
  })

  test("false predicate -> middleware skipped", async () => {
    const log: string[] = []
    const mw = when(() => false, tracker("skip", log))
    await mw(makeCtx(), ok)
    expect(log).toEqual([])
  })

  test("predicate receives ctx", async () => {
    const mw = when(
      (ctx) => ctx.url.pathname === "/yes",
      async (_ctx, next) => {
        const res = await next()
        res.headers.set("X-Hit", "1")
        return res
      },
    )
    const r1 = await mw(makeCtx("http://localhost/yes"), ok)
    expect(r1.headers.get("X-Hit")).toBe("1")
    const r2 = await mw(makeCtx("http://localhost/no"), ok)
    expect(r2.headers.get("X-Hit")).toBeNull()
  })
})

describe("forMethods", () => {
  test("POST only runs on POST", async () => {
    const log: string[] = []
    const mw = forMethods(["POST"], tracker("post", log))
    await mw(makeCtx("http://localhost/", "POST"), ok)
    expect(log).toEqual(["post"])
  })

  test("POST only skips GET", async () => {
    const log: string[] = []
    const mw = forMethods(["POST"], tracker("post", log))
    await mw(makeCtx("http://localhost/", "GET"), ok)
    expect(log).toEqual([])
  })

  test("GET and POST runs on both", async () => {
    const log: string[] = []
    const mw = forMethods(["GET", "POST"], tracker("x", log))
    await mw(makeCtx("http://localhost/", "GET"), ok)
    await mw(makeCtx("http://localhost/", "POST"), ok)
    expect(log).toEqual(["x", "x"])
  })

  test("case insensitive method matching", async () => {
    const log: string[] = []
    const mw = forMethods(["post"], tracker("x", log))
    await mw(makeCtx("http://localhost/", "POST"), ok)
    expect(log).toEqual(["x"])
  })
})

describe("forPaths", () => {
  test("matches prefix /api", async () => {
    const log: string[] = []
    const mw = forPaths(["/api"], tracker("api", log))
    await mw(makeCtx("http://localhost/api/users"), ok)
    expect(log).toEqual(["api"])
  })

  test("does not match /other", async () => {
    const log: string[] = []
    const mw = forPaths(["/api"], tracker("api", log))
    await mw(makeCtx("http://localhost/other"), ok)
    expect(log).toEqual([])
  })

  test("multiple prefixes", async () => {
    const log: string[] = []
    const mw = forPaths(["/api", "/admin"], tracker("x", log))
    await mw(makeCtx("http://localhost/admin/dash"), ok)
    expect(log).toEqual(["x"])
  })
})

describe("combined pipe + forPaths + forMethods", () => {
  test("pipe(forPaths, forMethods, middleware)", async () => {
    const log: string[] = []
    const mw = pipe(
      forPaths(["/api"], tracker("path", log)),
      forMethods(["POST"], tracker("method", log)),
    )
    await mw(makeCtx("http://localhost/api/data", "POST"), ok)
    expect(log).toEqual(["path", "method"])
  })
})
