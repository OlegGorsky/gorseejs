import { afterEach, describe, expect, test } from "bun:test"
import { mkdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { createRouter } from "../../src/router/scanner.ts"

const TMP = join(process.cwd(), ".tmp-scanner-fuzz")

describe("scanner fuzz-like boundaries", () => {
  afterEach(async () => {
    await rm(TMP, { recursive: true, force: true })
  })

  test("duplicate paths across route groups fail closed", async () => {
    await mkdir(join(TMP, "(marketing)"), { recursive: true })
    await writeFile(join(TMP, "(marketing)", "about.tsx"), "export default () => 'group'")
    await writeFile(join(TMP, "about.tsx"), "export default () => 'root'")

    await expect(createRouter(TMP)).rejects.toThrow("Duplicate route path detected: /about")
  })

  test("directory scan is deterministic regardless of filesystem entry order", async () => {
    await mkdir(join(TMP, "b"), { recursive: true })
    await mkdir(join(TMP, "a"), { recursive: true })
    await writeFile(join(TMP, "b", "index.tsx"), "export default () => 'b'")
    await writeFile(join(TMP, "a", "index.tsx"), "export default () => 'a'")

    const routes = await createRouter(TMP)
    expect(routes.map((route) => route.path)).toEqual(["/a", "/b"])
  })

  test("ignored underscore files do not produce public routes", async () => {
    await mkdir(TMP, { recursive: true })
    await writeFile(join(TMP, "_secret.tsx"), "export default () => 'hidden'")
    await writeFile(join(TMP, "index.tsx"), "export default () => 'home'")

    const routes = await createRouter(TMP)
    expect(routes.map((route) => route.path)).toEqual(["/"])
  })
})
