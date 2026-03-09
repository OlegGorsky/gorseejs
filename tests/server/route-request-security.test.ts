import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { mkdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { buildStaticMap, createRouter, matchRoute } from "../../src/router/index.ts"
import { handleRouteRequest } from "../../src/server/route-request.ts"

const TMP = join(process.cwd(), ".tmp-route-request-security")

describe("route request security boundaries", () => {
  beforeAll(async () => {
    await rm(TMP, { recursive: true, force: true })
    await mkdir(join(TMP, "guarded"), { recursive: true })

    await writeFile(
      join(TMP, "_middleware.ts"),
      `
        export default async function authGate(ctx, next) {
          if (ctx.url.pathname === "/guarded" || ctx.url.pathname === "/redirect-unsafe" || ctx.url.pathname === "/contract" || ctx.url.pathname === "/submit-contract" || ctx.url.pathname === "/page-contract") return next()
          return ctx.redirect("/login", 302)
        }
      `.trim(),
    )

    await writeFile(
      join(TMP, "secret.tsx"),
      `
        export async function loader() {
          throw new Error("loader-ran-before-middleware")
        }

        export default function SecretPage() {
          return <main>secret</main>
        }
      `.trim(),
    )

    await writeFile(
      join(TMP, "api.tsx"),
      `
        export async function GET() {
          return new Response("unprotected-api")
        }
      `.trim(),
    )

    await writeFile(
      join(TMP, "guarded", "_middleware.ts"),
      `
        export default async function sessionHydrator(ctx, next) {
          ctx.locals.allowed = true
          return next()
        }
      `.trim(),
    )

    await writeFile(
      join(TMP, "guarded", "index.tsx"),
      `
        export const guard = async (ctx, next) => {
          if (!ctx.locals.allowed) return new Response("forbidden", { status: 403 })
          return next()
        }

        export async function GET() {
          return new Response("guarded-ok")
        }

        export default function GuardedPage() {
          return <main>guarded</main>
        }
      `.trim(),
    )

    await writeFile(
      join(TMP, "contract.tsx"),
      `
        export async function GET(ctx) {
          return Response.json({
            kind: ctx.locals.requestKind,
            access: ctx.locals.requestAccess,
            mutation: ctx.locals.requestMutation,
            shape: ctx.locals.requestResponseShape,
            effectiveOrigin: ctx.locals.requestEffectiveOrigin,
            requestId: typeof ctx.locals.requestId === "string",
            traceId: typeof ctx.locals.traceId === "string",
            spanId: typeof ctx.locals.spanId === "string",
          })
        }

        export default function ContractPage() {
          return <main>contract</main>
        }
      `.trim(),
    )

    await writeFile(
      join(TMP, "page-contract.tsx"),
      `
        export async function loader(ctx) {
          return {
            kind: ctx.locals.requestKind,
            access: ctx.locals.requestAccess,
            mutation: ctx.locals.requestMutation,
            shape: ctx.locals.requestResponseShape,
            effectiveOrigin: ctx.locals.requestEffectiveOrigin,
            requestId: typeof ctx.locals.requestId === "string",
            traceId: typeof ctx.locals.traceId === "string",
            spanId: typeof ctx.locals.spanId === "string",
          }
        }

        export default function PageContract(props) {
          return <pre>{JSON.stringify(props.data)}</pre>
        }
      `.trim(),
    )

    await writeFile(
      join(TMP, "redirect-unsafe.tsx"),
      `
        import { redirect } from "gorsee/server"

        export async function loader() {
          redirect("https://evil.example/phish", 302)
        }

        export default function RedirectUnsafePage() {
          return <main>redirect-unsafe</main>
        }
      `.trim(),
    )

    await writeFile(
      join(TMP, "submit.tsx"),
      `
        import { defineAction } from "gorsee/server"

        export const action = defineAction(async () => {
          return { ok: true }
        })

        export default function SubmitPage() {
          return <form method="post"></form>
        }
      `.trim(),
    )

    await writeFile(
      join(TMP, "submit-contract.tsx"),
      `
        import { defineAction } from "gorsee/server"

        export const action = defineAction(async (ctx) => {
          return {
            kind: ctx.locals.requestKind,
            access: ctx.locals.requestAccess,
            mutation: ctx.locals.requestMutation,
            shape: ctx.locals.requestResponseShape,
            effectiveOrigin: ctx.locals.requestEffectiveOrigin,
            requestId: typeof ctx.locals.requestId === "string",
            traceId: typeof ctx.locals.traceId === "string",
            spanId: typeof ctx.locals.spanId === "string",
          }
        })

        export default function SubmitContractPage() {
          return <form method="post"></form>
        }
      `.trim(),
    )

    await writeFile(
      join(TMP, "submit-handler.tsx"),
      `
        export async function POST() {
          return new Response("posted")
        }

        export default function SubmitHandlerPage() {
          return <main>submit-handler</main>
        }
      `.trim(),
    )
  })

  afterAll(async () => {
    await rm(TMP, { recursive: true, force: true })
  })

  test("middleware blocks loader execution before page resolution", async () => {
    const response = await handleForPath("/secret")

    expect(response.status).toBe(302)
    expect(response.headers.get("Location")).toBe("/login")
  })

  test("middleware blocks GET handlers before route handler execution", async () => {
    const response = await handleForPath("/api")

    expect(response.status).toBe(302)
    expect(response.headers.get("Location")).toBe("/login")
  })

  test("route guard executes at runtime after middleware hydration", async () => {
    const response = await handleForPath("/guarded")

    expect(response.status).toBe(200)
    expect(await response.text()).toBe("guarded-ok")
  })

  test("route handlers receive the same request contract locals as other endpoints", async () => {
    const response = await handleForPath("/contract", {
      headers: {
        Origin: "https://app.example.com",
      },
      trustedOrigin: "https://app.example.com",
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      kind: "route-handler",
      access: "public",
      mutation: "write",
      shape: "raw",
      effectiveOrigin: "https://app.example.com",
      requestId: true,
      traceId: true,
      spanId: true,
    })
  })

  test("page requests receive the same request contract locals through loader context", async () => {
    const response = await handleForPath("/page-contract", {
      headers: {
        Origin: "https://app.example.com",
      },
      trustedOrigin: "https://app.example.com",
    })

    expect(response.status).toBe(200)
    const html = await response.text()
    expect(html).toContain("\"kind\":\"page\"")
    expect(html).toContain("\"access\":\"public\"")
    expect(html).toContain("\"mutation\":\"read\"")
    expect(html).toContain("\"shape\":\"document\"")
    expect(html).toContain("\"effectiveOrigin\":\"https://app.example.com\"")
    expect(html).toContain("\"requestId\":true")
    expect(html).toContain("\"traceId\":true")
    expect(html).toContain("\"spanId\":true")
  })

  test("partial requests receive the same request contract locals through loader context", async () => {
    const response = await handleForPath("/page-contract", {
      headers: {
        Accept: "application/json",
        Origin: "https://app.example.com",
        "X-Gorsee-Navigate": "partial",
      },
      trustedOrigin: "https://app.example.com",
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      kind: "partial",
      access: "internal",
      mutation: "read",
      shape: "data",
      effectiveOrigin: "https://app.example.com",
      requestId: true,
      traceId: true,
      spanId: true,
    })
  })

  test("throwable redirect is sanitized before writing Location header", async () => {
    const response = await handleForPath("/redirect-unsafe")

    expect(response.status).toBe(302)
    expect(response.headers.get("Location")).toBe("/")
  })

  test("trusted origin overrides attacker-controlled request host during redirect sanitation", async () => {
    const response = await handleForPath("/redirect-unsafe", {
      requestUrl: "http://evil.local/redirect-unsafe",
      trustedOrigin: "http://localhost:3000",
    })

    expect(response.status).toBe(302)
    expect(response.headers.get("Location")).toBe("/")
  })

  test("state-changing action requests enforce trusted origin policy", async () => {
    const response = await handleForPath("/submit", {
      method: "POST",
      requestUrl: "http://localhost/submit",
      trustedOrigin: "https://app.example.com",
      headers: {
        Origin: "https://evil.example",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "name=oleg",
    })

    expect(response.status).toBe(403)
  })

  test("action requests receive the same request contract locals as other endpoints", async () => {
    const response = await handleForPath("/submit-contract", {
      method: "POST",
      requestUrl: "https://app.example.com/submit-contract",
      headers: {
        Origin: "https://app.example.com",
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "name=oleg",
      trustedOrigin: "https://app.example.com",
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: {
        kind: "action",
        access: "public",
        mutation: "write",
        shape: "data",
        effectiveOrigin: "https://app.example.com",
        requestId: true,
        traceId: true,
        spanId: true,
      },
      status: 200,
    })
  })

  test("state-changing route handlers enforce trusted origin policy", async () => {
    const response = await handleForPath("/submit-handler", {
      method: "POST",
      requestUrl: "http://localhost/submit-handler",
      trustedOrigin: "https://app.example.com",
      headers: {
        Origin: "https://evil.example",
      },
      body: "x",
    })

    expect(response.status).toBe(403)
  })

  test("route requests reject untrusted forwarded host when proxy trust is enabled", async () => {
    const response = await handleForPath("/guarded", {
      requestUrl: "http://localhost/guarded",
      headers: {
        Host: "localhost",
        "X-Forwarded-Host": "evil.example",
        "X-Forwarded-Proto": "https",
      },
      securityPolicy: {
        trustedOrigin: "https://app.example.com",
        trustForwardedHeaders: true,
        trustedForwardedHops: 1,
        trustedHosts: ["app.example.com"],
        enforceTrustedHosts: true,
      },
    })

    expect(response.status).toBe(400)
  })
})

async function handleForPath(
  pathname: string,
  options: {
    requestUrl?: string
    trustedOrigin?: string
    method?: string
    headers?: Record<string, string>
    body?: string
    securityPolicy?: {
      trustedOrigin?: string
      trustForwardedHeaders: boolean
      trustedForwardedHops: number
      trustedHosts: string[]
      enforceTrustedHosts: boolean
    }
  } = {},
): Promise<Response> {
  const routes = await createRouter(TMP)
  const match = matchRoute(routes, pathname, buildStaticMap(routes))
  if (!match) throw new Error(`Route not found for ${pathname}`)

  return handleRouteRequest({
    match,
    request: new Request(options.requestUrl ?? `http://localhost${pathname}`, {
      method: options.method,
      headers: options.headers,
      body: options.body,
    }),
    trustedOrigin: options.trustedOrigin,
    securityPolicy: options.securityPolicy,
    onPartialRequest: async ({ resolved }) =>
      new Response(JSON.stringify(resolved.loaderData ?? "partial"), {
        headers: { "Content-Type": "application/json" },
      }),
    onPageRequest: async ({ resolved }) => new Response(
      typeof resolved.loaderData === "object" && resolved.loaderData !== null
        ? JSON.stringify(resolved.loaderData)
        : String(resolved.loaderData ?? "page"),
    ),
  })
}
