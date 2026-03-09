import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { mkdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { serveStaticFile } from "../../src/server/static-file.ts"

const TMP = join(process.cwd(), ".tmp-static-file")
const PUBLIC_DIR = join(TMP, "public")
const SIBLING_DIR = join(TMP, "public-backup")

describe("serveStaticFile", () => {
  beforeAll(async () => {
    await rm(TMP, { recursive: true, force: true })
    await mkdir(PUBLIC_DIR, { recursive: true })
    await mkdir(SIBLING_DIR, { recursive: true })

    await writeFile(join(PUBLIC_DIR, "safe.txt"), "safe")
    await writeFile(join(SIBLING_DIR, "leak.txt"), "leak")
  })

  afterAll(async () => {
    await rm(TMP, { recursive: true, force: true })
  })

  test("serves files inside the configured root", async () => {
    const response = await serveStaticFile(PUBLIC_DIR, "safe.txt")

    expect(response).not.toBeNull()
    expect(await response!.text()).toBe("safe")
  })

  test("blocks sibling-prefix traversal outside the configured root", async () => {
    const response = await serveStaticFile(PUBLIC_DIR, "../public-backup/leak.txt")

    expect(response).toBeNull()
  })
})
