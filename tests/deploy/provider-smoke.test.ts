import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { mkdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { buildProject } from "../../src/cli/cmd-build.ts"
import { generateDeployConfig } from "../../src/cli/cmd-deploy.ts"

const TMP = join(process.cwd(), ".tmp-provider-smoke")

describe("provider deploy smoke", () => {
  beforeAll(async () => {
    await rm(TMP, { recursive: true, force: true })
    await mkdir(join(TMP, "routes"), { recursive: true })
    await writeFile(join(TMP, "app.config.ts"), `
      export default {
        security: {
          origin: "http://localhost",
        },
      }
    `.trim())
    await writeFile(join(TMP, "routes", "index.tsx"), `
      export default function HomePage() {
        return <main>provider smoke</main>
      }
    `.trim())

    await buildProject({ cwd: TMP })
  })

  afterAll(async () => {
    delete (globalThis as Record<string, unknown>).Netlify
    await rm(TMP, { recursive: true, force: true })
  })

  test("generated Vercel handler serves built runtime", async () => {
    await generateDeployConfig(["vercel"], { cwd: TMP })

    const mod = await import(pathToFileURL(join(TMP, "api", "index.ts")).href)
    const response = await mod.default(new Request("http://localhost/"))

    expect(response.status).toBe(200)
    expect(await response.text()).toContain("provider smoke")
  })

  test("generated Cloudflare worker serves built runtime", async () => {
    await generateDeployConfig(["cloudflare"], { cwd: TMP })

    const mod = await import(pathToFileURL(join(TMP, "worker.ts")).href)
    const response = await mod.default.fetch(
      new Request("http://localhost/"),
      { APP_ORIGIN: "http://localhost" },
      {} as any,
    )

    expect(response.status).toBe(200)
    expect(await response.text()).toContain("provider smoke")
  })

  test("generated Cloudflare worker preserves static asset bypass contract", async () => {
    await generateDeployConfig(["cloudflare"], { cwd: TMP })

    const mod = await import(pathToFileURL(join(TMP, "worker.ts")).href)
    const response = await mod.default.fetch(
      new Request("http://localhost/_gorsee/app.js"),
      {
        APP_ORIGIN: "http://localhost",
        __STATIC_CONTENT: {
          get(path: string) {
            return path === "app.js" ? "asset-body" : null
          },
        },
      },
      {} as any,
    )

    expect(response.status).toBe(200)
    expect(await response.text()).toBe("asset-body")
    expect(response.headers.get("Cache-Control")).toContain("immutable")
  })

  test("generated Netlify edge function serves built runtime", async () => {
    await generateDeployConfig(["netlify"], { cwd: TMP })

    ;(globalThis as Record<string, unknown>).Netlify = {
      env: {
        get(name: string) {
          return name === "APP_ORIGIN" ? "http://localhost" : undefined
        },
      },
    }

    const mod = await import(pathToFileURL(join(TMP, "netlify", "edge-functions", "gorsee-handler.ts")).href)
    const response = await mod.default(new Request("http://localhost/"), {
      next() {
        return new Response("next")
      },
    })

    expect(response.status).toBe(200)
    expect(await response.text()).toContain("provider smoke")
  })

  test("generated Netlify edge function bypasses static asset handling through context.next()", async () => {
    await generateDeployConfig(["netlify"], { cwd: TMP })

    ;(globalThis as Record<string, unknown>).Netlify = {
      env: {
        get(name: string) {
          return name === "APP_ORIGIN" ? "http://localhost" : undefined
        },
      },
    }

    const mod = await import(pathToFileURL(join(TMP, "netlify", "edge-functions", "gorsee-handler.ts")).href)
    const response = await mod.default(new Request("http://localhost/_gorsee/app.js"), {
      next() {
        return new Response("static-next")
      },
    })

    expect(response.status).toBe(200)
    expect(await response.text()).toBe("static-next")
  })

  test("generated Docker Node profile matches the built Node production runtime", async () => {
    await generateDeployConfig(["docker", "--runtime", "node"], { cwd: TMP })

    const dockerfile = await Bun.file(join(TMP, "Dockerfile")).text()
    const prodNode = await import(pathToFileURL(join(TMP, "dist", "prod-node.js")).href)

    expect(dockerfile).toContain('CMD ["node", "dist/prod-node.js"]')
    expect(dockerfile).not.toContain("/app/routes")
    expect(typeof prodNode.startNodeProductionServer).toBe("function")
  })

  test("generated Docker Bun profile matches the built Bun production runtime", async () => {
    await generateDeployConfig(["docker"], { cwd: TMP })

    const dockerfile = await Bun.file(join(TMP, "Dockerfile")).text()
    const prod = await import(pathToFileURL(join(TMP, "dist", "prod.js")).href)

    expect(dockerfile).toContain('CMD ["bun", "run", "start"]')
    expect(typeof prod.startProductionServer).toBe("function")
  })

  test("generated Fly Node profile matches the built Node production runtime", async () => {
    await generateDeployConfig(["fly", "--runtime", "node"], { cwd: TMP })

    const dockerfile = await Bun.file(join(TMP, "Dockerfile")).text()
    const prodNode = await import(pathToFileURL(join(TMP, "dist", "prod-node.js")).href)

    expect(dockerfile).toContain('CMD ["node", "dist/prod-node.js"]')
    expect(dockerfile).not.toContain("/app/routes")
    expect(typeof prodNode.startNodeProductionServer).toBe("function")
  })

  test("generated Fly Bun profile matches the built Bun production runtime", async () => {
    await generateDeployConfig(["fly"], { cwd: TMP })

    const dockerfile = await Bun.file(join(TMP, "Dockerfile")).text()
    const prod = await import(pathToFileURL(join(TMP, "dist", "prod.js")).href)

    expect(dockerfile).toContain('CMD ["bun", "run", "start"]')
    expect(typeof prod.startProductionServer).toBe("function")
  })
})
