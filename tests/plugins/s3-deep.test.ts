import { describe, test, expect } from "bun:test"
import { s3Plugin, getStorage } from "../../src/plugins/s3.ts"

const pluginCtx = { addMiddleware: () => {}, addRoute: () => {}, config: {} }

describe("s3 plugin deep", () => {
  test("s3Plugin returns GorseePlugin", () => {
    const p = s3Plugin({ bucket: "b" })
    expect(p.name).toBe("gorsee-s3")
  })

  test("s3Plugin has setup and teardown", () => {
    const p = s3Plugin({ bucket: "b" })
    expect(typeof p.setup).toBe("function")
    expect(typeof p.teardown).toBe("function")
  })

  test("getStorage throws before setup", async () => {
    const p = s3Plugin({ bucket: "b" })
    await p.teardown!() // ensure clean state
    expect(() => getStorage()).toThrow("S3 not initialized")
  })

  test("after setup, getStorage returns client", async () => {
    const p = s3Plugin({ bucket: "test-bucket", region: "us-west-2" })
    await p.setup!(pluginCtx)
    const client = getStorage()
    expect(client).toBeDefined()
    await p.teardown!()
  })

  test("client has upload method", async () => {
    const p = s3Plugin({ bucket: "b" })
    await p.setup!(pluginCtx)
    expect(typeof getStorage().upload).toBe("function")
    await p.teardown!()
  })

  test("client has download method", async () => {
    const p = s3Plugin({ bucket: "b" })
    await p.setup!(pluginCtx)
    expect(typeof getStorage().download).toBe("function")
    await p.teardown!()
  })

  test("client has delete method", async () => {
    const p = s3Plugin({ bucket: "b" })
    await p.setup!(pluginCtx)
    expect(typeof getStorage().delete).toBe("function")
    await p.teardown!()
  })

  test("client has list method", async () => {
    const p = s3Plugin({ bucket: "b" })
    await p.setup!(pluginCtx)
    expect(typeof getStorage().list).toBe("function")
    await p.teardown!()
  })

  test("custom endpoint used", async () => {
    const p = s3Plugin({ bucket: "b", endpoint: "https://minio.local:9000" })
    await p.setup!(pluginCtx)
    // Client created successfully with custom endpoint
    expect(getStorage()).toBeDefined()
    await p.teardown!()
  })

  test("teardown clears client", async () => {
    const p = s3Plugin({ bucket: "b" })
    await p.setup!(pluginCtx)
    expect(getStorage()).toBeDefined()
    await p.teardown!()
    expect(() => getStorage()).toThrow()
  })
})
