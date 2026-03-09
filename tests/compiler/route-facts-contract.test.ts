import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { mkdir, rm, writeFile, readFile } from "node:fs/promises"
import { join } from "node:path"
import { createRouter } from "../../src/router/scanner.ts"
import {
  createRouteFactsArtifact,
  getRouteFactMethods,
  getRouteParamsRecord,
  parseRouteFactsArtifact,
  ROUTE_FACTS_SCHEMA_VERSION,
  toRouteDocSurface,
} from "../../src/compiler/route-facts.ts"

const TMP = join(process.cwd(), ".tmp-route-facts-contract")

describe("route facts contract", () => {
  beforeAll(async () => {
    await rm(TMP, { recursive: true, force: true })
    await mkdir(join(TMP, "api"), { recursive: true })
    await writeFile(join(TMP, "index.tsx"), `
      /** Home */
      export async function load() {
        return { ok: true }
      }
      export default function Home() {
        return <main>home</main>
      }
    `.trim())
    await writeFile(join(TMP, "api", "users.ts"), `
      export async function GET() {
        return new Response("ok")
      }
      export async function POST() {
        return new Response("created", { status: 201 })
      }
    `.trim())
  })

  afterAll(async () => {
    await rm(TMP, { recursive: true, force: true })
  })

  test("creates versioned route facts artifacts with canonical method metadata", async () => {
    const routes = await createRouter(TMP)
    const artifact = await createRouteFactsArtifact(routes)

    expect(artifact.schemaVersion).toBe(ROUTE_FACTS_SCHEMA_VERSION)
    expect(artifact.routes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        schemaVersion: ROUTE_FACTS_SCHEMA_VERSION,
        path: "/",
        methods: [],
        hasLoader: true,
        isApi: false,
      }),
      expect.objectContaining({
        schemaVersion: ROUTE_FACTS_SCHEMA_VERSION,
        path: "/api/users",
        methods: ["GET", "POST"],
        hasLoader: false,
        isApi: true,
      }),
    ]))
  })

  test("rejects route facts schema drift fail-closed", async () => {
    const raw = JSON.stringify({
      schemaVersion: ROUTE_FACTS_SCHEMA_VERSION - 1,
      routes: [],
    })

    expect(() => parseRouteFactsArtifact(raw)).toThrow(/Unsupported route facts schema version/)
  })

  test("round-trips generated route facts artifacts through the parser", async () => {
    const routes = await createRouter(TMP)
    const artifact = await createRouteFactsArtifact(routes)
    const rawPath = join(TMP, "route-facts.json")
    await writeFile(rawPath, JSON.stringify(artifact, null, 2))

    const parsed = parseRouteFactsArtifact(await readFile(rawPath, "utf-8"))
    expect(parsed).toEqual(artifact)
  })

  test("route facts expose canonical derivation helpers for docs and typegen consumers", async () => {
    const routes = await createRouter(TMP)
    const artifact = await createRouteFactsArtifact(routes)
    const home = artifact.routes.find((route) => route.path === "/")
    const users = artifact.routes.find((route) => route.path === "/api/users")

    expect(home).toBeDefined()
    expect(users).toBeDefined()

    expect(getRouteFactMethods(home!)).toEqual(["GET"])
    expect(getRouteFactMethods(users!)).toEqual(["GET", "POST"])
    expect(getRouteParamsRecord(home!)).toEqual({})
    expect(toRouteDocSurface(users!)).toEqual({
      path: "/api/users",
      methods: ["GET", "POST"],
      hasLoader: false,
      isApi: true,
      hasMiddleware: false,
      title: "",
      meta: null,
    })
  })
})
