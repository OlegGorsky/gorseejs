import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { mkdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { createAuth } from "../../src/auth/index.ts"
import { runBuild } from "../../src/cli/cmd-build.ts"
import { createContext } from "../../src/server/middleware.ts"
import { RPC_CONTENT_TYPE, RPC_PROTOCOL_VERSION } from "../../src/server/rpc-protocol.ts"
import { __registerRPC, __resetRPCState } from "../../src/server/rpc.ts"
import { createProductionFetchHandler } from "../../src/prod.ts"

const TMP = join(process.cwd(), ".tmp-production-rpc-runtime")
const ROUTES_DIR = join(TMP, "routes")
const ORIGINAL_CWD = process.cwd()

describe("production rpc runtime integration", () => {
  beforeAll(async () => {
    await rm(TMP, { recursive: true, force: true })
    await mkdir(ROUTES_DIR, { recursive: true })
    await writeFile(join(TMP, "app.config.ts"), `
      export default {
        security: {
          origin: "https://app.example.com",
        },
      }
    `.trim())
    await writeFile(join(ROUTES_DIR, "index.tsx"), `
      export default function HomePage() {
        return <main>rpc runtime</main>
      }
    `.trim())
  })

  afterAll(async () => {
    __resetRPCState()
    process.chdir(ORIGINAL_CWD)
    await rm(TMP, { recursive: true, force: true })
  })

  test("production fetch handler executes rpc through middleware and returns protocol content type", async () => {
    __resetRPCState()
    __registerRPC("runtimeauth01", async () => ({ ok: true }))

    const auth = createAuth({ secret: "runtime-rpc-secret" })
    const loginCtx = createContext(new Request("https://app.example.com/login"))
    await auth.login(loginCtx, "user-1")
    const sessionCookie = loginCtx.responseHeaders.get("Set-Cookie")!.split(";")[0]!

    process.chdir(TMP)
    await runBuild([])

    const handler = await createProductionFetchHandler({
      cwd: TMP,
      rpcMiddlewares: [auth.middleware, auth.requireAuth],
    })

    const denied = await handler(new Request("https://app.example.com/api/_rpc/runtimeauth01", {
      method: "POST",
      body: JSON.stringify({ v: 1, args: [] }),
      headers: {
        "Content-Type": RPC_CONTENT_TYPE,
        Origin: "https://app.example.com",
      },
    }))

    expect(denied.status).toBe(302)
    expect(denied.headers.get("Location")).toBe("/login")

    const allowed = await handler(new Request("https://app.example.com/api/_rpc/runtimeauth01", {
      method: "POST",
      body: JSON.stringify({ v: 1, args: [] }),
      headers: {
        "Content-Type": RPC_CONTENT_TYPE,
        Origin: "https://app.example.com",
        Cookie: sessionCookie,
      },
    }))

    expect(allowed.status).toBe(200)
    expect(allowed.headers.get("Content-Type")).toBe(RPC_CONTENT_TYPE)
    await expect(allowed.json()).resolves.toEqual({
      v: RPC_PROTOCOL_VERSION,
      ok: true,
      encoding: "devalue",
      data: expect.any(String),
    })
  })

  test("production fetch handler rejects cross-origin rpc requests before execution", async () => {
    __resetRPCState()
    __registerRPC("runtimeorig1", async () => ({ ok: true }))

    process.chdir(TMP)
    await runBuild([])
    const handler = await createProductionFetchHandler({ cwd: TMP })

    const response = await handler(new Request("https://app.example.com/api/_rpc/runtimeorig1", {
      method: "POST",
      body: JSON.stringify({ v: 1, args: [] }),
      headers: {
        "Content-Type": RPC_CONTENT_TYPE,
        Origin: "https://evil.example",
      },
    }))

    expect(response.status).toBe(403)
  })
})
