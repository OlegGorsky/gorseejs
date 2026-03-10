import { afterAll, describe, expect, test } from "bun:test"
import { mkdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { runBuild } from "../../src/cli/cmd-build.ts"
import { createProductionFetchHandler } from "../../src/prod.ts"

const ROOT = join(process.cwd(), ".tmp-provider-runtime-matrix")

async function createFixture(name: string, appConfig: string) {
  const cwd = join(ROOT, name)
  const routesDir = join(cwd, "routes")
  await rm(cwd, { recursive: true, force: true })
  await mkdir(join(routesDir, "api"), { recursive: true })
  await writeFile(join(cwd, "app.config.ts"), appConfig)
  await writeFile(join(routesDir, "index.tsx"), `
    export default function HomePage() {
      return <main>provider matrix</main>
    }
  `.trim())
  await writeFile(join(routesDir, "api", "echo.ts"), `
    import type { Context } from "gorsee/server"

    export function GET(ctx: Context): Response {
      return Response.json({
        host: ctx.locals.requestEffectiveHost,
        proto: ctx.locals.requestEffectiveProto,
        trusted: ctx.locals.requestProxyTrusted,
      })
    }
  `.trim())
  const originalCwd = process.cwd()
  process.chdir(cwd)
  await runBuild([])
  process.chdir(originalCwd)
  return cwd
}

describe("provider runtime matrix", () => {
  afterAll(async () => {
    await rm(ROOT, { recursive: true, force: true })
  })

  test("vercel preset trusts one forwarded hop at runtime", async () => {
    const cwd = await createFixture("vercel", `
      export default {
        security: {
          origin: "https://app.example.com",
          proxy: { preset: "vercel" },
        },
      }
    `.trim())

    const handler = await createProductionFetchHandler({ cwd })
    const response = await handler(new Request("http://127.0.0.1/api/echo", {
      headers: {
        Host: "127.0.0.1",
        "X-Forwarded-Host": "app.example.com",
        "X-Forwarded-Proto": "https",
      },
    }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ host: "app.example.com", proto: "https", trusted: true })
  })

  test("cloudflare preset ignores forwarded headers by default", async () => {
    const cwd = await createFixture("cloudflare", `
      export default {
        security: {
          origin: "https://app.example.com",
          proxy: { preset: "cloudflare" },
        },
      }
    `.trim())

    const handler = await createProductionFetchHandler({ cwd })
    const response = await handler(new Request("https://app.example.com/api/echo", {
      headers: {
        Host: "app.example.com",
        "X-Forwarded-Host": "evil.example",
        "X-Forwarded-Proto": "http",
      },
    }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ host: "app.example.com", proto: "https", trusted: false })
  })

  test("cloudflare preset can opt into forwarded trust explicitly", async () => {
    const cwd = await createFixture("cloudflare-explicit", `
      export default {
        security: {
          origin: "https://app.example.com",
          proxy: {
            preset: "cloudflare",
            trustForwardedHeaders: true,
            trustedForwardedHops: 1,
          },
        },
      }
    `.trim())

    const handler = await createProductionFetchHandler({ cwd })
    const response = await handler(new Request("http://127.0.0.1/api/echo", {
      headers: {
        Host: "127.0.0.1",
        "X-Forwarded-Host": "app.example.com",
        "X-Forwarded-Proto": "https",
      },
    }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ host: "app.example.com", proto: "https", trusted: true })
  })

  test("netlify preset trusts one forwarded hop at runtime", async () => {
    const cwd = await createFixture("netlify", `
      export default {
        security: {
          origin: "https://app.example.com",
          proxy: { preset: "netlify" },
        },
      }
    `.trim())

    const handler = await createProductionFetchHandler({ cwd })
    const response = await handler(new Request("http://127.0.0.1/api/echo", {
      headers: {
        Host: "127.0.0.1",
        "X-Forwarded-Host": "app.example.com",
        "X-Forwarded-Proto": "https",
      },
    }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ host: "app.example.com", proto: "https", trusted: true })
  })

  test("fly preset trusts one forwarded hop at runtime", async () => {
    const cwd = await createFixture("fly", `
      export default {
        security: {
          origin: "https://app.example.com",
          proxy: { preset: "fly" },
        },
      }
    `.trim())

    const handler = await createProductionFetchHandler({ cwd })
    const response = await handler(new Request("http://127.0.0.1/api/echo", {
      headers: {
        Host: "127.0.0.1",
        "X-Forwarded-Host": "app.example.com",
        "X-Forwarded-Proto": "https",
      },
    }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ host: "app.example.com", proto: "https", trusted: true })
  })

  test("fly preset can explicitly opt out of forwarded trust at runtime", async () => {
    const cwd = await createFixture("fly-explicit-off", `
      export default {
        security: {
          origin: "https://app.example.com",
          proxy: {
            preset: "fly",
            trustForwardedHeaders: false,
          },
        },
      }
    `.trim())

    const handler = await createProductionFetchHandler({ cwd })
    const response = await handler(new Request("https://app.example.com/api/echo", {
      headers: {
        Host: "app.example.com",
        "X-Forwarded-Host": "evil.example",
        "X-Forwarded-Proto": "http",
      },
    }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ host: "app.example.com", proto: "https", trusted: false })
  })

  test("vercel preset honors explicit multi-hop override at runtime", async () => {
    const cwd = await createFixture("vercel-multi-hop", `
      export default {
        security: {
          origin: "https://app.example.com",
          hosts: ["app.example.com"],
          proxy: {
            preset: "vercel",
            trustedForwardedHops: 2,
          },
        },
      }
    `.trim())

    const handler = await createProductionFetchHandler({ cwd })
    const response = await handler(new Request("http://internal/api/echo", {
      headers: {
        Host: "internal",
        Forwarded: 'for=198.51.100.1;proto=http;host="edge.example.com", for=198.51.100.2;proto=https;host="app.example.com", for=203.0.113.10;proto=https;host="internal-hop.example"',
        "X-Forwarded-Host": "edge.example.com, app.example.com, internal-hop.example",
        "X-Forwarded-Proto": "http, https, https",
      },
    }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ host: "app.example.com", proto: "https", trusted: true })
  })

  test("netlify preset honors explicit multi-hop override at runtime", async () => {
    const cwd = await createFixture("netlify-multi-hop", `
      export default {
        security: {
          origin: "https://app.example.com",
          hosts: ["app.example.com"],
          proxy: {
            preset: "netlify",
            trustedForwardedHops: 2,
          },
        },
      }
    `.trim())

    const handler = await createProductionFetchHandler({ cwd })
    const response = await handler(new Request("http://internal/api/echo", {
      headers: {
        Host: "internal",
        Forwarded: 'for=198.51.100.1;proto=http;host="edge.example.com", for=198.51.100.2;proto=https;host="app.example.com", for=203.0.113.10;proto=https;host="internal-hop.example"',
        "X-Forwarded-Host": "edge.example.com, app.example.com, internal-hop.example",
        "X-Forwarded-Proto": "http, https, https",
      },
    }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ host: "app.example.com", proto: "https", trusted: true })
  })

  test("fly preset honors explicit multi-hop override at runtime", async () => {
    const cwd = await createFixture("fly-multi-hop", `
      export default {
        security: {
          origin: "https://app.example.com",
          hosts: ["app.example.com"],
          proxy: {
            preset: "fly",
            trustedForwardedHops: 2,
          },
        },
      }
    `.trim())

    const handler = await createProductionFetchHandler({ cwd })
    const response = await handler(new Request("http://internal/api/echo", {
      headers: {
        Host: "internal",
        Forwarded: 'for=198.51.100.1;proto=http;host="edge.example.com", for=198.51.100.2;proto=https;host="app.example.com", for=203.0.113.10;proto=https;host="internal-hop.example"',
        "X-Forwarded-Host": "edge.example.com, app.example.com, internal-hop.example",
        "X-Forwarded-Proto": "http, https, https",
      },
    }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ host: "app.example.com", proto: "https", trusted: true })
  })

  test("cloudflare preset explicit trust honors multi-hop override and canonical Forwarded precedence", async () => {
    const cwd = await createFixture("cloudflare-multi-hop-explicit", `
      export default {
        security: {
          origin: "https://app.example.com",
          hosts: ["app.example.com"],
          proxy: {
            preset: "cloudflare",
            trustForwardedHeaders: true,
            trustedForwardedHops: 2,
          },
        },
      }
    `.trim())

    const handler = await createProductionFetchHandler({ cwd })
    const response = await handler(new Request("http://internal/api/echo", {
      headers: {
        Host: "internal",
        Forwarded: 'for=198.51.100.1;proto=http;host="edge.example.com", for=198.51.100.2;proto=https;host="app.example.com", for=203.0.113.10;proto=https;host="internal-hop.example"',
        "X-Forwarded-Host": "evil.example.com, evil-second.example.com, internal-hop.example",
        "X-Forwarded-Proto": "http, http, https",
      },
    }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ host: "app.example.com", proto: "https", trusted: true })
  })

  test("reverse-proxy preset honors trusted hop depth at runtime", async () => {
    const cwd = await createFixture("reverse-proxy", `
      export default {
        security: {
          origin: "https://edge.example.com",
          hosts: ["edge.example.com"],
          proxy: {
            preset: "reverse-proxy",
            trustedForwardedHops: 2,
          },
        },
      }
    `.trim())

    const handler = await createProductionFetchHandler({ cwd })
    const response = await handler(new Request("http://internal/api/echo", {
      headers: {
        Host: "internal",
        Forwarded: 'for=198.51.100.1;proto=https;host="edge.example.com", for=203.0.113.10;proto=https;host="app.example.com"',
      },
    }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ host: "edge.example.com", proto: "https", trusted: true })
  })

  test("reverse-proxy preset selects the configured trusted hop from a chained proxy runtime", async () => {
    const cwd = await createFixture("reverse-proxy-multi-hop", `
      export default {
        security: {
          origin: "https://app.example.com",
          hosts: ["app.example.com"],
          proxy: {
            preset: "reverse-proxy",
            trustedForwardedHops: 2,
          },
        },
      }
    `.trim())

    const handler = await createProductionFetchHandler({ cwd })
    const response = await handler(new Request("http://internal/api/echo", {
      headers: {
        Host: "internal",
        Forwarded: 'for=198.51.100.1;proto=http;host="outer.example.com", for=198.51.100.2;proto=https;host="app.example.com", for=203.0.113.10;proto=https;host="internal-hop.example"',
        "X-Forwarded-Host": "outer.example.com, app.example.com, internal-hop.example",
        "X-Forwarded-Proto": "http, https, https",
      },
    }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ host: "app.example.com", proto: "https", trusted: true })
  })

  test("reverse-proxy preset can explicitly opt out of forwarded trust at runtime", async () => {
    const cwd = await createFixture("reverse-proxy-explicit-off", `
      export default {
        security: {
          origin: "https://app.example.com",
          proxy: {
            preset: "reverse-proxy",
            trustForwardedHeaders: false,
            trustedForwardedHops: 2,
          },
        },
      }
    `.trim())

    const handler = await createProductionFetchHandler({ cwd })
    const response = await handler(new Request("https://app.example.com/api/echo", {
      headers: {
        Host: "app.example.com",
        Forwarded: 'for=198.51.100.1;proto=http;host="outer.example.com", for=203.0.113.10;proto=https;host="trusted.example.com"',
        "X-Forwarded-Host": "outer.example.com, trusted.example.com",
        "X-Forwarded-Proto": "http, https",
      },
    }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ host: "app.example.com", proto: "https", trusted: false })
  })
})
