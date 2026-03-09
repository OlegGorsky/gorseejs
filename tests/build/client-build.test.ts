// Tests for client bundling pipeline

import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import { buildClientBundles, type BuildResult } from "../../src/build/client.ts"
import type { ClientBuildBackend } from "../../src/build/client-backend.ts"
import { createRouter } from "../../src/router/scanner.ts"
import type { Route } from "../../src/router/scanner.ts"
import { join } from "node:path"
import { rm } from "node:fs/promises"

const CWD = process.cwd()

let routes: Route[]
let result: BuildResult

beforeAll(async () => {
  await rm(join(CWD, ".gorsee"), { recursive: true, force: true })
  routes = await createRouter(join(CWD, "routes"))
  result = await buildClientBundles(routes, CWD)
})

afterAll(async () => {
  await rm(join(CWD, ".gorsee"), { recursive: true, force: true })
})

describe("client build", () => {
  test("builds client bundles for page routes", () => {
    expect(result.entryMap.size).toBeGreaterThan(0)
    expect(result.entryMap.has("/")).toBe(true)
    expect(result.entryMap.has("/users")).toBe(true)
  })

  test("skips API routes", () => {
    expect(result.entryMap.has("/api/health")).toBe(false)
  })

  test("generates JS files on disk", async () => {
    const indexJs = result.entryMap.get("/")!
    const file = Bun.file(join(CWD, ".gorsee", "client", indexJs))
    expect(await file.exists()).toBe(true)
    const content = await file.text()
    expect(content).toContain("createSignal")
  })

  test("strips loader from client bundle", async () => {
    const usersJs = result.entryMap.get("/users")!
    const content = await Bun.file(join(CWD, ".gorsee", "client", usersJs)).text()
    expect(content).not.toContain("function loader")
    expect(content).toContain("UsersPage")
  })

  test("replaces server() with RPC fetch in client", async () => {
    const counterJs = result.entryMap.get("/counter")!
    const content = await Bun.file(join(CWD, ".gorsee", "client", counterJs)).text()
    expect(content).not.toContain("node:crypto")
    // server() call should be replaced with fetch-based RPC stub
    expect(content).toContain("_rpc/")
    expect(content).toContain("fetch")
    // devalue.parse should be inlined for safe deserialization
    expect(content).toContain("unflatten")
  })

  test("client bundle uses DOM jsx runtime", async () => {
    const indexJs = result.entryMap.get("/")!
    const content = await Bun.file(join(CWD, ".gorsee", "client", indexJs)).text()
    expect(content).toMatch(/\bjsxs?\b/)
    expect(content).not.toContain("return<>")
    expect(content).not.toContain("<main>")
  })

  test("client entry uses hydrate()", async () => {
    const indexJs = result.entryMap.get("/")!
    const content = await Bun.file(join(CWD, ".gorsee", "client", indexJs)).text()
    expect(content).toContain("hydrate")
  })

  test("client entry composes layout chain for hydration parity", async () => {
    const indexEntry = await Bun.file(join(CWD, ".gorsee", "entries", "index.ts")).text()
    expect(indexEntry).toContain("composeComponentTree")
    expect(indexEntry).toContain("children: inner")
    expect(indexEntry).toContain("let tree = () => Component(props)")
    expect(indexEntry).toContain("export default composeComponentTree")
    expect(indexEntry).toContain("__GORSEE_SUPPRESS_ENTRY_BOOTSTRAP__")
    expect(indexEntry).toContain('_layout.tsx')
  })

  test("supports pluggable client build backend contract", async () => {
    const calls: Array<{ entrypoints: string[]; outdir: string }> = []
    const backend: ClientBuildBackend = {
      name: "test",
      async build(options) {
        calls.push({ entrypoints: options.entrypoints, outdir: options.outdir })
        return { success: true, logs: [] }
      },
    }

    const stub = await buildClientBundles(routes, CWD, { backend })

    expect(calls).toHaveLength(1)
    expect(calls[0]?.entrypoints.length).toBeGreaterThan(0)
    expect(calls[0]?.outdir).toBe(join(CWD, ".gorsee", "client"))
    expect(stub.entryMap.size).toBeGreaterThan(0)
  })
})
