import { afterEach, describe, expect, test } from "bun:test"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { pathToFileURL } from "node:url"

const TMP = join(process.cwd(), ".tmp-cli-deploy")
const CLI = join(process.cwd(), "src", "cli", "index.ts")

async function writeBuiltHandlerStubs(dir: string): Promise<void> {
  await mkdir(join(dir, "dist"), { recursive: true })
  const stub = [
    "export async function handleRequest(request, context, options) {",
    "  const payload = {",
    "    pathname: new URL(request.url).pathname,",
    "    contextKeys: context && typeof context === 'object' ? Object.keys(context).sort() : [],",
    "    hasRpcPolicy: Array.isArray(options?.rpcPolicy?.middlewares),",
    "    rpcMiddlewareCount: Array.isArray(options?.rpcPolicy?.middlewares) ? options.rpcPolicy.middlewares.length : -1,",
    "  }",
    "  return Response.json(payload)",
    "}",
    "",
  ].join("\n")
  await writeFile(join(dir, "dist", "server-handler.js"), stub)
  await writeFile(join(dir, "dist", "server-handler-node.js"), stub)
}

function importFresh(modulePath: string) {
  return import(`${pathToFileURL(modulePath).href}?t=${Date.now()}`)
}

describe("cmd-deploy failure pack", () => {
  afterEach(async () => {
    await rm(TMP, { recursive: true, force: true })
  })

  test("unknown deploy target writes AI failure artifacts", async () => {
    await rm(TMP, { recursive: true, force: true })
    await mkdir(TMP, { recursive: true })
    await writeFile(join(TMP, "package.json"), JSON.stringify({ name: "tmp-deploy", type: "module" }, null, 2))

    const proc = Bun.spawn(["bun", "run", CLI, "deploy", "unknown"], {
      cwd: TMP,
      stdout: "pipe",
      stderr: "pipe",
    })

    expect(await proc.exited).toBe(1)
    const events = await readFile(join(TMP, ".gorsee", "ai-events.jsonl"), "utf-8")
    expect(events).toContain("deploy.failure")
    expect(await readFile(join(TMP, ".gorsee", "agent", "latest.json"), "utf-8")).toContain("DEPLOY_TARGET")
  })

  test("successful deploy generation writes structured deploy events", async () => {
    await rm(TMP, { recursive: true, force: true })
    await mkdir(TMP, { recursive: true })
    await writeFile(join(TMP, "package.json"), JSON.stringify({ name: "tmp-deploy", type: "module" }, null, 2))

    const proc = Bun.spawn(["bun", "run", CLI, "deploy", "docker"], {
      cwd: TMP,
      stdout: "pipe",
      stderr: "pipe",
    })

    expect(await proc.exited).toBe(0)
    const events = await readFile(join(TMP, ".gorsee", "ai-events.jsonl"), "utf-8")
    expect(events).toContain("deploy.start")
    expect(events).toContain("deploy.finish")
    expect(events).toContain("Dockerfile")
  })

  test("fly deploy generation writes APP_ORIGIN placeholder contract", async () => {
    await rm(TMP, { recursive: true, force: true })
    await mkdir(TMP, { recursive: true })
    await writeFile(join(TMP, "package.json"), JSON.stringify({ name: "tmp-deploy", type: "module" }, null, 2))

    const proc = Bun.spawn(["bun", "run", CLI, "deploy", "fly"], {
      cwd: TMP,
      stdout: "pipe",
      stderr: "pipe",
    })

    expect(await proc.exited).toBe(0)
    expect(await readFile(join(TMP, "fly.toml"), "utf-8")).toContain('APP_ORIGIN = "REPLACE_WITH_APP_ORIGIN"')
    expect(await readFile(join(TMP, "fly.toml"), "utf-8")).toContain('path = "/api/health"')
    expect(await readFile(join(TMP, "Dockerfile"), "utf-8")).toContain("ENV APP_ORIGIN=REPLACE_WITH_APP_ORIGIN")
  })

  test("cloudflare deploy generation keeps provider-specific security contract", async () => {
    await rm(TMP, { recursive: true, force: true })
    await mkdir(TMP, { recursive: true })
    await writeFile(join(TMP, "package.json"), JSON.stringify({ name: "tmp-deploy", type: "module", packageManager: "bun@1.3.9" }, null, 2))
    await writeBuiltHandlerStubs(TMP)

    const proc = Bun.spawn(["bun", "run", CLI, "deploy", "cloudflare"], {
      cwd: TMP,
      stdout: "pipe",
      stderr: "pipe",
    })

    expect(await proc.exited).toBe(0)
    expect(await readFile(join(TMP, "wrangler.toml"), "utf-8")).toContain('main = "dist/worker.js"')
    expect(await readFile(join(TMP, "wrangler.toml"), "utf-8")).toContain('bucket = "./dist/client"')
    expect(await readFile(join(TMP, "wrangler.toml"), "utf-8")).toContain('compatibility_flags = ["nodejs_compat"]')
    expect(await readFile(join(TMP, "worker.ts"), "utf-8")).toContain("handleRequest(request, env, { rpcPolicy })")
    expect(await readFile(join(TMP, "_routes.json"), "utf-8")).toContain('"/_gorsee/*"')

    const worker = await importFresh(join(TMP, "worker.ts"))
    const response = await worker.default.fetch(
      new Request("http://localhost/dashboard"),
      { APP_ORIGIN: "http://localhost" },
      {} as ExecutionContext,
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      pathname: "/dashboard",
      contextKeys: ["APP_ORIGIN"],
      hasRpcPolicy: true,
      rpcMiddlewareCount: 0,
    })
  })

  test("netlify deploy generation keeps provider-specific security contract", async () => {
    await rm(TMP, { recursive: true, force: true })
    await mkdir(TMP, { recursive: true })
    await writeFile(join(TMP, "package.json"), JSON.stringify({ name: "tmp-deploy", type: "module", packageManager: "bun@1.3.9" }, null, 2))
    await writeBuiltHandlerStubs(TMP)

    const proc = Bun.spawn(["bun", "run", CLI, "deploy", "netlify"], {
      cwd: TMP,
      stdout: "pipe",
      stderr: "pipe",
    })

    expect(await proc.exited).toBe(0)
    expect(await readFile(join(TMP, "netlify.toml"), "utf-8")).toContain('publish = "dist/client"')
    expect(await readFile(join(TMP, "netlify.toml"), "utf-8")).toContain("excludedPath = true")
    expect(await readFile(join(TMP, "netlify.toml"), "utf-8")).toContain('Cache-Control = "public, max-age=31536000, immutable"')
    expect(await readFile(join(TMP, "netlify/edge-functions/gorsee-handler.ts"), "utf-8")).toContain("handleRequest(request, { netlifyContext: context }, { rpcPolicy })")

    ;(globalThis as Record<string, unknown>).Netlify = {
      env: {
        get(name: string) {
          return name === "APP_ORIGIN" ? "http://localhost" : undefined
        },
      },
    }
    const edgeHandler = await importFresh(join(TMP, "netlify/edge-functions/gorsee-handler.ts"))
    const response = await edgeHandler.default(new Request("http://localhost/ops"), {
      next() {
        return new Response("next")
      },
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      pathname: "/ops",
      contextKeys: ["netlifyContext"],
      hasRpcPolicy: true,
      rpcMiddlewareCount: 0,
    })
  })

  test("docker deploy generation keeps reproducible install and APP_ORIGIN contract", async () => {
    await rm(TMP, { recursive: true, force: true })
    await mkdir(TMP, { recursive: true })
    await writeFile(join(TMP, "package.json"), JSON.stringify({ name: "tmp-deploy", type: "module", packageManager: "bun@1.3.9" }, null, 2))

    const proc = Bun.spawn(["bun", "run", CLI, "deploy", "docker"], {
      cwd: TMP,
      stdout: "pipe",
      stderr: "pipe",
    })

    expect(await proc.exited).toBe(0)
    const dockerfile = await readFile(join(TMP, "Dockerfile"), "utf-8")
    expect(dockerfile).toContain("bun install --frozen-lockfile")
    expect(dockerfile).toContain("ENV APP_ORIGIN=REPLACE_WITH_APP_ORIGIN")
    expect(dockerfile).toContain('CMD ["bun", "run", "start"]')
  })

  test("docker deploy generation supports a Node runtime profile", async () => {
    await rm(TMP, { recursive: true, force: true })
    await mkdir(TMP, { recursive: true })
    await writeFile(join(TMP, "package.json"), JSON.stringify({ name: "tmp-deploy", type: "module", packageManager: "bun@1.3.9" }, null, 2))

    const proc = Bun.spawn(["bun", "run", CLI, "deploy", "docker", "--runtime", "node"], {
      cwd: TMP,
      stdout: "pipe",
      stderr: "pipe",
    })

    expect(await proc.exited).toBe(0)
    const dockerfile = await readFile(join(TMP, "Dockerfile"), "utf-8")
    expect(dockerfile).toContain("FROM node:20-bookworm-slim")
    expect(dockerfile).toContain('CMD ["node", "dist/prod-node.js"]')
    expect(dockerfile).not.toContain("/app/routes")
  })

  test("fly deploy generation supports a Node runtime profile", async () => {
    await rm(TMP, { recursive: true, force: true })
    await mkdir(TMP, { recursive: true })
    await writeFile(join(TMP, "package.json"), JSON.stringify({ name: "tmp-deploy", type: "module", packageManager: "bun@1.3.9" }, null, 2))

    const proc = Bun.spawn(["bun", "run", CLI, "deploy", "fly", "--runtime", "node"], {
      cwd: TMP,
      stdout: "pipe",
      stderr: "pipe",
    })

    expect(await proc.exited).toBe(0)
    const dockerfile = await readFile(join(TMP, "Dockerfile"), "utf-8")
    expect(dockerfile).toContain("FROM node:20-bookworm-slim")
    expect(dockerfile).toContain('CMD ["node", "dist/prod-node.js"]')
    expect(dockerfile).not.toContain("/app/routes")
  })

  test("vercel deploy generation keeps provider build/output/runtime contract", async () => {
    await rm(TMP, { recursive: true, force: true })
    await mkdir(TMP, { recursive: true })
    await writeFile(join(TMP, "package.json"), JSON.stringify({ name: "tmp-deploy", type: "module", packageManager: "bun@1.3.9" }, null, 2))
    await writeBuiltHandlerStubs(TMP)

    const proc = Bun.spawn(["bun", "run", CLI, "deploy", "vercel"], {
      cwd: TMP,
      stdout: "pipe",
      stderr: "pipe",
    })

    expect(await proc.exited).toBe(0)
    const config = await readFile(join(TMP, "vercel.json"), "utf-8")
    const handler = await readFile(join(TMP, "api/index.ts"), "utf-8")
    expect(config).toContain('"buildCommand": "bun run build"')
    expect(config).toContain('"outputDirectory": ".vercel/output"')
    expect(config).toContain('"Cache-Control": "public, max-age=31536000, immutable"')
    expect(handler).toContain("APP_ORIGIN")
    expect(handler).toContain("../dist/server-handler-node.js")
    expect(handler).toContain("handleRequest(request, { vercel: true }, { rpcPolicy })")

    const vercelHandler = await importFresh(join(TMP, "api/index.ts"))
    const response = await vercelHandler.default(new Request("http://localhost/settings"))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      pathname: "/settings",
      contextKeys: ["vercel"],
      hasRpcPolicy: true,
      rpcMiddlewareCount: 0,
    })
  })

  test("vercel deploy generation rejects a Bun runtime override", async () => {
    await rm(TMP, { recursive: true, force: true })
    await mkdir(TMP, { recursive: true })
    await writeFile(join(TMP, "package.json"), JSON.stringify({ name: "tmp-deploy", type: "module", packageManager: "bun@1.3.9" }, null, 2))

    const proc = Bun.spawn(["bun", "run", CLI, "deploy", "vercel", "--runtime", "bun"], {
      cwd: TMP,
      stdout: "pipe",
      stderr: "pipe",
    })

    expect(await proc.exited).toBe(1)
  })
})
