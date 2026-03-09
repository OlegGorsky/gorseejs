import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { mkdir, rm, symlink, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { serveStaticFile } from "../../src/server/static-file.ts"

const TMP = join(process.cwd(), ".tmp-static-file-fuzz")
const ROOT = join(TMP, "public")
const OUTSIDE = join(TMP, "outside")

describe("static file fuzz-like boundaries", () => {
  beforeAll(async () => {
    await rm(TMP, { recursive: true, force: true })
    await mkdir(ROOT, { recursive: true })
    await mkdir(OUTSIDE, { recursive: true })
    await writeFile(join(ROOT, "hello.txt"), "hello")
    await writeFile(join(OUTSIDE, "secret.txt"), "secret")
    await symlink(join(OUTSIDE, "secret.txt"), join(ROOT, "secret-link.txt"))
  })

  afterAll(async () => {
    await rm(TMP, { recursive: true, force: true })
  })

  test("rejects traversal-like path variants", async () => {
    const cases = [
      "../outside/secret.txt",
      "..//outside/secret.txt",
      "nested/../../outside/secret.txt",
      "/etc/passwd",
    ]

    for (const path of cases) {
      const response = await serveStaticFile(ROOT, path)
      expect(response).toBeNull()
    }
  })

  test("rejects symlink escapes outside the static root", async () => {
    const response = await serveStaticFile(ROOT, "secret-link.txt")
    expect(response).toBeNull()
  })

  test("still serves valid files within the root", async () => {
    const response = await serveStaticFile(ROOT, "hello.txt")
    expect(response).not.toBeNull()
    expect(await response!.text()).toBe("hello")
  })
})
