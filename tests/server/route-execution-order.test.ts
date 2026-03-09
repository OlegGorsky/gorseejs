import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { mkdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { buildStaticMap, createRouter, matchRoute } from "../../src/router/index.ts"
import { handleRouteRequest } from "../../src/server/route-request.ts"

const TMP = join(process.cwd(), ".tmp-route-execution-order")

describe("route execution order", () => {
  beforeAll(async () => {
    await rm(TMP, { recursive: true, force: true })
    await mkdir(TMP, { recursive: true })

    await writeFile(join(TMP, "_middleware.ts"), `
      export default async function rootMiddleware(ctx, next) {
        ctx.locals.order = [...(ctx.locals.order ?? []), "middleware"]
        return next()
      }
    `.trim())

    await writeFile(join(TMP, "ordered-page.tsx"), `
      export const guard = async (ctx, next) => {
        ctx.locals.order = [...(ctx.locals.order ?? []), "guard"]
        return next()
      }

      export async function loader(ctx) {
        return { order: [...(ctx.locals.order ?? []), "loader"] }
      }

      export default function OrderedPage(props) {
        return <pre>{JSON.stringify(props.data)}</pre>
      }
    `.trim())

    await writeFile(join(TMP, "ordered-load.tsx"), `
      export const guard = async (ctx, next) => {
        ctx.locals.order = [...(ctx.locals.order ?? []), "guard"]
        return next()
      }

      export async function load(ctx) {
        return { order: [...(ctx.locals.order ?? []), "load"] }
      }

      export default function OrderedLoadPage(props) {
        return <pre>{JSON.stringify(props.data)}</pre>
      }
    `.trim())

    await writeFile(join(TMP, "ordered-handler.tsx"), `
      export const guard = async (ctx, next) => {
        ctx.locals.order = [...(ctx.locals.order ?? []), "guard"]
        return next()
      }

      export async function GET(ctx) {
        return Response.json({ order: [...(ctx.locals.order ?? []), "get"] })
      }

      export default function OrderedHandlerPage() {
        return <main>handler</main>
      }
    `.trim())

    await writeFile(join(TMP, "ordered-action.tsx"), `
      import { defineAction } from "gorsee/server"

      export const guard = async (ctx, next) => {
        ctx.locals.order = [...(ctx.locals.order ?? []), "guard"]
        return next()
      }

      export const action = defineAction(async (ctx) => {
        return { order: [...(ctx.locals.order ?? []), "action"] }
      })

      export default function OrderedActionPage() {
        return <form method="post"></form>
      }
    `.trim())
  })

  afterAll(async () => {
    await rm(TMP, { recursive: true, force: true })
  })

  test("page execution order is middleware -> guard -> loader -> page renderer", async () => {
    const response = await handlePath("/ordered-page", new Request("http://localhost/ordered-page", {
      headers: { Origin: "https://app.example.com" },
    }), {
      trustedOrigin: "https://app.example.com",
      onPageRequest: async ({ resolved }) => Response.json(resolved.loaderData),
      onPartialRequest: async ({ resolved }) => Response.json(resolved.loaderData),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ order: ["middleware", "guard", "loader"] })
  })

  test("partial execution order is middleware -> guard -> loader -> partial renderer", async () => {
    const response = await handlePath("/ordered-page", new Request("http://localhost/ordered-page", {
      headers: {
        Origin: "https://app.example.com",
        Accept: "application/json",
        "X-Gorsee-Navigate": "partial",
      },
    }), {
      trustedOrigin: "https://app.example.com",
      onPageRequest: async ({ resolved }) => Response.json(resolved.loaderData),
      onPartialRequest: async ({ resolved }) => Response.json(resolved.loaderData),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ order: ["middleware", "guard", "loader"] })
  })

  test("route handler execution order is middleware -> guard -> GET", async () => {
    const response = await handlePath("/ordered-handler", new Request("http://localhost/ordered-handler", {
      headers: { Origin: "https://app.example.com" },
    }), {
      trustedOrigin: "https://app.example.com",
      onPageRequest: async ({ resolved }) => Response.json(resolved.loaderData),
      onPartialRequest: async ({ resolved }) => Response.json(resolved.loaderData),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ order: ["middleware", "guard", "get"] })
  })

  test("page execution also supports canonical load alias", async () => {
    const response = await handlePath("/ordered-load", new Request("http://localhost/ordered-load", {
      headers: { Origin: "https://app.example.com" },
    }), {
      trustedOrigin: "https://app.example.com",
      onPageRequest: async ({ resolved }) => Response.json(resolved.loaderData),
      onPartialRequest: async ({ resolved }) => Response.json(resolved.loaderData),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ order: ["middleware", "guard", "load"] })
  })

  test("action execution order is middleware -> guard -> action", async () => {
    const response = await handlePath("/ordered-action", new Request("http://localhost/ordered-action", {
      method: "POST",
      headers: {
        Origin: "https://app.example.com",
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ok: true }),
    }), {
      trustedOrigin: "https://app.example.com",
      onPageRequest: async ({ resolved }) => Response.json(resolved.loaderData),
      onPartialRequest: async ({ resolved }) => Response.json(resolved.loaderData),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: { order: ["middleware", "guard", "action"] },
      status: 200,
    })
  })
})

async function handlePath(
  pathname: string,
  request: Request,
  options: {
    trustedOrigin: string
    onPageRequest: Parameters<typeof handleRouteRequest>[0]["onPageRequest"]
    onPartialRequest: Parameters<typeof handleRouteRequest>[0]["onPartialRequest"]
  },
): Promise<Response> {
  const routes = await createRouter(TMP)
  const match = matchRoute(routes, pathname, buildStaticMap(routes))
  if (!match) throw new Error(`route not found: ${pathname}`)

  return handleRouteRequest({
    match,
    request,
    trustedOrigin: options.trustedOrigin,
    onPageRequest: options.onPageRequest,
    onPartialRequest: options.onPartialRequest,
  })
}
